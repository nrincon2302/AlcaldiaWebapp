"""
Configuración compartida para las pruebas con pytest.
Define fixtures y configuración global.
"""

import os
import pytest
from datetime import date
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app import models
from passlib.context import CryptContext


# ──────────────────────────────────────────────────────────────────────────────
# DATABASE CONFIGURATION - Usar SQLite en memoria para pruebas
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def test_db():
    """
    Crea una base de datos SQLite en memoria para cada prueba.
    Se ejecuta antes de cada prueba y se limpia después.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    
    # Session factory
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    # Override la dependencia de BD en la app
    app.dependency_overrides[get_db] = override_get_db
    
    yield TestingSessionLocal()
    
    # Limpiar overrides después del test
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(test_db: Session):
    """
    Cliente de prueba para hacer requests a la API.
    """
    return TestClient(app)


# ──────────────────────────────────────────────────────────────────────────────
# USER FIXTURES
# ──────────────────────────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_hashed_password(password: str) -> str:
    """Hash una contraseña usando bcrypt."""
    return pwd_context.hash(password)


@pytest.fixture
def admin_user(test_db: Session) -> models.User:
    """
    Crea un usuario administrador para pruebas.
    """
    user = models.User(
        email="admin@test.com",
        hashed_password=create_hashed_password("admin123"),
        role=models.UserRole.admin,
        entidad="Alcaldia",
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def entidad_user(test_db: Session) -> models.User:
    """
    Crea un usuario de entidad para pruebas.
    """
    user = models.User(
        email="entidad@test.com",
        hashed_password=create_hashed_password("entidad123"),
        role=models.UserRole.entidad,
        entidad="Secretaría de Educación",
        entidad_perm="captura_reportes",
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auditor_user(test_db: Session) -> models.User:
    """
    Crea un usuario auditor para pruebas.
    """
    user = models.User(
        email="auditor@test.com",
        hashed_password=create_hashed_password("auditor123"),
        role=models.UserRole.auditor,
        entidad="Auditoria",
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def entidad_auditor_user(test_db: Session) -> models.User:
    """
    Crea un usuario de entidad con permisos de auditor.
    """
    user = models.User(
        email="entidad_auditor@test.com",
        hashed_password=create_hashed_password("entidad_auditor123"),
        role=models.UserRole.entidad,
        entidad="Secretaría de Salud",
        entidad_auditor=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


# ──────────────────────────────────────────────────────────────────────────────
# TOKENS FIXTURES
# ──────────────────────────────────────────────────────────────────────────────

def create_test_token(user: models.User) -> str:
    """
    Crea un token JWT válido para un usuario de prueba.
    """
    from app.auth import create_access_token
    from app.config import JWT_SECRET, JWT_ALGORITHM
    
    token = create_access_token(
        sub=user.email,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
        user_id=user.id,
        entidad_perm=user.entidad_perm,
        entidad=user.entidad,
        entidad_auditor=user.entidad_auditor,
    )
    return token


@pytest.fixture
def admin_token(admin_user: models.User) -> str:
    """
    Token válido para el usuario administrador.
    """
    return create_test_token(admin_user)


@pytest.fixture
def entidad_token(entidad_user: models.User) -> str:
    """
    Token válido para el usuario de entidad.
    """
    return create_test_token(entidad_user)


@pytest.fixture
def auditor_token(auditor_user: models.User) -> str:
    """
    Token válido para el usuario auditor.
    """
    return create_test_token(auditor_user)


@pytest.fixture
def entidad_auditor_token(entidad_auditor_user: models.User) -> str:
    """
    Token válido para el usuario de entidad con permisos de auditor.
    """
    return create_test_token(entidad_auditor_user)


# ──────────────────────────────────────────────────────────────────────────────
# PLAN FIXTURES
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def plan_action(test_db: Session, admin_user: models.User) -> models.PlanAccion:
    """
    Crea un plan de acción para pruebas.
    """
    plan = models.PlanAccion(
        num_plan_mejora="PLAN-001",
        nombre_entidad="Secretaría de Educación",
        insumo_mejora="Mejora de infraestructura",
        tipo_accion_mejora="Preventiva",
        accion_mejora_planteada="Construcción de aulas",
        observacion_informe_calidad="Se observó falta de espacios",
        descripcion_actividades="Construir 5 aulas nuevas",
        fecha_inicio=date(2024, 1, 1),
        fecha_final=date(2024, 12, 31),
        seguimiento="En progreso",
        enlace_entidad="https://ejemplo.com",
        estado="Pendiente",
        created_by=admin_user.id,
        indicador="Infraestructura",
        criterio="Calidad",
    )
    test_db.add(plan)
    test_db.commit()
    test_db.refresh(plan)
    return plan


@pytest.fixture
def seguimiento(test_db: Session, plan_action: models.PlanAccion, admin_user: models.User) -> models.Seguimiento:
    """
    Crea un seguimiento para pruebas.
    """
    seg = models.Seguimiento(
        plan_id=plan_action.id,
        indicador="Infraestructura",
        observacion_informe_calidad="Avance del 50%",
        observacion_calidad="Buen progreso",
        insumo_mejora="Materiales de construcción",
        tipo_accion_mejora="Preventiva",
        accion_mejora_planteada="Construcción de aulas",
        descripcion_actividades="Construcción en fase 1",
        evidencia_cumplimiento="Fotos actualizadas",
        fecha_inicio=date(2024, 1, 15),
        fecha_final=date(2024, 6, 30),
        seguimiento="En progreso",
        enlace_entidad="https://ejemplo.com/seg",
        updated_by_id=admin_user.id,
    )
    test_db.add(seg)
    test_db.commit()
    test_db.refresh(seg)
    return seg


# ──────────────────────────────────────────────────────────────────────────────
# ENVIRONMENT SETUP
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    """
    Configura variables de entorno para las pruebas.
    """
    os.environ["DISABLE_AUTH"] = "false"
    os.environ["SEED_ON_START"] = "false"
