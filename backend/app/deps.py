from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import User
import bcrypt, os

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Valor permitido por el esquema Pydantic (evita el error)
VALID_ADMIN_PERM = os.getenv("ADMIN_ENTIDAD_PERM", "captura_reportes")

connect_kwargs = {"prepare_threshold": None}  # PgBouncer friendly

# ========== HASH PASSWORD ==========
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def seed_users(db: Session):

    # ===== ADMIN =====
    if not db.query(User).filter_by(email="admin@demo.com").first():
        db.execute(
            text("""
                INSERT INTO users (
                    email,
                    hashed_password,
                    role,
                    entidad_perm,
                    entidad_auditor,
                    entidad
                )
                VALUES (
                    :email,
                    :hashed_password,
                    :role,
                    :entidad_perm,
                    :entidad_auditor,
                    :entidad
                )
            """),
            {
                "email": "admin@demo.com",
                "hashed_password": hash_pw("admin123"),
                "role": "admin",
                "entidad_perm": VALID_ADMIN_PERM,
                "entidad_auditor": False,
                "entidad": "Administrador",
            }
        )

    # ===== USUARIO =====
    if not db.query(User).filter_by(email="usuario@demo.com").first():
        db.execute(
            text("""
                INSERT INTO users (
                    email,
                    hashed_password,
                    role,
                    entidad_perm,
                    entidad_auditor,
                    entidad
                )
                VALUES (
                    :email,
                    :hashed_password,
                    :role,
                    :entidad_perm,
                    :entidad_auditor,
                    :entidad
                )
            """),
            {
                "email": "usuario@demo.com",
                "hashed_password": hash_pw("usuario123"),
                "role": "entidad",
                "entidad_perm": "captura_reportes",
                "entidad_auditor": False,
                "entidad": "Alcaldía Demo",
            }
        )

    db.commit()
