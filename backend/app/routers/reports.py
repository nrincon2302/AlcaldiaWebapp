from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/reports", tags=["reports"])

# ---------------- REPORTES (padre) ----------------
@router.get("")
@router.get("/")
def get_all_reportes(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    reportes = db.query(models.Reporte).all()
    return reportes


@router.get("/{nombre_entidad}")
@router.get("/{nombre_entidad}/")
def get_reportes_por_entidad(
    nombre_entidad: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Buscar todos los registros para esa entidad (case-insensitive)
    registros = (
        db.query(models.Reporte)
        .filter(models.Reporte.entidad.ilike(nombre_entidad))
        .all()
    )

    if not registros:
        raise HTTPException(status_code=404, detail="No records found for that entity")

    # Convertirlos al formato requerido
    resultado = {
        "entidad": registros[0].entidad,
        "indicadores": [
            {"indicador": r.indicador, "criterio": r.criterio, "accion": r.accion, "insumo": r.insumo}
            for r in registros
            if r.indicador is not None and r.criterio is not None
        ],
    }
    return resultado

@router.post("")
@router.post("/")
def cargar_reportes(
    payload: schemas.ReporteEntradaLista,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    nuevos = []

    for r in payload.reportes:
        nuevo = models.Reporte(
            entidad=r.entidad,
            indicador=r.indicador,
            criterio=r.criterio,
            accion=r.accion,
            insumo=r.insumo
        )
        db.add(nuevo)
        nuevos.append(nuevo)

    db.commit()
    return {"insertados": len(nuevos)}


@router.delete("")
@router.delete("/")
def clear_reportes(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Borrar todos los registros
    deleted = db.query(models.Reporte).delete()

    # Confirmar cambios
    db.commit()

    return {"detail": f"{deleted} registros eliminados"}