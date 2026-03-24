import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from core.config import settings
from app.utils.email_templates import (
    template_solicitud_recibida,
    template_observaciones_completas,
    template_solicitud_certificada,
    template_bienvenida_funcionario,
)

from app.utils.email_templates import (
    template_solicitud_recibida,
    template_observaciones_completas,
    template_solicitud_certificada,
    template_bienvenida_funcionario,
    template_restablecer_password,
)

logger = logging.getLogger(__name__)

# -------------------------------------------------------
# Configuración de conexión
# -------------------------------------------------------

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_FROM_NAME="SENA Certificaciones",
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

fm = FastMail(conf)


async def _enviar(
    destinatario: str,
    asunto: str,
    html: str,
    solicitud_id: int = None,
    tipo_notificacion: str = None,
    db=None
) -> None:
    """
    Función base para enviar correo HTML y registrar en notificaciones_email.
    Los errores se loguean pero no detienen el flujo principal.
    """
    enviado = False
    error_msg = None

    try:
        message = MessageSchema(
            subject=asunto,
            recipients=[destinatario],
            body=html,
            subtype=MessageType.html,
        )
        await fm.send_message(message)
        enviado = True
        logger.info(f"Correo enviado a {destinatario} — asunto: {asunto}")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error al enviar correo a {destinatario}: {e}")

    # Registrar en BD si se tiene solicitud_id y db
    if solicitud_id and tipo_notificacion and db:
        try:
            from sqlalchemy import text
            query = text("""
                INSERT INTO notificaciones_email (
                    solicitud_id, destinatario, tipo_notificacion,
                    asunto, enviado, fecha_envio, error_mensaje
                ) VALUES (
                    :solicitud_id, :destinatario, :tipo_notificacion,
                    :asunto, :enviado, NOW(), :error_mensaje
                )
            """)
            db.execute(query, {
                "solicitud_id": solicitud_id,
                "destinatario": destinatario,
                "tipo_notificacion": tipo_notificacion,
                "asunto": asunto,
                "enviado": enviado,
                "error_mensaje": error_msg,
            })
            db.commit()
        except Exception as e:
            logger.error(f"Error al registrar notificación en BD: {e}")


# -------------------------------------------------------
# Correos al aprendiz
# -------------------------------------------------------

async def enviar_confirmacion_solicitud(
    correo: str,
    nombre: str,
    programa: str,
    ficha: str,
    tipo_programa: str,
    numero_documento: str = None,
    solicitud_id: int = None,
    db=None,
) -> None:
    html = template_solicitud_recibida(
        nombre=nombre,
        programa=programa,
        ficha=ficha,
        tipo_programa=tipo_programa,
        frontend_url=settings.FRONTEND_URL,
        numero_documento=numero_documento,
    )
    await _enviar(
        correo, "SENA - Tu solicitud de certificación fue recibida", html,
        solicitud_id=solicitud_id, tipo_notificacion="SOLICITUD_RECIBIDA", db=db
    )


async def enviar_observaciones_completas(
    correo: str,
    nombre: str,
    programa: str,
    docs_observados: list,
    token: str,
    nombre_funcionario: str = None,
    observaciones_generales: str = None,
    solicitud_id: int = None,
    db=None,
) -> None:
    link_edicion = f"{settings.FRONTEND_URL}/corregir/{token}"
    html = template_observaciones_completas(
        nombre=nombre,
        programa=programa,
        docs_observados=docs_observados,
        link_edicion=link_edicion,
        nombre_funcionario=nombre_funcionario,
        observaciones_generales=observaciones_generales,
    )
    await _enviar(
        correo, "SENA - Tu solicitud requiere correcciones", html,
        solicitud_id=solicitud_id, tipo_notificacion="OBSERVACIONES_ENVIADAS", db=db
    )


async def enviar_certificacion_completada(
    correo: str,
    nombre: str,
    programa: str,
    solicitud_id: int = None,
    db=None,
) -> None:
    html = template_solicitud_certificada(
        nombre=nombre,
        programa=programa,
        frontend_url=settings.FRONTEND_URL,
    )
    await _enviar(
        correo, "SENA - ¡Felicitaciones, fuiste certificado!", html,
        solicitud_id=solicitud_id, tipo_notificacion="CERTIFICACION_COMPLETADA", db=db
    )


async def enviar_notificacion_rechazo_externo(
    correo: str, nombre: str, programa: str,
    motivo: str, nombre_funcionario_rechazo: str,
    correo_funcionario_rechazo: str,
    solicitud_id: int = None, db=None
) -> None:
    from app.utils.email_templates import template_notificacion_rechazo_externo
    html = template_notificacion_rechazo_externo(
        nombre=nombre, programa=programa, motivo=motivo,
        nombre_funcionario_rechazo=nombre_funcionario_rechazo,
        correo_funcionario_rechazo=correo_funcionario_rechazo
    )
    await _enviar(
        correo, "SENA - Notificación sobre tu solicitud", html,
        solicitud_id=solicitud_id, tipo_notificacion="NOTIFICACION_RECHAZO_EXTERNO", db=db
    )

# -------------------------------------------------------
# Correos a funcionarios
# -------------------------------------------------------

async def enviar_bienvenida_funcionario(
    correo: str,
    nombre: str,
    password_temporal: str,
) -> None:
    html = template_bienvenida_funcionario(
        nombre=nombre,
        correo=correo,
        password_temporal=password_temporal,
        frontend_url=settings.FRONTEND_URL,
    )
    # Bienvenida no tiene solicitud_id
    await _enviar(correo, "SENA - Bienvenido al sistema de certificaciones", html)


async def enviar_restablecer_password(
    correo: str,
    nombre: str,
    password_temporal: str,
) -> None:
    html = template_restablecer_password(
        nombre=nombre,
        correo=correo,
        password_temporal=password_temporal,
        frontend_url=settings.FRONTEND_URL,
    )
    await _enviar(correo, "SENA - Restablecimiento de contraseña", html)