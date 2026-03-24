import logging
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# -------------------------------------------------------
# Acciones de auditoría
# -------------------------------------------------------
LOGIN_EXITOSO          = "LOGIN_EXITOSO"
LOGIN_FALLIDO          = "LOGIN_FALLIDO"
CAMBIO_PASSWORD        = "CAMBIO_PASSWORD"
USUARIO_CREADO         = "USUARIO_CREADO"
USUARIO_ACTIVADO       = "USUARIO_ACTIVADO"
USUARIO_DESACTIVADO    = "USUARIO_DESACTIVADO"
FIRMA_REGISTRADA       = "FIRMA_REGISTRADA"
DOCUMENTO_APROBADO     = "DOCUMENTO_APROBADO"
DOCUMENTO_OBSERVADO    = "DOCUMENTO_OBSERVADO"
DOCUMENTO_REUBICADO    = "DOCUMENTO_REUBICADO"
SOLICITUD_FIRMADA      = "SOLICITUD_FIRMADA"
FIRMA_RECHAZADA        = "FIRMA_RECHAZADA"
SOLICITUD_CERTIFICADA  = "SOLICITUD_CERTIFICADA"
PLANTILLA_SUBIDA       = "PLANTILLA_SUBIDA"
PLANTILLA_ACTIVADA     = "PLANTILLA_ACTIVADA"
COORDENADAS_GUARDADAS  = "COORDENADAS_GUARDADAS"
OBSERVACIONES_ENVIADAS = "OBSERVACIONES_ENVIADAS"
TOKEN_GENERADO         = "TOKEN_GENERADO"


def registrar(
    db: Session,
    accion: str,
    tabla_afectada: str,
    registro_id: int = None,
    descripcion: str = None,
    usuario_id: int = None,
    ip_origen: str = None,
) -> None:
    """
    Registra un evento en la tabla de auditoría.
    Los errores se loguean pero no detienen el flujo principal.
    """
    try:
        query = text("""
            INSERT INTO auditoria (
                usuario_id, accion, tabla_afectada,
                registro_id, descripcion, ip_origen
            ) VALUES (
                :usuario_id, :accion, :tabla_afectada,
                :registro_id, :descripcion, :ip_origen
            )
        """)
        db.execute(query, {
            "usuario_id": usuario_id,
            "accion": accion,
            "tabla_afectada": tabla_afectada,
            "registro_id": registro_id,
            "descripcion": descripcion,
            "ip_origen": ip_origen,
        })
        db.commit()
    except Exception as e:
        logger.error(f"Error al registrar auditoría [{accion}]: {e}")