from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Optional
from datetime import date, datetime
from typing_extensions import Literal
import enum

EntidadPerm = Literal["captura_reportes", "reportes_seguimiento"]
class UserPasswordReset(BaseModel):
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ---------------- Plan (padre) ----------------
class PlanBase(BaseModel):
    num_plan_mejora:  Optional[str] = None
    nombre_entidad: str
    observacion_calidad: Optional[str] = None
    insumo_mejora: Optional[str] = None
    tipo_accion_mejora: Optional[str] = None
    accion_mejora_planteada: Optional[str] = None
    observacion_informe_calidad: Optional[str] = None
    descripcion_actividades: Optional[str] = None
    evidencia_cumplimiento: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_final: Optional[date] = None
    seguimiento: Optional[str] = None
    enlace_entidad: Optional[str] = None
    estado: Optional[str] = "Pendiente"
    indicador: Optional[str] = None
    criterio: Optional[str] = None
    aprobado_evaluador: Optional[str] = None

class PlanCreate(PlanBase):
    pass

class PlanUpdate(PlanBase):
    pass

class PlanOut(PlanBase):
    id: int
    created_by: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# ---------- Users (Admin only) ----------
UserRoleInput = Literal["admin", "entidad", "auditor"]

class EntidadPermUpdate(BaseModel):
    entidad_perm: EntidadPerm

class EntidadAuditorUpdate(BaseModel):
    entidad_auditor: bool

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRoleInput
    entidad_perm: Optional[EntidadPerm] = None
    entidad_auditor: Optional[bool] = False
    entidad: str

class UserRoleUpdate(BaseModel):
    role: UserRoleInput

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: Literal["admin", "entidad", "auditor", "ciudadano"]
    entidad_perm: Optional[EntidadPerm] = None
    entidad_auditor: Optional[bool] = False
    entidad: str
    class Config:
        from_attributes = True
    # 🔧 Convierte Enum -> string antes de validar
    @field_validator("role", mode="before")
    @classmethod
    def _cast_enum_role(cls, v):
        return v.value if isinstance(v, enum.Enum) else v

# ---------------- Seguimiento (hijo) ----------------
class SeguimientoBase(BaseModel):
    ajuste_de_id: Optional[int] = None
    observacion_informe_calidad: Optional[str] = None
    insumo_mejora: Optional[str] = None
    tipo_accion_mejora: Optional[str] = None
    accion_mejora_planteada: Optional[str] = None
    descripcion_actividades: Optional[str] = None
    evidencia_cumplimiento: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_final: Optional[date] = None
    seguimiento: Optional[str] = "Pendiente"
    enlace_entidad: Optional[str] = None
    observacion_calidad: Optional[str] = None  # auditor/admin
    indicador: Optional[str] = None
    criterio: Optional[str] = None

class SeguimientoCreate(SeguimientoBase):
    pass


class SeguimientoUpdate(SeguimientoBase):
    pass

class SeguimientoOut(SeguimientoBase):
    id: int
    plan_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    updated_by_email: Optional[str] = None  
    updated_by_entidad: Optional[str] = None  
    model_config = ConfigDict(from_attributes=True)   


# ---------------- Reporte (padre) ----------------
class ReportBase(BaseModel):
    entidad: Optional[str] = None
    indicador: Optional[str] = None
    criterio: Optional[str] = None
    accion: Optional[str] = None
    insumo: Optional[str] = None
    
class ReporteEntrada(ReportBase):
    pass

class ReporteEntradaLista(BaseModel):
    reportes: list[ReporteEntrada]


# ---------------- PQRDS (padre) ----------------
class PqrdBase(BaseModel):
    label: str
    tipo_gestion: Optional[str] = None
    dependencia: Optional[str] = None
    entidad: Optional[str] = None
    fecha_ingreso: Optional[date] = None
    periodo: Optional[str] = None

    @field_validator("fecha_ingreso", mode="before")
    def empty_string_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class PqrdCreate(PqrdBase):
    pass

class PqrdUpdate(PqrdBase):
    pass

class PqrdEntradaLista(BaseModel):
    pqrds: list[PqrdCreate]


# --------------- Habilidades (Padre) ----------------
class HabilidadBase(BaseModel):
    anio: int
    mes: int
    id_entidad: int
    entidad: Optional[str] = None
    pct_habilidades_tecnicas: Optional[int] = None
    num_capacitados_tecnicas: Optional[int] = None
    pct_habilidades_socioemocionales: Optional[int] = None
    num_capacitados_socioemocionales: Optional[int] = None

class HabilidadCreate(HabilidadBase):
    pass

class HabilidadEntradaLista(BaseModel):
    habilidades: list[HabilidadBase]
