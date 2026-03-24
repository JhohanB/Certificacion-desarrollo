from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# -------------------------------------------------------
# Coordenadas de firma
# -------------------------------------------------------

class CoordenadaFirmaCreate(BaseModel):
    rol_id: int
    pagina: int = Field(default=1, ge=1)
    # Coordenadas de la imagen de firma
    x_porcentaje: float = Field(ge=0.0, le=100.0)
    y_porcentaje: float = Field(ge=0.0, le=100.0)
    ancho_porcentaje: float = Field(ge=0.1, le=100.0)
    alto_porcentaje: float = Field(ge=0.1, le=100.0)
    # Coordenadas del campo de nombre del funcionario
    nombre_x_porcentaje: float = Field(ge=0.0, le=100.0)
    nombre_y_porcentaje: float = Field(ge=0.0, le=100.0)
    nombre_ancho_porcentaje: float = Field(ge=0.1, le=100.0)
    nombre_alto_porcentaje: float = Field(ge=0.1, le=100.0)


class CoordenadaFirmaOut(BaseModel):
    id: int
    rol_id: int
    nombre_rol: str
    pagina: int
    x_porcentaje: float
    y_porcentaje: float
    ancho_porcentaje: float
    alto_porcentaje: float
    nombre_x_porcentaje: float
    nombre_y_porcentaje: float
    nombre_ancho_porcentaje: float
    nombre_alto_porcentaje: float


# -------------------------------------------------------
# Plantilla de formato
# -------------------------------------------------------

class PlantillaOut(BaseModel):
    id: int
    version: str
    archivo_url: str
    activa: bool
    creado_en: datetime
    coordenadas: List[CoordenadaFirmaOut] = []


class PlantillaListOut(BaseModel):
    id: int
    version: str
    activa: bool
    archivo_url: Optional[str] = None
    creado_en: datetime