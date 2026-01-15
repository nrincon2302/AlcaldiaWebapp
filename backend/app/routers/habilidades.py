from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/habilidades", tags=["habilidades"])

# ----------- Habilidades (padre) ----------------
@router.get("")
@router.get("/")
def get_all_habilidades(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    habilidades = db.query(models.Habilidad).all()
    return habilidades


@router.post("")
@router.post("/")
def cargar_habilidades(
    payload: schemas.HabilidadEntradaLista,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    nuevos = []

    for p in payload.habilidades:
        nuevo = models.Habilidad(
            anio = p.anio,
            mes = p.mes,
            id_entidad = p.id_entidad,
            entidad = p.entidad,
            pct_habilidades_tecnicas = p.pct_habilidades_tecnicas,
            num_capacitados_tecnicas = p.num_capacitados_tecnicas,
            pct_habilidades_socioemocionales = p.pct_habilidades_socioemocionales,
            num_capacitados_socioemocionales = p.num_capacitados_socioemocionales
        )
        db.add(nuevo)
        nuevos.append(nuevo)

    db.commit()
    return {"insertados": len(nuevos)}


@router.delete("/{habilidad_id}")
@router.delete("/{habilidad_id}/")
def eliminar_habilidad(
    habilidad_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    habilidad = db.query(models.Habilidad).filter(models.Habilidad.id == habilidad_id).first()
    
    if not habilidad:
        raise HTTPException(status_code=404, detail="Habilidad no encontrada")

    db.delete(habilidad)
    db.commit()
    
    return {"message": "Habilidad eliminada exitosamente"}


@router.delete("")
@router.delete("/")
def eliminar_todas_habilidades(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.query(models.Habilidad).delete()
    db.commit()
    return {"message": "Todas las habilidades han sido eliminadas exitosamente"}
