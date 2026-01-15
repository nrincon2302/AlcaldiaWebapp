from sqlalchemy import Column, Integer, String, Text, Date, Enum, ForeignKey, DateTime, Boolean, select
from sqlalchemy.orm import relationship, column_property
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
from app.database import Base
import enum
import uuid


class UserRole(str, enum.Enum):
    admin = "admin"
    entidad = "entidad"
    auditor = "auditor"
    ciudadano = "ciudadano"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.entidad)
    entidad_perm = Column(String(32), nullable=True)
    entidad_auditor = Column(Boolean, nullable=False, default=False)
    entidad = Column(String, nullable=False) 

class PlanAccion(Base):
    __tablename__ = "plan_accion"
    id = Column(Integer, primary_key=True, index=True)
    num_plan_mejora = Column(String(50), nullable=False, default=lambda: str(uuid.uuid4())[:8])
    nombre_entidad = Column(String(255), nullable=False)
    insumo_mejora = Column(String(255), nullable=True)
    tipo_accion_mejora = Column(String(255), nullable=True)
    accion_mejora_planteada = Column(Text, nullable=True)
    observacion_informe_calidad = Column(Text, nullable=True)
    descripcion_actividades = Column(Text, nullable=True)
    evidencia_cumplimiento = Column(Text, nullable=True)
    fecha_inicio = Column(Date, nullable=True)
    fecha_final = Column(Date, nullable=True)
    seguimiento = Column(String(255), nullable=True)
    enlace_entidad = Column(Text, nullable=True)
    # auditor
    observacion_calidad = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    estado = Column(String(50), nullable=True, default="Pendiente")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    indicador = Column(String(255), nullable=True)
    
    criterio = Column(String(255), nullable=True) 
    aprobado_evaluador = Column(String(50), nullable=True)
    seguimientos = relationship(
        "Seguimiento",
        back_populates="plan",
        cascade="all, delete-orphan",
    )

class Seguimiento(Base):
    __tablename__ = "seguimiento"
    id = Column(Integer, primary_key=True)
    ajuste_de_id = Column(Integer, ForeignKey("seguimiento.id"), nullable=True)
    indicador = Column(String, nullable=True)
    observacion_informe_calidad = Column(Text, nullable=True)
    plan_id = Column(Integer, ForeignKey("plan_accion.id"), nullable=False)
    
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    plan = relationship("PlanAccion", back_populates="seguimientos")

    observacion_calidad = Column(Text, nullable=True)

    insumo_mejora = Column(String(255), nullable=True)
    tipo_accion_mejora = Column(String(255), nullable=True)
    accion_mejora_planteada = Column(Text, nullable=True)
    descripcion_actividades = Column(Text, nullable=True)
    evidencia_cumplimiento = Column(Text, nullable=True)
    fecha_inicio = Column(Date, nullable=True)
    fecha_final = Column(Date, nullable=True)
    seguimiento = Column(String(255), nullable=True)
    enlace_entidad = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def updated_by_email(self) -> str | None:
        return self.updated_by.email if self.updated_by else None
    @property
    def updated_by_entidad(self) -> str | None:
        return self.updated_by.entidad if self.updated_by else None


# Creación de clase Reporte para almacenar datos de automatización de reportes
class Reporte(Base):
    __tablename__ = "reportes"
    id = Column(Integer, primary_key=True, index=True)
    entidad = Column(Text, nullable=False)
    indicador = Column(Text, nullable=False)
    criterio = Column(Text, nullable=False)
    accion = Column(Text, nullable=False)
    insumo = Column(Text, nullable=True)

# Clase de PQRDS
class PQRD(Base):
    __tablename__ = "pqrds"
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(255), nullable=False)
    tipo_gestion = Column(String(255), nullable=False)
    dependencia = Column(String(255), nullable=False)
    entidad = Column(String(255), nullable=False)
    fecha_ingreso = Column(Date, nullable=False)
    periodo = Column(String(50), nullable=True)

# Clase de habilidades
class Habilidad(Base):
    __tablename__ = "habilidades"
    id = Column(Integer, primary_key=True, index=True)
    anio = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)
    id_entidad = Column(Integer, nullable=False)
    entidad = Column(String(255))
    pct_habilidades_tecnicas = Column(Integer)
    num_capacitados_tecnicas = Column(Integer)
    pct_habilidades_socioemocionales = Column(Integer)
    num_capacitados_socioemocionales = Column(Integer)

@hybrid_property
def updated_by_email(self):
    return self.updated_by.email if self.updated_by else None
