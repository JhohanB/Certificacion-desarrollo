import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Roles
# -------------------------------------------------------

def get_all_roles(db: Session, incluir_inactivos: bool = False) -> list:
    try:
        where = "" if incluir_inactivos else "WHERE activo = TRUE"
        query = text(f"""
            SELECT id, nombre, descripcion, requiere_firma,
                es_coordinador, es_funcionario_revision, es_admin, activo
            FROM roles {where} ORDER BY nombre ASC
        """)
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al listar roles: {e}")
        raise


def get_rol_by_id(db: Session, rol_id: int) -> Optional[dict]:
    try:
        query = text("SELECT id, nombre, descripcion, requiere_firma, activo FROM roles WHERE id = :id")
        rol = db.execute(query, {"id": rol_id}).mappings().first()
        if not rol:
            return None
        permisos = get_permisos_by_rol(db, rol_id)
        return {**dict(rol), "permisos": permisos}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener rol: {e}")
        raise


def get_rol_by_nombre(db: Session, nombre: str) -> Optional[dict]:
    try:
        query = text("SELECT id FROM roles WHERE nombre = :nombre")
        return db.execute(query, {"nombre": nombre}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al buscar rol por nombre: {e}")
        raise


def create_rol(db: Session, nombre: str, descripcion: Optional[str], requiere_firma: bool) -> int:
    try:
        query = text("""
            INSERT INTO roles (nombre, descripcion, requiere_firma, activo)
            VALUES (:nombre, :descripcion, :requiere_firma, TRUE)
        """)
        result = db.execute(query, {
            "nombre": nombre.upper(),
            "descripcion": descripcion,
            "requiere_firma": requiere_firma
        })
        db.commit()
        return result.lastrowid
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear rol: {e}")
        raise


def update_rol(db: Session, rol_id: int, datos: dict) -> bool:
    try:
        campos = {k: v for k, v in datos.items() if v is not None}
        if not campos:
            return False
        campos["rol_id"] = rol_id
        set_clause = ", ".join([f"{k} = :{k}" for k in campos if k != "rol_id"])
        query = text(f"UPDATE roles SET {set_clause} WHERE id = :rol_id")
        db.execute(query, campos)
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar rol: {e}")
        raise


def toggle_rol_activo(db: Session, rol_id: int, activo: bool) -> bool:
    try:
        query = text("UPDATE roles SET activo = :activo WHERE id = :rol_id")
        db.execute(query, {"activo": activo, "rol_id": rol_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al cambiar estado del rol: {e}")
        raise


def rol_tiene_usuarios(db: Session, rol_id: int) -> bool:
    """Verifica si el rol tiene usuarios asignados para evitar eliminar roles en uso."""
    try:
        query = text("SELECT COUNT(*) AS total FROM usuario_roles WHERE rol_id = :rol_id")
        result = db.execute(query, {"rol_id": rol_id}).mappings().first()
        return result["total"] > 0
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar usuarios del rol: {e}")
        raise


# -------------------------------------------------------
# Módulos y acciones
# -------------------------------------------------------

def get_all_modulos(db: Session) -> list:
    try:
        query = text("SELECT id, nombre FROM modulos ORDER BY nombre ASC")
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al listar módulos: {e}")
        raise


def get_all_acciones(db: Session) -> list:
    try:
        query = text("SELECT id, nombre FROM acciones ORDER BY nombre ASC")
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al listar acciones: {e}")
        raise


# -------------------------------------------------------
# Permisos
# -------------------------------------------------------

def get_permisos_by_rol(db: Session, rol_id: int) -> list:
    try:
        query = text("""
            SELECT
                rp.id, rp.modulo_id, m.nombre AS nombre_modulo,
                rp.accion_id, a.nombre AS nombre_accion
            FROM rol_permisos rp
            INNER JOIN modulos m ON m.id = rp.modulo_id
            INNER JOIN acciones a ON a.id = rp.accion_id
            WHERE rp.rol_id = :rol_id
            ORDER BY m.nombre ASC, a.nombre ASC
        """)
        return db.execute(query, {"rol_id": rol_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener permisos del rol: {e}")
        raise


def permiso_exists(db: Session, rol_id: int, modulo_id: int, accion_id: int) -> bool:
    try:
        query = text("""
            SELECT id FROM rol_permisos
            WHERE rol_id = :rol_id AND modulo_id = :modulo_id AND accion_id = :accion_id
        """)
        result = db.execute(query, {
            "rol_id": rol_id, "modulo_id": modulo_id, "accion_id": accion_id
        }).first()
        return result is not None
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar permiso: {e}")
        raise


def asignar_permiso(db: Session, rol_id: int, modulo_id: int, accion_id: int) -> bool:
    try:
        query = text("""
            INSERT INTO rol_permisos (rol_id, modulo_id, accion_id)
            VALUES (:rol_id, :modulo_id, :accion_id)
        """)
        db.execute(query, {"rol_id": rol_id, "modulo_id": modulo_id, "accion_id": accion_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al asignar permiso: {e}")
        raise


def revocar_permiso(db: Session, permiso_id: int) -> bool:
    try:
        query = text("DELETE FROM rol_permisos WHERE id = :permiso_id")
        db.execute(query, {"permiso_id": permiso_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al revocar permiso: {e}")
        raise


def revocar_todos_permisos(db: Session, rol_id: int) -> bool:
    try:
        query = text("DELETE FROM rol_permisos WHERE rol_id = :rol_id")
        db.execute(query, {"rol_id": rol_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al revocar permisos del rol: {e}")
        raise