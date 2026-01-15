from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/pqrds", tags=["pqrds"])

# ---------------- PQRDS (padre) ----------------
@router.get("")
@router.get("/")
def get_all_pqrds(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    pqrds = db.query(models.PQRD).all()
    return pqrds


@router.get("/count")
@router.get("/count/")
def count_pqrds(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    total = db.query(models.PQRD).count()
    return total


@router.get("/by/{label_pqrd}")
@router.get("/by/{label_pqrd}/")
def get_pqrd_by_label(
    label_pqrd: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    pqrd = db.query(models.PQRD).filter(models.PQRD.label == label_pqrd).first()

    if not pqrd:
        raise HTTPException(status_code=404, detail="PQRD not found")

    return pqrd


@router.post("")
@router.post("/")
def cargar_pqrds(
    payload: schemas.PqrdEntradaLista,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    nuevos = []

    for p in payload.pqrds:
        nuevo = models.PQRD(
            label=p.label,
            tipo_gestion=p.tipo_gestion if p.tipo_gestion else None,
            dependencia=p.dependencia if p.dependencia else None,
            entidad=p.entidad if p.entidad else None,
            fecha_ingreso=p.fecha_ingreso if p.fecha_ingreso else None,
            periodo=p.periodo if p.periodo else None
        )
        db.add(nuevo)
        nuevos.append(nuevo)

    db.commit()
    return {"insertados": len(nuevos)}


@router.delete("")
@router.delete("/")
def delete_all_pqrds(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_roles(user, ["admin"])

    deleted = db.query(models.PQRD).delete()
    db.commit()
    return {"eliminados": deleted}
