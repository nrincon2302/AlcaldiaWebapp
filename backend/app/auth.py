import os
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS
from app.database import get_db
from app import models

router = APIRouter(prefix="/auth", tags=["auth"])

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

DISABLE_AUTH = os.getenv("DISABLE_AUTH", "false").lower() == "true"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token") if not DISABLE_AUTH else (lambda: None)

def _enum_val(x):
    """Devuelve .value si es Enum; si no, el valor tal cual."""
    try:
        return x.value
    except Exception:
        return x

def create_access_token(
    sub: str,
    role: str,
    user_id: int,
    entidad_perm: Optional[str] = None,
    entidad: Optional[str] = None,
    entidad_auditor: Optional[bool] = None,
) -> str:
    payload = {
        "sub": sub,            # email
        "role": role,          # "admin" | "entidad" | "auditor" | "ciudadano"
        "uid": user_id,        # id numérico
        "entidad": entidad,     # entidad name
        "entidad_perm": entidad_perm,  # "captura_reportes" | "reportes_seguimiento" | None
        "entidad_auditor": bool(entidad_auditor),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> models.User:
    if DISABLE_AUTH:
        return models.User(
            id=0,
            email="guest@demo.com",
            hashed_password="",
            role=models.UserRole.admin,
        )

    cred_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        uid: int | None = payload.get("uid")
        role_in_token: str | None = payload.get("role")
        if email is None or uid is None or role_in_token is None:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = None
    if uid is not None:
        user = db.query(models.User).get(uid)
    if not user:
        user = db.query(models.User).filter_by(email=email).first()

    if not user:
        raise cred_exc
    return user

def require_roles(*roles: str):
    def checker(user: models.User = Depends(get_current_user)):
        if DISABLE_AUTH:
            return user
        current_role = _enum_val(user.role)
        is_entidad_auditor = current_role == "entidad" and bool(getattr(user, "entidad_auditor", False))
        if current_role not in roles and not ("auditor" in roles and is_entidad_auditor):
            raise HTTPException(status_code=403, detail="Sin permisos")
        return user
    return checker

@router.post("/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=form.username).first()
    if not user or not pwd.verify(form.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Credenciales inválidas")

    role_val = _enum_val(user.role)
    entidad_perm_val = _enum_val(getattr(user, "entidad_perm", None))
    entidad_auditor_val = bool(getattr(user, "entidad_auditor", False))

    token = create_access_token(
        sub=user.email,
        role=role_val,
        user_id=user.id,
        entidad=getattr(user, "entidad", None),  
        entidad_perm=entidad_perm_val,  
        entidad_auditor=entidad_auditor_val,
    )
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
def me(current: models.User = Depends(get_current_user)):
    return {
        "id": current.id,
        "email": current.email,
        "role": _enum_val(current.role),
        "entidad": getattr(current, "entidad", None),
        "entidad_perm": _enum_val(getattr(current, "entidad_perm", None)),
        "entidad_auditor": bool(getattr(current, "entidad_auditor", False)),
    }
