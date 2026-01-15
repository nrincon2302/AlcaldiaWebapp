from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user
from passlib.hash import bcrypt  # si ya usas otra, cámbiala

router = APIRouter(prefix="/users", tags=["users"])

@router.patch("/{user_id}/password", status_code=204)
def reset_password(
    user_id: int,
    payload: schemas.UserPasswordReset,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    require_admin(user)
    if len(payload.new_password or "") < 8:
        raise HTTPException(status_code=422, detail="Password too short (min 8)")
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    # Permitimos que el admin cambie la suya o de otros
    u.hashed_password = bcrypt.hash(payload.new_password)
    db.commit()
    return Response(status_code=204)

@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    # No permitir borrarte a ti mismo
    if getattr(user, "id", None) == u.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    # No permitir borrar el último admin
    def _role_value(r): return r.value if hasattr(r, "value") else r
    def _as_db_role(r: str):
        try: return models.UserRole(r)  # Enum si existe
        except Exception: return r
    if _role_value(u.role) == "admin":
        admins = db.query(models.User).filter(models.User.role == _as_db_role("admin")).count()
        if admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    # Desvinculamos registros que referencian al usuario antes de eliminarlo (solo en motores con FK estricta)
    dialect = getattr(getattr(db, "bind", None), "dialect", None)
    dialect_name = getattr(dialect, "name", "")
    if dialect_name in ("postgresql", "postgres"):
        try:
            db.query(models.PlanAccion).filter(models.PlanAccion.created_by == u.id).update(
                {models.PlanAccion.created_by: None}, synchronize_session=False
            )
            db.query(models.Seguimiento).filter(models.Seguimiento.updated_by_id == u.id).update(
                {models.Seguimiento.updated_by_id: None}, synchronize_session=False
            )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No se pudo desvincular los planes/seguimientos asociados a este usuario",
            )

    try:
        db.delete(u)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se pudo eliminar porque existen referencias activas a este usuario",
        )
    return Response(status_code=204)

def _role_value(r):
    return r.value if hasattr(r, "value") else r

def _as_db_role(r: str):
    """Convierte 'admin'|'entidad'|'auditor'|'ciudadano' a Enum si existe, o deja string."""
    try:
        # Si models.UserRole es Enum, esto funciona; si no existe, cae al except
        return models.UserRole(r)  # type: ignore[attr-defined]
    except Exception:
        return r

def require_admin(user):
    if _role_value(getattr(user, "role", None)) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

@router.get("", response_model=List[schemas.UserOut]) 
@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    return db.query(models.User).order_by(models.User.id.asc()).all()

@router.post("", response_model=schemas.UserOut) 
@router.post("/", response_model=schemas.UserOut, status_code=201)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)  
    email = payload.email.strip().lower()
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password too short (min 8)")
    exists = db.query(models.User).filter(models.User.email == email).first()

    entidad_clean = (payload.entidad or "").strip()
    if not entidad_clean:
        raise HTTPException(
            status_code=422,
            detail="El campo 'entidad' es obligatorio",
        )
    
    if exists:
        raise HTTPException(400, "Email already exists")
    hashed = bcrypt.hash(payload.password)

    perm = payload.entidad_perm if payload.role == "entidad" else None
    entidad_auditor = bool(payload.entidad_auditor) if payload.role == "entidad" else False

    u = models.User(
        email=email, 
        hashed_password=hashed, 
        role=_as_db_role(payload.role), 
        entidad=entidad_clean, 
        entidad_perm=perm,
        entidad_auditor=entidad_auditor,
    )

    db.add(u)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already exists")
    db.refresh(u)
    return u

@router.patch("/{user_id}/role", response_model=schemas.UserOut)
def update_user_role(user_id: int, payload: schemas.UserRoleUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    # evitar que el admin se auto-degrade y te deje sin admin
    if u.id == getattr(user, "id", None) and payload.role != "admin":
       raise HTTPException(status_code=400, detail="You cannot remove your own admin access")
    # evitar dejar el sistema sin admins al degradar al último admin
    def _role_value(r): return r.value if hasattr(r, "value") else r
    def _as_db_role(r: str):
        try: return models.UserRole(r)  # Enum si existe
        except Exception: return r
    if _role_value(u.role) == "admin" and payload.role != "admin":
        admins = db.query(models.User).filter(models.User.role == _as_db_role("admin")).count()
        if admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")
    u.role = _as_db_role(payload.role)
    if payload.role != "entidad":
        u.entidad_perm = None
        u.entidad_auditor = False
    else:
        if not u.entidad_perm:
            u.entidad_perm = "captura_reportes"
        if u.entidad_auditor is None:
            u.entidad_auditor = False
    db.commit()
    db.refresh(u)
    return u

@router.patch("/{user_id}/perm", response_model=schemas.UserOut)
@router.patch("/{user_id}/perm/", response_model=schemas.UserOut)
def update_entidad_perm(user_id: int, payload: schemas.EntidadPermUpdate,
                        db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if (getattr(u, "role", None) == "entidad") or (getattr(u, "role", None).value == "entidad"):
        u.entidad_perm = payload.entidad_perm
        db.commit(); db.refresh(u)
        return u
    raise HTTPException(400, "Solo aplica para usuarios con rol 'entidad'")

@router.patch("/{user_id}/auditor", response_model=schemas.UserOut)
@router.patch("/{user_id}/auditor/", response_model=schemas.UserOut)
def update_entidad_auditor(user_id: int, payload: schemas.EntidadAuditorUpdate,
                           db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if (getattr(u, "role", None) == "entidad") or (getattr(u, "role", None).value == "entidad"):
        u.entidad_auditor = bool(payload.entidad_auditor)
        db.commit(); db.refresh(u)
        return u
    raise HTTPException(400, "Solo aplica para usuarios con rol 'entidad'")
