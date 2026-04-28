from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# -------------------------------------------------------
# Enums
# -------------------------------------------------------

class TipoDocumento(str, Enum):
    CC = "CC"
    CE = "CE"
    TI = "TI"
    PA = "PA"
    PEP = "PEP"
    PPT = "PPT"


class EstadoSolicitud(str, Enum):
    PENDIENTE_REVISION = "PENDIENTE_REVISION"
    CON_OBSERVACIONES = "CON_OBSERVACIONES"
    CORREGIDO = "CORREGIDO"
    PENDIENTE_FIRMAS = "PENDIENTE_FIRMAS"
    PENDIENTE_CERTIFICACION = "PENDIENTE_CERTIFICACION"
    CERTIFICADO = "CERTIFICADO"


class EstadoDocumento(str, Enum):
    PENDIENTE = "PENDIENTE"
    OBSERVADO = "OBSERVADO"
    APROBADO = "APROBADO"


# -------------------------------------------------------
# Datos básicos de la solicitud
# El aprendiz los llena en el formulario
# Los documentos se manejan como archivos en el endpoint
# -------------------------------------------------------

class SolicitudCreate(BaseModel):
    tipo_documento: TipoDocumento
    numero_documento: str = Field(min_length=3, max_length=20)
    numero_ficha: str = Field(min_length=3, max_length=30)
    nombre_aprendiz: str = Field(min_length=3, max_length=150)
    correo_aprendiz: EmailStr
    confirmar_correo: EmailStr
    telefono_aprendiz: Optional[str] = Field(default=None, min_length=7, max_length=20)
    tipo_programa_id: int
    nombre_programa: str = Field(min_length=3, max_length=150)

    @model_validator(mode="after")
    def validar_correos(self):
        if self.correo_aprendiz != self.confirmar_correo:
            raise ValueError("Los correos no coinciden")
        return self


# -------------------------------------------------------
# Consulta de solicitud por parte del aprendiz
# No requiere login, solo documento + ficha
# -------------------------------------------------------

class SolicitudConsulta(BaseModel):
    numero_documento: str = Field(min_length=5, max_length=20)
    numero_ficha: str = Field(min_length=3, max_length=30)


# -------------------------------------------------------
# Actualización de datos del programa por funcionario
# Solo puede modificar tipo_programa_id, numero_ficha
# y nombre_programa, NO los datos personales ni documentos
# -------------------------------------------------------

class SolicitudUpdateFuncionario(BaseModel):
    numero_ficha: Optional[str] = Field(default=None, min_length=3, max_length=30)
    nombre_programa: Optional[str] = Field(default=None, min_length=3, max_length=150)
    observaciones_generales: Optional[str] = None


class SolicitudUpdateAprendiz(BaseModel):
    """
    Datos que el aprendiz puede corregir cuando el funcionario
    solicita cambio de tipo de programa.
    """
    tipo_programa_id: int
    nombre_programa: str = Field(min_length=3, max_length=150)
    numero_ficha: str = Field(min_length=3, max_length=30)


# -------------------------------------------------------
# Corrección de datos por aprendiz con token
# -------------------------------------------------------

class CorreccionDatosAprendiz(BaseModel):
    tipo_programa_id: Optional[int] = None
    nombre_programa: Optional[str] = Field(default=None, min_length=3, max_length=150)
    numero_ficha: Optional[str] = Field(default=None, min_length=3, max_length=30)
    nombre_aprendiz: Optional[str] = Field(default=None, min_length=3, max_length=150)
    tipo_documento: Optional[TipoDocumento] = None
    numero_documento: Optional[str] = Field(default=None, min_length=3, max_length=20)


# -------------------------------------------------------
# Documento de solicitud
# -------------------------------------------------------

class DocumentoSolicitudOut(BaseModel):
    id: int
    documento_id: int
    nombre_documento: str
    archivo_url: str
    version: int
    es_version_activa: bool
    estado_documento: EstadoDocumento
    observaciones: Optional[str] = None
    bloqueado: bool
    fecha_subida: datetime


# -------------------------------------------------------
# Respuesta de solicitud completa
# -------------------------------------------------------

class SolicitudOut(BaseModel):
    id: int
    numero_documento: str
    numero_ficha: str
    nombre_aprendiz: str
    correo_aprendiz: str
    telefono_aprendiz: Optional[str] = None
    tipo_programa_id: int
    nombre_tipo_programa: str
    nombre_programa: str
    estado_actual: EstadoSolicitud
    observaciones_generales: Optional[str] = None
    plantilla_id: Optional[int] = None
    pdf_consolidado_url: Optional[str] = None
    fecha_solicitud: datetime
    documentos_eliminados: bool = False
    fecha_eliminacion_documentos: Optional[datetime] = None
    documentos: List[DocumentoSolicitudOut] = []   

# -------------------------------------------------------
# Respuesta reducida para consulta del aprendiz
# Muestra solo lo necesario sin exponer datos internos
# -------------------------------------------------------

class SolicitudConsultaOut(BaseModel):
    numero_documento: str
    numero_ficha: str
    nombre_aprendiz: str
    telefono_aprendiz: Optional[str] = None
    nombre_programa: str
    estado_actual: EstadoSolicitud
    observaciones_generales: Optional[str] = None
    fecha_solicitud: datetime
    documentos: List[DocumentoSolicitudOut] = []


# -------------------------------------------------------
# Respuesta para lista de solicitudes (panel funcionario)
# -------------------------------------------------------

class SolicitudListOut(BaseModel):
    id: int
    numero_documento: str
    numero_ficha: str
    nombre_aprendiz: str
    nombre_programa: str
    correo_aprendiz: Optional[str] = None
    nombre_tipo_programa: str
    estado_actual: EstadoSolicitud
    pdf_consolidado_url: Optional[str] = None
    fecha_solicitud: datetime
    documentos_eliminados: bool = False
    ya_firme: Optional[bool] = False
    es_mi_firma: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------
# Eliminación de documentos de solicitudes certificadas
# -------------------------------------------------------

class EliminarDocumentosSolicitudRequest(BaseModel):
    """
    Request para eliminar documentos de múltiples solicitudes.
    Solo se pueden eliminar solicitudes con estado CERTIFICADO
    y que aún tengan documentos (documentos_eliminados = False)
    """
    solicitud_ids: List[int] = Field(min_items=1)
    password: str = Field(min_length=1)


class SolicitudEliminada(BaseModel):
    """Información de una solicitud con documentos eliminados"""
    solicitud_id: int
    numero_documento: str
    numero_ficha: str
    nombre_aprendiz: str
    documentos_cantidad: int
    documentos_eliminados: int
    estado: str  # "éxito" o "error"
    mensaje: Optional[str] = None


class EliminarDocumentosSolicitudResponse(BaseModel):
    """Response con el resultado de la operación"""
    total_solicitudes: int
    exitosas: int
    fallidas: int
    detalles: List[SolicitudEliminada]
    mensaje_resumen: str