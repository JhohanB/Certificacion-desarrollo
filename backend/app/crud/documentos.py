import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Revisión de documentos
# -------------------------------------------------------

def get_documento_by_id(db: Session, documento_id: int) -> Optional[dict]:
    """Obtiene un documento de solicitud por ID."""
    try:
        query = text("""
            SELECT
                sd.id, sd.solicitud_id, sd.documento_id,
                sd.archivo_url, sd.version, sd.es_version_activa,
                sd.estado_documento, sd.observaciones,
                sd.aprobado_por, sd.bloqueado, sd.fecha_subida,
                dr.nombre AS nombre_documento
            FROM solicitud_documentos sd
            INNER JOIN documentos_requeridos dr ON dr.id = sd.documento_id
            WHERE sd.id = :documento_id
            AND sd.es_version_activa = TRUE
        """)
        return db.execute(query, {"documento_id": documento_id}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener documento: {e}")
        raise


def revisar_documento(db: Session, documento_id: int, estado: str, observaciones: Optional[str], usuario_id: int) -> bool:
    """
    Aprueba u observa un documento.
    Si se aprueba, se bloquea el documento.
    Si se observa, se registran las observaciones y se desbloquea.
    """
    try:
        bloqueado = True if estado == "APROBADO" else False
        query = text("""
            UPDATE solicitud_documentos
            SET estado_documento = :estado,
                observaciones = :observaciones,
                aprobado_por = :usuario_id,
                fecha_revision = NOW(),
                bloqueado = :bloqueado
            WHERE id = :documento_id
            AND es_version_activa = TRUE
        """)
        db.execute(query, {
            "estado": estado,
            "observaciones": observaciones,
            "usuario_id": usuario_id,
            "bloqueado": bloqueado,
            "documento_id": documento_id
        })
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al revisar documento: {e}")
        raise


def todos_documentos_aprobados(db: Session, solicitud_id: int) -> bool:
    """
    Verifica si todos los documentos activos de una solicitud
    están en estado APROBADO.
    """
    try:
        query = text("""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN estado_documento = 'APROBADO' THEN 1 ELSE 0 END) AS aprobados
            FROM solicitud_documentos
            WHERE solicitud_id = :solicitud_id
            AND es_version_activa = TRUE
        """)
        result = db.execute(query, {"solicitud_id": solicitud_id}).mappings().first()
        return result["total"] > 0 and result["total"] == result["aprobados"]
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar documentos aprobados: {e}")
        raise


def hay_documentos_observados(db: Session, solicitud_id: int) -> bool:
    """
    Verifica si hay al menos un documento en estado OBSERVADO.
    """
    try:
        query = text("""
            SELECT COUNT(*) AS total
            FROM solicitud_documentos
            WHERE solicitud_id = :solicitud_id
            AND es_version_activa = TRUE
            AND estado_documento = 'OBSERVADO'
        """)
        result = db.execute(query, {"solicitud_id": solicitud_id}).mappings().first()
        return result["total"] > 0
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar documentos observados: {e}")
        raise


# -------------------------------------------------------
# Tokens de edición
# -------------------------------------------------------

def create_token_edicion(db: Session, solicitud_id: int, token: str) -> None:
    """
    Crea un token de edición para que el aprendiz pueda
    corregir sus documentos observados.
    Invalida tokens anteriores de la misma solicitud.
    """
    try:
        # Invalidar tokens anteriores
        query_invalidar = text("""
            UPDATE tokens_edicion
            SET usado = TRUE
            WHERE solicitud_id = :solicitud_id
            AND usado = FALSE
        """)
        db.execute(query_invalidar, {"solicitud_id": solicitud_id})

        # Crear nuevo token con expiración de 1 semana
        # NOW() ya usa timezone de Colombia (configurado en sesión MySQL)
        query = text("""
            INSERT INTO tokens_edicion (solicitud_id, token, usado, fecha_expiracion)
            VALUES (:solicitud_id, :token, FALSE, DATE_ADD(NOW(), INTERVAL 7 DAY))
        """)
        db.execute(query, {"solicitud_id": solicitud_id, "token": token})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear token de edición: {e}")
        raise


def get_token_edicion(db: Session, token: str) -> Optional[dict]:
    """Obtiene un token de edición por su valor."""
    try:
        query = text("""
            SELECT id, solicitud_id, token, usado, fecha_creacion, fecha_expiracion
            FROM tokens_edicion
            WHERE token = :token
        """)
        return db.execute(query, {"token": token}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener token: {e}")
        raise


def marcar_token_usado(db: Session, token: str) -> None:
    """Marca un token como usado al enviar la corrección."""
    try:
        query = text("""
            UPDATE tokens_edicion
            SET usado = TRUE, fecha_uso = NOW()
            WHERE token = :token
        """)
        db.execute(query, {"token": token})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al marcar token como usado: {e}")
        raise


def get_token_activo_solicitud(db: Session, solicitud_id: int) -> Optional[dict]:
    """Obtiene el token de edición activo (no usado) de una solicitud."""
    try:
        query = text("""
            SELECT token FROM tokens_edicion
            WHERE solicitud_id = :solicitud_id AND usado = FALSE
            ORDER BY fecha_creacion DESC LIMIT 1
        """)
        return db.execute(query, {"solicitud_id": solicitud_id}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener token activo: {e}")
        raise


def validar_token_expirado(db: Session, token: str) -> bool:
    """
    Valida si un token de edición ha expirado (más de 7 días).
    Usa zona horaria de Colombia (UTC-5) para la comparación.
    Retorna True si está expirado, False si aún es válido.
    """
    try:
        # NOW() ya usa timezone de Colombia (configurado en sesión MySQL)
        query = text("""
            SELECT 
                NOW() as hora_actual,
                fecha_expiracion
            FROM tokens_edicion
            WHERE token = :token
        """)
        result = db.execute(query, {"token": token}).mappings().first()
        
        if not result or not result["fecha_expiracion"]:
            return False
        
        hora_actual = result["hora_actual"]
        fecha_exp = result["fecha_expiracion"]
        
        # Comparar directamente: si hora_actual > fecha_expiracion, está expirado
        return hora_actual > fecha_exp
    except Exception as e:
        logger.error(f"Error al validar expiración de token: {e}")
        return False


# -------------------------------------------------------
# Corrección de documentos por aprendiz
# -------------------------------------------------------

def get_documentos_observados(db: Session, solicitud_id: int) -> list:
    """
    Obtiene los documentos en estado OBSERVADO de una solicitud.
    Se usa para mostrar al aprendiz qué debe corregir.
    """
    try:
        query = text("""
            SELECT
                sd.id, sd.documento_id, dr.nombre AS nombre_documento,
                sd.archivo_url, sd.version, sd.estado_documento,
                sd.observaciones, sd.fecha_subida
            FROM solicitud_documentos sd
            INNER JOIN documentos_requeridos dr ON dr.id = sd.documento_id
            WHERE sd.solicitud_id = :solicitud_id
            AND sd.es_version_activa = TRUE
            AND sd.estado_documento = 'OBSERVADO'
        """)
        return db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener documentos observados: {e}")
        raise


def reemplazar_documento(db: Session, solicitud_id: int, documento_id: int, nueva_url: str) -> None:
    """
    Reemplaza un documento observado con una nueva versión.
    - Marca la versión anterior como inactiva
    - Crea un nuevo registro con versión incrementada
    """
    try:
        # Obtener versión actual
        query_version = text("""
            SELECT version FROM solicitud_documentos
            WHERE solicitud_id = :solicitud_id
            AND documento_id = :documento_id
            AND es_version_activa = TRUE
        """)
        result = db.execute(query_version, {
            "solicitud_id": solicitud_id,
            "documento_id": documento_id
        }).mappings().first()

        version_actual = result["version"] if result else 1

        # Marcar versión anterior como inactiva
        query_desactivar = text("""
            UPDATE solicitud_documentos
            SET es_version_activa = FALSE
            WHERE solicitud_id = :solicitud_id
            AND documento_id = :documento_id
            AND es_version_activa = TRUE
        """)
        db.execute(query_desactivar, {
            "solicitud_id": solicitud_id,
            "documento_id": documento_id
        })

        # Crear nueva versión
        query_nueva = text("""
            INSERT INTO solicitud_documentos (
                solicitud_id, documento_id, archivo_url,
                version, es_version_activa, estado_documento
            ) VALUES (
                :solicitud_id, :documento_id, :nueva_url,
                :version, TRUE, 'PENDIENTE'
            )
        """)
        db.execute(query_nueva, {
            "solicitud_id": solicitud_id,
            "documento_id": documento_id,
            "nueva_url": nueva_url,
            "version": version_actual + 1
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al reemplazar documento: {e}")
        raise


# -------------------------------------------------------
# PDF consolidado
# -------------------------------------------------------

def update_pdf_consolidado(db: Session, solicitud_id: int, pdf_url: str, pdf_hash: str) -> None:
    """Guarda la URL y hash del PDF consolidado generado."""
    try:
        query = text("""
            UPDATE solicitudes
            SET pdf_consolidado_url = :pdf_url,
                pdf_hash = :pdf_hash,
                fecha_generacion_pdf = NOW()
            WHERE id = :solicitud_id
        """)
        db.execute(query, {
            "pdf_url": pdf_url,
            "pdf_hash": pdf_hash,
            "solicitud_id": solicitud_id
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar PDF consolidado: {e}")
        raise


# -------------------------------------------------------
# Firmas
# -------------------------------------------------------

def create_firmas_solicitud(db: Session, solicitud_id: int, tipo_programa_id: int, coordinador_id: int = None) -> None:
    """
    Crea los registros de firma para todos los roles firmantes
    activos del tipo de programa.
    Si se especifica coordinador_id, asigna ese usuario a la firma del COORDINADOR.
    """
    try:
        query_roles = text("""
            SELECT tpr.rol_id, tpr.orden_firma, r.nombre
            FROM tipo_programa_roles tpr
            INNER JOIN roles r ON r.id = tpr.rol_id
            WHERE tpr.tipo_programa_id = :tipo_programa_id
            AND tpr.obligatorio = TRUE
            AND r.activo = TRUE
        """)
        roles = db.execute(query_roles, {"tipo_programa_id": tipo_programa_id}).mappings().all()

        for rol in roles:
            usuario_id = None
            if rol["nombre"] == "COORDINADOR" and coordinador_id:
                usuario_id = coordinador_id

            query = text("""
                INSERT INTO firmas (solicitud_id, rol_id, estado_firma, usuario_id)
                VALUES (:solicitud_id, :rol_id, 'PENDIENTE', :usuario_id)
            """)
            db.execute(query, {
                "solicitud_id": solicitud_id,
                "rol_id": rol["rol_id"],
                "usuario_id": usuario_id
            })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear firmas: {e}")
        raise


def get_firmas_by_solicitud(db: Session, solicitud_id: int) -> list:
    """Obtiene todas las firmas de una solicitud con sus estados."""
    try:
        query = text("""
            SELECT
                f.id, f.solicitud_id, f.rol_id,
                r.nombre AS nombre_rol,
                f.usuario_id,
                u.nombre_completo AS nombre_usuario,
                f.estado_firma, f.tipo_rechazo,
                f.motivo_rechazo, f.fecha_firma
            FROM firmas f
            INNER JOIN roles r ON r.id = f.rol_id
            LEFT JOIN usuarios u ON u.id = f.usuario_id
            WHERE f.solicitud_id = :solicitud_id
            ORDER BY r.nombre ASC
        """)
        return db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener firmas: {e}")
        raise


def get_firma_by_solicitud_rol(db: Session, solicitud_id: int, rol_id: int) -> Optional[dict]:
    """Obtiene una firma específica por solicitud y rol."""
    try:
        query = text("""
            SELECT f.*, r.nombre AS nombre_rol, r.requiere_firma,
                   tpr.orden_firma
            FROM firmas f
            INNER JOIN roles r ON r.id = f.rol_id
            INNER JOIN tipo_programa_roles tpr ON tpr.rol_id = f.rol_id
            INNER JOIN solicitudes s ON s.id = f.solicitud_id
            AND tpr.tipo_programa_id = s.tipo_programa_id
            WHERE f.solicitud_id = :solicitud_id
            AND f.rol_id = :rol_id
        """)
        return db.execute(query, {
            "solicitud_id": solicitud_id,
            "rol_id": rol_id
        }).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener firma: {e}")
        raise


def get_orden_firma_rol(db: Session, solicitud_id: int, rol_id: int) -> Optional[int]:
    """
    Obtiene el orden_firma de un rol en el tipo de programa de la solicitud.
    """
    try:
        query = text("""
            SELECT tpr.orden_firma
            FROM tipo_programa_roles tpr
            INNER JOIN solicitudes s ON s.tipo_programa_id = tpr.tipo_programa_id
            WHERE s.id = :solicitud_id AND tpr.rol_id = :rol_id
            LIMIT 1
        """)
        result = db.execute(query, {"solicitud_id": solicitud_id, "rol_id": rol_id}).mappings().first()
        return result["orden_firma"] if result else None
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener orden de firma: {e}")
        raise


def todos_anteriores_firmaron(db: Session, solicitud_id: int, rol_id: int) -> bool:
    """
    Verifica si todos los roles con menor orden_firma ya firmaron.
    Roles con orden_firma = 0 pueden firmar en cualquier momento.
    Roles con orden_firma > 0 deben esperar a que todos los de menor orden hayan firmado.
    Roles con el mismo orden_firma pueden firmar entre ellos sin importar el orden.
    """
    try:
        # Obtener el orden del rol actual
        orden_actual = get_orden_firma_rol(db, solicitud_id, rol_id)

        # Si orden es 0 o NULL puede firmar siempre
        if orden_actual is None or orden_actual == 0:
            return True

        # Verificar que no haya firmas pendientes con orden menor al actual
        # orden_firma = 0 también cuenta como "anterior" a cualquier orden > 0
        query = text("""
            SELECT COUNT(*) AS pendientes
            FROM firmas f
            INNER JOIN tipo_programa_roles tpr ON tpr.rol_id = f.rol_id
            INNER JOIN solicitudes s ON s.tipo_programa_id = tpr.tipo_programa_id
            WHERE f.solicitud_id = :solicitud_id
            AND s.id = :solicitud_id
            AND f.rol_id != :rol_id
            AND f.estado_firma = 'PENDIENTE'
            AND tpr.orden_firma < :orden_actual
        """)
        result = db.execute(query, {
            "solicitud_id": solicitud_id,
            "rol_id": rol_id,
            "orden_actual": orden_actual
        }).mappings().first()
        return result["pendientes"] == 0
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar firmas anteriores: {e}")
        raise


def registrar_firma(db: Session, solicitud_id: int, rol_id: int, usuario_id: int, ip_origen: str) -> None:
    """Registra la firma de un funcionario en una solicitud."""
    try:
        query = text("""
            UPDATE firmas
            SET estado_firma = 'FIRMADO',
                usuario_id = :usuario_id,
                fecha_firma = NOW(),
                ip_origen = :ip_origen,
                motivo_rechazo = NULL
            WHERE solicitud_id = :solicitud_id
            AND rol_id = :rol_id
        """)
        db.execute(query, {
            "usuario_id": usuario_id,
            "ip_origen": ip_origen,
            "solicitud_id": solicitud_id,
            "rol_id": rol_id
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al registrar firma: {e}")
        raise


def registrar_rechazo_firma(db: Session, solicitud_id: int, rol_id: int, usuario_id: int, motivo: str, tipo_rechazo: str, ip_origen: str) -> None:
    try:
        query = text("""
            UPDATE firmas 
            SET estado_firma = 'RECHAZADO',
                motivo_rechazo = :motivo,
                tipo_rechazo = :tipo_rechazo,
                usuario_id = :usuario_id,
                fecha_firma = NOW(),
                ip_origen = :ip_origen
            WHERE solicitud_id = :solicitud_id
            AND rol_id = :rol_id
            AND estado_firma = 'PENDIENTE'
        """)
        db.execute(query, {
            "solicitud_id": solicitud_id,
            "rol_id": rol_id,
            "usuario_id": usuario_id,
            "motivo": motivo,
            "tipo_rechazo": tipo_rechazo,
            "ip_origen": ip_origen
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al registrar rechazo: {e}")
        raise


def reiniciar_firmas(db: Session, solicitud_id: int) -> None:
    """
    Reinicia todas las firmas a PENDIENTE.
    Se llama cuando un firmante rechaza por ERROR_DOCUMENTOS
    y el aprendiz corrige, ya que el PDF cambia.
    """
    try:
        query = text("""
            UPDATE firmas
            SET estado_firma = 'PENDIENTE',
                usuario_id = NULL,
                fecha_firma = NULL,
                ip_origen = NULL,
                motivo_rechazo = NULL
            WHERE solicitud_id = :solicitud_id
        """)
        db.execute(query, {"solicitud_id": solicitud_id})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al reiniciar firmas: {e}")
        raise


def reiniciar_firma_individual(db: Session, solicitud_id: int, rol_id: int) -> None:
    """
    Reinicia solo la firma del rol que rechazó.
    Se llama cuando el rechazo fue por OTRA_RAZON
    y el aprendiz resuelve el inconveniente.
    """
    try:
        query = text("""
            UPDATE firmas
            SET estado_firma = 'PENDIENTE',
                usuario_id = NULL,
                fecha_firma = NULL,
                ip_origen = NULL,
                motivo_rechazo = NULL
            WHERE solicitud_id = :solicitud_id
            AND rol_id = :rol_id
        """)
        db.execute(query, {
            "solicitud_id": solicitud_id,
            "rol_id": rol_id
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al reiniciar firma individual: {e}")
        raise


def todas_firmas_completadas(db: Session, solicitud_id: int) -> bool:
    """
    Verifica si todos los roles activos han firmado.
    Se usa para cambiar el estado a PENDIENTE_CERTIFICACION.
    """
    try:
        query = text("""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN f.estado_firma = 'FIRMADO' THEN 1 ELSE 0 END) AS firmadas
            FROM firmas f
            INNER JOIN roles r ON r.id = f.rol_id
            WHERE f.solicitud_id = :solicitud_id
            AND r.activo = TRUE
        """)
        result = db.execute(query, {"solicitud_id": solicitud_id}).mappings().first()
        return result["total"] > 0 and result["total"] == result["firmadas"]
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar firmas completadas: {e}")
        raise


def reubicar_documento(db: Session, documento_id: int, nuevo_documento_id: int) -> bool:
    """
    Reasigna el documento_id de un archivo ya subido.
    Si ya existe un archivo en el destino, los intercambia.
    """
    try:
        # Obtener documento actual
        query_doc = text("""
            SELECT solicitud_id, documento_id, es_version_activa
            FROM solicitud_documentos
            WHERE id = :documento_id
            AND es_version_activa = TRUE
        """)
        doc = db.execute(query_doc, {"documento_id": documento_id}).mappings().first()
        if not doc:
            return False

        solicitud_id = doc["solicitud_id"]
        documento_id_actual = doc["documento_id"]

        # Verificar que el nuevo_documento_id es válido para ese tipo de programa
        query_valido = text("""
            SELECT tpd.documento_id
            FROM tipo_programa_documentos tpd
            INNER JOIN solicitudes s ON s.tipo_programa_id = tpd.tipo_programa_id
            WHERE s.id = :solicitud_id
            AND tpd.documento_id = :nuevo_documento_id
        """)
        valido = db.execute(query_valido, {
            "solicitud_id": solicitud_id,
            "nuevo_documento_id": nuevo_documento_id
        }).first()

        if not valido:
            return False

        # Verificar si ya existe un archivo en el destino
        query_existe = text("""
            SELECT id, estado_documento FROM solicitud_documentos
            WHERE solicitud_id = :solicitud_id
            AND documento_id = :nuevo_documento_id
            AND es_version_activa = TRUE
        """)
        destino = db.execute(query_existe, {
            "solicitud_id": solicitud_id,
            "nuevo_documento_id": nuevo_documento_id
        }).mappings().first()

        if destino:
            # Intercambiar — el destino toma el documento_id del origen
            query_swap = text("""
                UPDATE solicitud_documentos
                SET documento_id = :documento_id_actual,
                    estado_documento = 'PENDIENTE',
                    observaciones = NULL,
                    bloqueado = FALSE
                WHERE id = :destino_id
            """)
            db.execute(query_swap, {
                "documento_id_actual": documento_id_actual,
                "destino_id": destino["id"]
            })

        # Mover el origen al nuevo destino
        query_update = text("""
            UPDATE solicitud_documentos
            SET documento_id = :nuevo_documento_id,
                estado_documento = 'PENDIENTE',
                observaciones = NULL,
                bloqueado = FALSE
            WHERE id = :documento_id
        """)
        db.execute(query_update, {
            "nuevo_documento_id": nuevo_documento_id,
            "documento_id": documento_id
        })
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al reubicar documento: {e}")
        raise


def get_firmas_con_imagen(db: Session, solicitud_id: int) -> list:
    """
    Obtiene las firmas completadas de una solicitud
    incluyendo la imagen de firma de cada funcionario.
    """
    try:
        query = text("""
            SELECT
                f.rol_id,
                u.nombre_completo,
                u.firma_url
            FROM firmas f
            INNER JOIN usuarios u ON u.id = f.usuario_id
            WHERE f.solicitud_id = :solicitud_id
              AND f.estado_firma = 'FIRMADO'
        """)
        return db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener firmas con imagen: {e}")
        raise