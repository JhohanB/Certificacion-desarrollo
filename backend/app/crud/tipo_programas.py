import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Tipos de programa
# -------------------------------------------------------

def get_all_tipos_programa(db: Session) -> list:
    try:
        query = text("""
            SELECT 
                tp.id, tp.nombre, tp.descripcion, tp.activo,
                COUNT(DISTINCT tpd.id) AS total_documentos,
                COUNT(DISTINCT tpr.id) AS total_roles
            FROM tipo_programas tp
            LEFT JOIN tipo_programa_documentos tpd ON tpd.tipo_programa_id = tp.id
            LEFT JOIN tipo_programa_roles tpr ON tpr.tipo_programa_id = tp.id
            GROUP BY tp.id, tp.nombre, tp.activo
            ORDER BY tp.nombre ASC
        """)
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al listar tipos de programa: {e}")
        raise


def toggle_activo_tipo_programa(db: Session, tipo_id: int, activo: bool) -> bool:
    try:
        query = text("UPDATE tipo_programas SET activo = :activo WHERE id = :id")
        db.execute(query, {"activo": activo, "id": tipo_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al cambiar estado: {e}")
        raise


def get_tipo_programa_by_id(db: Session, tipo_id: int) -> Optional[dict]:
    try:
        query = text("SELECT id, nombre, descripcion, activo FROM tipo_programas WHERE id = :id")
        tipo = db.execute(query, {"id": tipo_id}).mappings().first()
        if not tipo:
            return None
        documentos = get_documentos_by_tipo(db, tipo_id)
        roles = get_roles_by_tipo(db, tipo_id)
        return {**dict(tipo), "documentos": documentos, "roles_firmantes": roles}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener tipo de programa: {e}")
        raise


def get_tipo_programa_by_nombre(db: Session, nombre: str) -> Optional[dict]:
    try:
        query = text("SELECT id, nombre, descripcion, activo FROM tipo_programas WHERE nombre = :nombre")
        return db.execute(query, {"nombre": nombre.upper()}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al buscar tipo de programa: {e}")
        raise


def create_tipo_programa(db: Session, nombre: str, descripcion: Optional[str] = None) -> int:
    try:
        query = text("INSERT INTO tipo_programas (nombre, descripcion) VALUES (:nombre, :descripcion)")
        result = db.execute(query, {"nombre": nombre.upper(), "descripcion": descripcion})
        db.commit()
        return result.lastrowid
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear tipo de programa: {e}")
        raise


def update_tipo_programa(db: Session, tipo_id: int, nombre: str, descripcion: Optional[str] = None) -> bool:
    try:
        query = text("UPDATE tipo_programas SET nombre = :nombre, descripcion = :descripcion WHERE id = :id")
        db.execute(query, {"nombre": nombre.upper(), "descripcion": descripcion, "id": tipo_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar tipo de programa: {e}")
        raise


def tipo_programa_tiene_solicitudes(db: Session, tipo_id: int) -> bool:
    try:
        query = text("SELECT COUNT(*) AS total FROM solicitudes WHERE tipo_programa_id = :id")
        result = db.execute(query, {"id": tipo_id}).mappings().first()
        return result["total"] > 0
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar solicitudes: {e}")
        raise


def delete_tipo_programa(db: Session, tipo_id: int) -> bool:
    try:
        # Eliminar relaciones primero
        db.execute(text("DELETE FROM tipo_programa_documentos WHERE tipo_programa_id = :id"), {"id": tipo_id})
        db.execute(text("DELETE FROM tipo_programa_roles WHERE tipo_programa_id = :id"), {"id": tipo_id})
        db.execute(text("DELETE FROM tipo_programas WHERE id = :id"), {"id": tipo_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al eliminar tipo de programa: {e}")
        raise


# -------------------------------------------------------
# Documentos requeridos
# -------------------------------------------------------

def get_all_documentos_requeridos(db: Session) -> list:
    try:
        query = text("SELECT id, nombre, descripcion FROM documentos_requeridos ORDER BY nombre ASC")
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al listar documentos requeridos: {e}")
        raise


def get_documento_requerido_by_id(db: Session, doc_id: int) -> Optional[dict]:
    try:
        query = text("SELECT id, nombre, descripcion FROM documentos_requeridos WHERE id = :id")
        return db.execute(query, {"id": doc_id}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener documento requerido: {e}")
        raise


def create_documento_requerido(db: Session, nombre: str, descripcion: Optional[str]) -> int:
    try:
        query = text("""
            INSERT INTO documentos_requeridos (nombre, descripcion)
            VALUES (:nombre, :descripcion)
        """)
        result = db.execute(query, {"nombre": nombre, "descripcion": descripcion})
        db.commit()
        return result.lastrowid
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear documento requerido: {e}")
        raise


def update_documento_requerido(db: Session, doc_id: int, datos: dict) -> bool:
    try:
        campos = {k: v for k, v in datos.items() if v is not None}
        if not campos:
            return False
        campos["doc_id"] = doc_id
        set_clause = ", ".join([f"{k} = :{k}" for k in campos if k != "doc_id"])
        query = text(f"UPDATE documentos_requeridos SET {set_clause} WHERE id = :doc_id")
        db.execute(query, campos)
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar documento requerido: {e}")
        raise


def documento_en_uso(db: Session, doc_id: int) -> bool:
    try:
        query = text("SELECT COUNT(*) AS total FROM tipo_programa_documentos WHERE documento_id = :id")
        result = db.execute(query, {"id": doc_id}).mappings().first()
        return result["total"] > 0
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar uso del documento: {e}")
        raise


def delete_documento_requerido(db: Session, doc_id: int) -> bool:
    try:
        db.execute(text("DELETE FROM documentos_requeridos WHERE id = :id"), {"id": doc_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al eliminar documento requerido: {e}")
        raise


# -------------------------------------------------------
# Relación tipo_programa - documentos
# -------------------------------------------------------

def get_documentos_by_tipo(db: Session, tipo_id: int) -> list:
    try:
        query = text("""
            SELECT tpd.id, tpd.documento_id, dr.nombre AS nombre_documento, tpd.obligatorio
            FROM tipo_programa_documentos tpd
            INNER JOIN documentos_requeridos dr ON dr.id = tpd.documento_id
            WHERE tpd.tipo_programa_id = :tipo_id
            ORDER BY dr.nombre ASC
        """)
        return db.execute(query, {"tipo_id": tipo_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener documentos del tipo de programa: {e}")
        raise


def documento_asignado_a_tipo(db: Session, tipo_id: int, doc_id: int) -> bool:
    try:
        query = text("""
            SELECT id FROM tipo_programa_documentos
            WHERE tipo_programa_id = :tipo_id AND documento_id = :doc_id
        """)
        return db.execute(query, {"tipo_id": tipo_id, "doc_id": doc_id}).first() is not None
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar documento asignado: {e}")
        raise


def asignar_documento_a_tipo(db: Session, tipo_id: int, doc_id: int, obligatorio: bool) -> bool:
    try:
        query = text("""
            INSERT INTO tipo_programa_documentos (tipo_programa_id, documento_id, obligatorio)
            VALUES (:tipo_id, :doc_id, :obligatorio)
        """)
        db.execute(query, {"tipo_id": tipo_id, "doc_id": doc_id, "obligatorio": obligatorio})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al asignar documento a tipo: {e}")
        raise


def quitar_documento_de_tipo(db: Session, relacion_id: int) -> bool:
    try:
        db.execute(text("DELETE FROM tipo_programa_documentos WHERE id = :id"), {"id": relacion_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al quitar documento de tipo: {e}")
        raise


# -------------------------------------------------------
# Relación tipo_programa - roles firmantes
# -------------------------------------------------------

def get_roles_by_tipo(db: Session, tipo_id: int) -> list:
    try:
        query = text("""
            SELECT tpr.id, tpr.rol_id, r.nombre AS nombre_rol,
                   tpr.orden_firma, tpr.obligatorio
            FROM tipo_programa_roles tpr
            INNER JOIN roles r ON r.id = tpr.rol_id
            WHERE tpr.tipo_programa_id = :tipo_id
            ORDER BY tpr.orden_firma ASC
        """)
        return db.execute(query, {"tipo_id": tipo_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener roles del tipo de programa: {e}")
        raise


def rol_asignado_a_tipo(db: Session, tipo_id: int, rol_id: int) -> bool:
    try:
        query = text("""
            SELECT id FROM tipo_programa_roles
            WHERE tipo_programa_id = :tipo_id AND rol_id = :rol_id
        """)
        return db.execute(query, {"tipo_id": tipo_id, "rol_id": rol_id}).first() is not None
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar rol asignado: {e}")
        raise


def asignar_rol_a_tipo(db: Session, tipo_id: int, rol_id: int, orden_firma: int, obligatorio: bool) -> bool:
    try:
        query = text("""
            INSERT INTO tipo_programa_roles (tipo_programa_id, rol_id, orden_firma, obligatorio)
            VALUES (:tipo_id, :rol_id, :orden_firma, :obligatorio)
        """)
        db.execute(query, {
            "tipo_id": tipo_id, "rol_id": rol_id,
            "orden_firma": orden_firma, "obligatorio": obligatorio
        })
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al asignar rol a tipo: {e}")
        raise


def quitar_rol_de_tipo(db: Session, relacion_id: int) -> bool:
    try:
        db.execute(text("DELETE FROM tipo_programa_roles WHERE id = :id"), {"id": relacion_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al quitar rol de tipo: {e}")
        raise