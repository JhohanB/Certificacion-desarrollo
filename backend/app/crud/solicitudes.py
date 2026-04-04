import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Crear solicitud
# -------------------------------------------------------

def create_solicitud(db: Session, datos: dict) -> int:
    """
    Crea una nueva solicitud con estado PENDIENTE_REVISION.

    Args:
        datos: Diccionario con los campos de la solicitud.

    Returns:
        int: ID de la solicitud creada.
    """
    try:
        query = text("""
            INSERT INTO solicitudes (
                numero_documento, numero_ficha, nombre_aprendiz,
                correo_aprendiz, telefono_aprendiz, tipo_programa_id, nombre_programa,
                estado_actual
            ) VALUES (
                :numero_documento, :numero_ficha, :nombre_aprendiz,
                :correo_aprendiz, :telefono_aprendiz, :tipo_programa_id, :nombre_programa,
                'PENDIENTE_REVISION'
            )
        """)
        result = db.execute(query, datos)
        db.commit()
        return result.lastrowid
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear solicitud: {e}")
        raise


def create_documento_solicitud(db: Session, solicitud_id: int, documento_id: int, archivo_url: str) -> None:
    """
    Crea el registro de un documento subido en una solicitud.
    """
    try:
        query = text("""
            INSERT INTO solicitud_documentos (
                solicitud_id, documento_id, archivo_url,
                version, es_version_activa, estado_documento
            ) VALUES (
                :solicitud_id, :documento_id, :archivo_url,
                1, TRUE, 'PENDIENTE'
            )
        """)
        db.execute(query, {
            "solicitud_id": solicitud_id,
            "documento_id": documento_id,
            "archivo_url": archivo_url
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear documento de solicitud: {e}")
        raise


def registrar_historial_estado(db: Session, solicitud_id: int, estado_anterior: Optional[str], estado_nuevo: str, usuario_id: Optional[int] = None, motivo: Optional[str] = None) -> None:
    """
    Registra un cambio de estado en el historial.
    """
    try:
        query = text("""
            INSERT INTO estados_historial (
                solicitud_id, estado_anterior, estado_nuevo,
                usuario_id, motivo
            ) VALUES (
                :solicitud_id, :estado_anterior, :estado_nuevo,
                :usuario_id, :motivo
            )
        """)
        db.execute(query, {
            "solicitud_id": solicitud_id,
            "estado_anterior": estado_anterior,
            "estado_nuevo": estado_nuevo,
            "usuario_id": usuario_id,
            "motivo": motivo
        })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al registrar historial: {e}")
        raise


# -------------------------------------------------------
# Obtener solicitudes
# -------------------------------------------------------

def get_solicitud_by_id(db: Session, solicitud_id: int) -> Optional[dict]:
    """
    Obtiene una solicitud completa con sus documentos.
    """
    try:
        query = text("""
            SELECT
                s.id, s.numero_documento, s.numero_ficha,
                s.nombre_aprendiz, s.correo_aprendiz, s.telefono_aprendiz,
                s.tipo_programa_id, tp.nombre AS nombre_tipo_programa,
                s.nombre_programa, s.estado_actual,
                s.observaciones_generales, s.pdf_consolidado_url,
                s.plantilla_id, s.fecha_solicitud
            FROM solicitudes s
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            WHERE s.id = :solicitud_id
        """)
        solicitud = db.execute(query, {"solicitud_id": solicitud_id}).mappings().first()
        if not solicitud:
            return None

        documentos = get_documentos_by_solicitud(db, solicitud_id)
        return {**dict(solicitud), "documentos": documentos}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener solicitud: {e}")
        raise


def get_solicitud_by_doc_ficha(db: Session, numero_documento: str, numero_ficha: str) -> Optional[dict]:
    """
    Obtiene una solicitud por número de documento y ficha.
    Se usa para consulta del aprendiz y para validar duplicados.
    """
    try:
        query = text("""
            SELECT
                s.id, s.numero_documento, s.numero_ficha,
                s.nombre_aprendiz, s.correo_aprendiz, s.telefono_aprendiz,
                s.tipo_programa_id, tp.nombre AS nombre_tipo_programa,
                s.nombre_programa, s.estado_actual,
                s.observaciones_generales,
                s.pdf_consolidado_url, s.fecha_solicitud
            FROM solicitudes s
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            WHERE s.numero_documento = :numero_documento
            AND s.numero_ficha = :numero_ficha
        """)
        solicitud = db.execute(query, {
            "numero_documento": numero_documento,
            "numero_ficha": numero_ficha
        }).mappings().first()

        if not solicitud:
            return None

        documentos = get_documentos_by_solicitud(db, solicitud["id"])
        return {**dict(solicitud), "documentos": documentos}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener solicitud por doc/ficha: {e}")
        raise


def get_all_solicitudes(db: Session, estado: Optional[str] = None, tipo_programa_id: Optional[int] = None, usuario_id: Optional[int] = None, page: int = 1, limit: int = 50) -> list:
    """
    Obtiene todas las solicitudes con filtros opcionales.
    Para el panel del funcionario.
    """
    try:
        filtros = []
        params = {}

        if estado:
            filtros.append("s.estado_actual = :estado")
            params["estado"] = estado

        if tipo_programa_id:
            filtros.append("s.tipo_programa_id = :tipo_programa_id")
            params["tipo_programa_id"] = tipo_programa_id

        where = f"WHERE {' AND '.join(filtros)}" if filtros else ""

        ya_firme_col = ""
        if usuario_id:
            ya_firme_col = """
                , CASE WHEN EXISTS (
                    SELECT 1 FROM firmas f
                    WHERE f.solicitud_id = s.id
                    AND f.usuario_id = :usuario_id
                    AND f.estado_firma IN ('FIRMADO', 'RECHAZADO')
                ) THEN 1 ELSE 0 END AS ya_firme
                , CASE WHEN EXISTS (
                    SELECT 1 FROM firmas f
                    WHERE f.solicitud_id = s.id
                    AND f.usuario_id = :usuario_id
                ) THEN 1 ELSE 0 END AS es_mi_firma
            """
            params["usuario_id"] = usuario_id

        query = text(f"""
            SELECT
                s.id, s.numero_documento, s.numero_ficha,
                s.nombre_aprendiz, s.correo_aprendiz, s.nombre_programa,
                tp.nombre AS nombre_tipo_programa,
                s.estado_actual, s.pdf_consolidado_url,
                s.fecha_solicitud
                {ya_firme_col}
            FROM solicitudes s
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            {where}
            ORDER BY s.fecha_solicitud DESC
            LIMIT :limit OFFSET :offset
        """)
        params["limit"] = limit
        params["offset"] = (page - 1) * limit
        return db.execute(query, params).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener solicitudes: {e}")
        raise


def get_documentos_by_solicitud(db: Session, solicitud_id: int) -> list:
    """
    Obtiene los documentos activos de una solicitud.
    """
    try:
        query = text("""
            SELECT
                sd.id, sd.documento_id,
                dr.nombre AS nombre_documento,
                sd.archivo_url, sd.version,
                sd.es_version_activa, sd.estado_documento,
                sd.observaciones, sd.bloqueado, sd.fecha_subida
            FROM solicitud_documentos sd
            INNER JOIN documentos_requeridos dr ON dr.id = sd.documento_id
            WHERE sd.solicitud_id = :solicitud_id
            AND sd.es_version_activa = TRUE
            ORDER BY sd.documento_id ASC
        """)
        return db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener documentos: {e}")
        raise


# -------------------------------------------------------
# Obtener documentos requeridos por tipo de programa
# -------------------------------------------------------

def get_documentos_requeridos_by_tipo(db: Session, tipo_programa_id: int) -> list:
    """
    Obtiene los documentos requeridos para un tipo de programa.
    Se usa para validar que el aprendiz subió todos los documentos.
    """
    try:
        query = text("""
            SELECT
                dr.id, dr.nombre, dr.descripcion,
                tpd.obligatorio
            FROM documentos_requeridos dr
            INNER JOIN tipo_programa_documentos tpd ON tpd.documento_id = dr.id
            WHERE tpd.tipo_programa_id = :tipo_programa_id
            AND tpd.obligatorio = TRUE
        """)
        return db.execute(query, {"tipo_programa_id": tipo_programa_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener documentos requeridos: {e}")
        raise


def get_tipo_programas(db: Session) -> list:
    """
    Obtiene todos los tipos de programa activos.
    Se usa para cargar el selector en el formulario del aprendiz.
    """
    try:
        query = text("SELECT id, nombre FROM tipo_programas WHERE activo = TRUE ORDER BY nombre ASC")
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener tipos de programa: {e}")
        raise


# -------------------------------------------------------
# Actualizar solicitud
# -------------------------------------------------------

def update_solicitud_programa(db: Session, solicitud_id: int, datos: dict) -> bool:
    """
    Actualiza los datos del programa de una solicitud.
    Solo el funcionario puede hacer esto.
    """
    try:
        fields = {k: v for k, v in datos.items() if k == 'observaciones_generales' or v is not None}
        if not fields:
            return False

        set_clause = ", ".join([f"{key} = :{key}" for key in fields])
        fields["solicitud_id"] = solicitud_id

        query = text(f"UPDATE solicitudes SET {set_clause} WHERE id = :solicitud_id")
        db.execute(query, fields)
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar solicitud: {e}")
        raise


def update_estado_solicitud(db: Session, solicitud_id: int, estado_nuevo: str, usuario_id: Optional[int] = None, motivo: Optional[str] = None) -> bool:
    """
    Cambia el estado de una solicitud y registra el historial.
    """
    try:
        # Obtener estado actual antes de cambiar
        query_estado = text("SELECT estado_actual FROM solicitudes WHERE id = :solicitud_id")
        result = db.execute(query_estado, {"solicitud_id": solicitud_id}).mappings().first()
        if not result:
            return False

        estado_anterior = result["estado_actual"]

        # Actualizar estado
        query = text("""
            UPDATE solicitudes SET estado_actual = :estado_nuevo
            WHERE id = :solicitud_id
        """)
        db.execute(query, {"estado_nuevo": estado_nuevo, "solicitud_id": solicitud_id})
        db.commit()

        # Registrar en historial
        registrar_historial_estado(db, solicitud_id, estado_anterior, estado_nuevo, usuario_id, motivo)
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar estado: {e}")
        raise


# -------------------------------------------------------
# Validaciones
# -------------------------------------------------------

def exists_solicitud(db: Session, numero_documento: str, numero_ficha: str) -> bool:
    """
    Verifica si ya existe una solicitud con ese documento y ficha.
    """
    try:
        query = text("""
            SELECT id FROM solicitudes
            WHERE numero_documento = :numero_documento
            AND numero_ficha = :numero_ficha
        """)
        result = db.execute(query, {
            "numero_documento": numero_documento,
            "numero_ficha": numero_ficha
        }).first()
        return result is not None
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar solicitud existente: {e}")
        raise


def get_usuario_by_id_con_password(db: Session, usuario_id: int) -> Optional[dict]:
    """
    Obtiene un usuario incluyendo password_hash.
    Se usa para verificar la contraseña al firmar.
    """
    try:
        query = text("""
            SELECT id, correo, password_hash
            FROM usuarios
            WHERE id = :usuario_id
        """)
        return db.execute(query, {"usuario_id": usuario_id}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener usuario con password: {e}")
        raise


def corregir_datos_solicitud(db: Session, solicitud_id: int, datos: dict, campos_permitidos: list) -> bool:
    try:
        fields = {k: v for k, v in datos.items() if k in campos_permitidos and v is not None}
        if not fields:
            return False

        # Combinar tipo_documento + numero_documento en un solo campo
        if "tipo_documento" in fields or "numero_documento" in fields:
            tipo = fields.pop("tipo_documento", None)
            numero = fields.pop("numero_documento", None)
            if tipo and numero:
                fields["numero_documento"] = f"{tipo} {numero}"
            elif numero:
                fields["numero_documento"] = numero

        # Convertir tipo_programa_id a int si viene como string
        if "tipo_programa_id" in fields:
            try:
                fields["tipo_programa_id"] = int(fields["tipo_programa_id"])
            except (ValueError, TypeError):
                fields.pop("tipo_programa_id")

        # Eliminar campos que no existen en la BD
        campos_bd = {
            "numero_documento", "numero_ficha", "nombre_aprendiz",
            "correo_aprendiz", "telefono_aprendiz", "tipo_programa_id", "nombre_programa"
        }
        fields = {k: v for k, v in fields.items() if k in campos_bd}

        if not fields:
            return False

        fields["solicitud_id"] = solicitud_id
        set_clause = ", ".join([f"{k} = :{k}" for k in fields if k != "solicitud_id"])
        query = text(f"UPDATE solicitudes SET {set_clause} WHERE id = :solicitud_id")
        db.execute(query, fields)
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al corregir datos solicitud: {e}")
        raise


def get_historial_estados(db: Session, solicitud_id: int) -> list:
    """
    Obtiene el historial completo de cambios de estado de una solicitud.
    """
    try:
        query = text("""
            SELECT
                eh.id,
                eh.estado_anterior,
                eh.estado_nuevo,
                eh.motivo,
                eh.fecha_cambio,
                u.nombre_completo AS nombre_usuario
            FROM estados_historial eh
            LEFT JOIN usuarios u ON u.id = eh.usuario_id
            WHERE eh.solicitud_id = :solicitud_id
            ORDER BY eh.fecha_cambio ASC
        """)
        return db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener historial: {e}")
        raise