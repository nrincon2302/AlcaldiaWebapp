from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_roles
from sqlalchemy import func

router = APIRouter(prefix="/seguimiento", tags=["seguimiento"])

@router.get("/indicadores_usados", response_model=List[str])
@router.get("/indicadores_usados/", response_model=List[str])
def indicadores_usados(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> List[str]:
    """
    Devuelve los indicadores que YA tienen al menos un seguimiento
    para la entidad del usuario autenticado.
    """
    user_entidad = (getattr(user, "entidad", "") or "").strip()
    user_role = getattr(user.role, "value", user.role)
    is_entidad_auditor = user_role == "entidad" and bool(getattr(user, "entidad_auditor", False))

    # Base: join Seguimiento -> PlanAccion para filtrar por entidad
    q = (
        db.query(models.Seguimiento.indicador)
        .join(models.PlanAccion, models.Seguimiento.plan_id == models.PlanAccion.id)
        .filter(
            models.Seguimiento.indicador.isnot(None),
            func.trim(models.Seguimiento.indicador) != "",
        )
    )

    # Si el usuario tiene entidad asociada, filtramos solo sus planes
    if user_entidad and not is_entidad_auditor:
        q = q.filter(
            func.lower(models.PlanAccion.nombre_entidad) == func.lower(user_entidad)
        )

    # Distinct para no devolver duplicados
    rows = q.distinct().all()
    # rows es una lista de tuplas (indicador,), nos quedamos con el valor
    return [r[0].strip() for r in rows if r[0]]

# ---------------- PLANES (padre) ----------------
@router.get("")          # <— sin slash
@router.get("/")         # <— con slash
def list_planes(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[schemas.PlanOut]:
    query = db.query(models.PlanAccion)
    user_role = getattr(user.role, "value", user.role)
    user_entidad = (getattr(user, "entidad", "") or "").strip()
    is_entidad_auditor = user_role == "entidad" and bool(getattr(user, "entidad_auditor", False))

    if user_role == "entidad" and user_entidad and not is_entidad_auditor:
        query = query.filter(
            func.lower(models.PlanAccion.nombre_entidad) == func.lower(user_entidad)
        )
    if q:
        like = f"%{q}%"
        query = query.filter(models.PlanAccion.nombre_entidad.ilike(like))
    return (
        query.order_by(models.PlanAccion.id.desc())
        .offset(skip)
        .limit(min(limit, 200))
        .all()
    )

@router.post("")
@router.post("/")
def crear_plan(
    payload: schemas.PlanCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("entidad", "admin")),
) -> schemas.PlanOut:
    data = payload.model_dump(exclude_unset=True)

    user_role = getattr(user.role, "value", user.role)
    if user_role == "entidad":
        data["nombre_entidad"] = (getattr(user, "entidad", "") or "").strip()
        
    plan = models.PlanAccion(**data, created_by=user.id)
    db.add(plan); db.commit(); db.refresh(plan)
    return plan

@router.get("/{plan_id}")
@router.get("/{plan_id}/")
def obtener_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> schemas.PlanOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No encontrado")
    return plan

@router.put("/{plan_id}")
@router.put("/{plan_id}/")
def actualizar_plan(
    plan_id: int,
    payload: schemas.PlanUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> schemas.PlanOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No encontrado")
    # if user.role == models.UserRole.entidad and plan.created_by != user.id:
    #     raise HTTPException(status_code=403, detail="Sin permisos")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "nombre_entidad":
            continue 
        setattr(plan, k, v)
    db.commit(); db.refresh(plan)
    return plan

@router.post("/{plan_id}/enviar_revision")
@router.post("/{plan_id}/enviar_revision/")
def enviar_revision(
    plan_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("entidad", "admin")),
) -> schemas.PlanOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No encontrado")
    plan.estado = "En revisión"
    db.commit(); db.refresh(plan)
    return plan

@router.post("/{plan_id}/observacion")
@router.post("/{plan_id}/observacion/")
def agregar_observacion(
    plan_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("auditor", "admin")),
) -> schemas.PlanOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No encontrado")
    plan.observacion_calidad = (payload.get("observacion") or "").strip()
    plan.estado = "Observado"
    db.commit(); db.refresh(plan)
    return plan

@router.post("/{plan_id}/estado")
@router.post("/{plan_id}/estado/")
def cambiar_estado(
    plan_id: int,
    estado: str = Query(..., description="Nuevo estado, p.ej. 'Observado', 'Aprobado', 'En revisión'"),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("auditor", "admin")),
) -> schemas.PlanOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No encontrado")
    plan.estado = estado
    db.commit(); db.refresh(plan)
    return plan

@router.delete("/{plan_id}")
@router.delete("/{plan_id}/")
def eliminar_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("entidad", "admin")),
):
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No encontrado")
    db.query(models.Seguimiento).filter(models.Seguimiento.plan_id == plan_id).delete()
    db.delete(plan); db.commit()
    return {"ok": True}

# ---------------- SEGUIMIENTOS (hijos) ----------------

def _assert_access(plan: models.PlanAccion, user: models.User, *, write: bool = False):
    return

@router.get("/{plan_id}/seguimiento", response_model=List[schemas.SeguimientoOut])
@router.get("/{plan_id}/seguimiento/", response_model=List[schemas.SeguimientoOut])
def listar_seguimientos(
    plan_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> List[schemas.SeguimientoOut]:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    _assert_access(plan, user)
    seguimientos = (
        db.query(models.Seguimiento)
        .options(joinedload(models.Seguimiento.updated_by)) 
        .filter(models.Seguimiento.plan_id == plan.id)
        .order_by(models.Seguimiento.id.asc())
        .all()
    )
    return seguimientos

@router.post("/{plan_id}/seguimiento", response_model=schemas.SeguimientoOut)
@router.post("/{plan_id}/seguimiento/", response_model=schemas.SeguimientoOut)
def crear_seguimiento(
    plan_id: int,
    payload: schemas.SeguimientoCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> schemas.SeguimientoOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    _assert_access(plan, user)

    data = payload.model_dump(exclude_unset=True)

    # Normalizamos fechas
    for k in ("fecha_inicio", "fecha_final"):
        if k in data and not data[k]:
            data[k] = None

    # Actualizar indicador en el plan (si viene)
    indicador_val = (data.get("indicador") or "").strip()
    if indicador_val:
        plan.indicador = indicador_val

    # Actualizar criterio en el plan (si viene) y quitarlo de data
    criterio_val = (data.pop("criterio", None) or "").strip()
    if criterio_val:
        plan.criterio = criterio_val

    # Crear seguimiento solo con los campos que realmente existen en Seguimiento
    seg = models.Seguimiento(**data, plan_id=plan.id)
    seg.updated_by_id = user.id
    db.add(seg)

    db.commit()
    db.refresh(seg)
    return seg

@router.put("/{plan_id}/seguimiento/{seg_id}", response_model=schemas.SeguimientoOut)
@router.put("/{plan_id}/seguimiento/{seg_id}/", response_model=schemas.SeguimientoOut)
def actualizar_seguimiento(
    plan_id: int,
    seg_id: int,
    payload: schemas.SeguimientoUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> schemas.SeguimientoOut:
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    _assert_access(plan, user)

    seg = db.query(models.Seguimiento).get(seg_id)
    if not seg or seg.plan_id != plan.id:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    data = payload.model_dump(exclude_unset=True)

    user_role = getattr(user.role, "value", user.role)
    is_entidad_auditor = user_role == "entidad" and bool(getattr(user, "entidad_auditor", False))
    if user_role == "entidad" and not is_entidad_auditor and "observacion_calidad" in data:
        del data["observacion_calidad"]

    # Si viene enlace_entidad, lo reflejamos en el plan
    if "enlace_entidad" in data:
        plan.enlace_entidad = data["enlace_entidad"]

    # Si viene indicador, lo subimos al plan
    indicador = (data.get("indicador") or "").strip()
    if indicador:
        plan.indicador = indicador

    # Si viene criterio, lo subimos al plan y LO QUITAMOS de data
    criterio_val = (data.pop("criterio", None) or "").strip()
    if criterio_val:
        plan.criterio = criterio_val

    # Ahora sí, solo los campos válidos para Seguimiento
    for k, v in data.items():
        setattr(seg, k, v)

    seg.updated_by_id = user.id
    db.commit()
    db.refresh(seg)

    return seg

@router.delete("/{plan_id}/seguimiento/{seg_id}")
@router.delete("/{plan_id}/seguimiento/{seg_id}/")
def eliminar_seguimiento(
    plan_id: int,
    seg_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    plan = db.query(models.PlanAccion).get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    _assert_access(plan, user)

    seg = db.query(models.Seguimiento).get(seg_id)
    if not seg or seg.plan_id != plan.id:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")

    db.delete(seg); db.commit()
    return {"ok": True}
