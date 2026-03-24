from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List


# -------------------------------------------------------
# Tipos de programa
# -------------------------------------------------------

class TipoProgramaCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    descripcion: Optional[str] = None


class TipoProgramaUpdate(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    descripcion: Optional[str] = None


class TipoProgramaOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    activo: bool = True
    total_documentos: int = 0
    total_roles: int = 0

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------
# Documentos requeridos
# -------------------------------------------------------

class DocumentoRequeridoCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    descripcion: Optional[str] = None


class DocumentoRequeridoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    descripcion: Optional[str] = None


class DocumentoRequeridoOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None


# -------------------------------------------------------
# Relación tipo_programa - documentos
# -------------------------------------------------------

class AsignarDocumentoCreate(BaseModel):
    documento_id: int
    obligatorio: bool = True


class TipoProgramaDocumentoOut(BaseModel):
    id: int
    documento_id: int
    nombre_documento: str
    obligatorio: bool


# -------------------------------------------------------
# Relación tipo_programa - roles firmantes
# -------------------------------------------------------

class AsignarRolFirmanteCreate(BaseModel):
    rol_id: int
    orden_firma: int = Field(ge=0, description="Orden en que debe firmar el rol. 0 = libre")
    obligatorio: bool = True


class TipoProgramaRolOut(BaseModel):
    id: int
    rol_id: int
    nombre_rol: str
    orden_firma: Optional[int] = None
    obligatorio: bool


# -------------------------------------------------------
# Tipo de programa completo con relaciones
# -------------------------------------------------------

class TipoProgramaDetalleOut(BaseModel):
    id: int
    nombre: str
    documentos: List[TipoProgramaDocumentoOut] = []
    roles_firmantes: List[TipoProgramaRolOut] = []