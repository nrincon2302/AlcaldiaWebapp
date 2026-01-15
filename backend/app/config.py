import os
from dotenv import load_dotenv
load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-super-secret")  # cambia en prod
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
# normaliza lista de CORS a nivel de módulo (usada por main.py)
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# ── ALIASES DE MÓDULO (requeridos por dependencies.py y otros) ──
SECRET_KEY = JWT_SECRET
ALGORITHM = JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = JWT_EXPIRE_HOURS * 60
SQLALCHEMY_DATABASE_URL = DATABASE_URL
 
class Settings:
    def __init__(self):
        # mapea a tus variables ya definidas arriba
        self.SECRET_KEY = JWT_SECRET
        self.ALGORITHM = JWT_ALGORITHM
        # muchos módulos esperan minutos:
        self.ACCESS_TOKEN_EXPIRE_MINUTES = int(JWT_EXPIRE_HOURS) * 60
        self.DATABASE_URL = DATABASE_URL
        # asegúrate que sea lista de strings sin espacios
        self.CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS] 
        
settings = Settings()