from pydantic import BaseModel, Field
from typing import Optional, List


# -------------------------------------------------------
# Roles
# -------------------------------------------------------

class RolCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    descripcion: Optional[str] = None
    requiere_firma: bool = False


class RolUpdate(BaseModel):
    descripcion: Optional[str] = None
    requiere_firma: Optional[bool] = None


class RolOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    requiere_firma: bool
    es_coordinador: bool = False
    es_funcionario_revision: bool = False
    es_admin: bool = False
    activo: bool


# -------------------------------------------------------
# Módulos y acciones
# -------------------------------------------------------

class ModuloOut(BaseModel):
    id: int
    nombre: str


class AccionOut(BaseModel):
    id: int
    nombre: str


# -------------------------------------------------------
# Permisos
# -------------------------------------------------------

class PermisoCreate(BaseModel):
    modulo_id: int
    accion_id: int


class PermisoOut(BaseModel):
    id: int
    modulo_id: int
    nombre_modulo: str
    accion_id: int
    nombre_accion: str


class RolConPermisos(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    requiere_firma: bool
    activo: bool
    permisos: List[PermisoOut] = []