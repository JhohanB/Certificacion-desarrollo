import logging
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.usuarios import UsuarioCreate, UsuarioUpdate
from core.security import hash_password

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Crear usuario
# -------------------------------------------------------

def create_usuario(db: Session, usuario: UsuarioCreate, password_temporal: str, debe_registrar_firma: bool) -> Optional[int]:
    """
    Crea un nuevo funcionario en el sistema.
    La contraseña ya viene generada desde el router.
    debe_registrar_firma se calcula en el router según los roles asignados.

    Returns:
        int: ID del usuario creado.
    """
    try:
        query = text("""
            INSERT INTO usuarios (
                documento, nombre_completo, correo, telefono,
                password_hash, activo, debe_cambiar_password,
                debe_registrar_firma
            ) VALUES (
                :documento, :nombre_completo, :correo, :telefono,
                :password_hash, TRUE, TRUE,
                :debe_registrar_firma
            )
        """)
        result = db.execute(query, {
            "documento": usuario.documento,
            "nombre_completo": usuario.nombre_completo,
            "correo": usuario.correo,
            "telefono": usuario.telefono,
            "password_hash": hash_password(password_temporal),
            "debe_registrar_firma": debe_registrar_firma
        })
        db.commit()
        return result.lastrowid
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear usuario: {e}")
        raise


def asignar_roles(db: Session, usuario_id: int, roles: list[int]) -> None:
    """
    Asigna una lista de roles a un usuario.
    Se llama justo después de crear el usuario.
    """
    try:
        for rol_id in roles:
            query = text("""
                INSERT INTO usuario_roles (usuario_id, rol_id, activo)
                VALUES (:usuario_id, :rol_id, TRUE)
            """)
            db.execute(query, {"usuario_id": usuario_id, "rol_id": rol_id})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al asignar roles: {e}")
        raise


# -------------------------------------------------------
# Obtener usuarios
# -------------------------------------------------------

def get_usuario_by_id(db: Session, usuario_id: int) -> Optional[dict]:
    """
    Obtiene un usuario con todos sus roles.
    """
    try:
        query = text("""
            SELECT
                u.id, u.documento, u.nombre_completo, u.correo, u.telefono,
                u.firma_registrada, u.firma_url, u.activo,
                u.debe_cambiar_password, u.debe_registrar_firma,
                u.created_at,
                r.id AS rol_id, r.nombre AS rol_nombre, r.descripcion AS rol_descripcion,
                r.requiere_firma, r.es_coordinador, r.es_funcionario_revision, r.es_admin
            FROM usuarios u
            LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id AND ur.activo = TRUE
            LEFT JOIN roles r ON ur.rol_id = r.id
            WHERE u.id = :usuario_id
            ORDER BY r.nombre ASC
        """)
        rows = db.execute(query, {"usuario_id": usuario_id}).mappings().all()
        if not rows:
            return None

        usuario = rows[0]
        roles = []
        for row in rows:
            if row["rol_id"] is not None:
                roles.append({
                    "id": row["rol_id"],
                    "nombre": row["rol_nombre"],
                    "descripcion": row["rol_descripcion"],
                    "requiere_firma": row["requiere_firma"],
                    "es_coordinador": row["es_coordinador"],
                    "es_funcionario_revision": row["es_funcionario_revision"],
                    "es_admin": row["es_admin"]
                })

        return {**dict(usuario), "roles": roles}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener usuario por ID: {e}")
        raise


def get_usuario_by_correo(db: Session, correo: str) -> Optional[dict]:
    """
    Obtiene un usuario por correo incluyendo password_hash.
    Se usa únicamente para autenticación.
    """
    try:
        query = text("""
            SELECT
                u.id, u.documento, u.nombre_completo, u.correo, u.telefono,
                u.password_hash, u.firma_registrada, u.firma_url,
                u.activo, u.debe_cambiar_password, u.debe_registrar_firma,
                u.created_at,
                r.id AS rol_id, r.nombre AS rol_nombre, r.descripcion AS rol_descripcion,
                r.requiere_firma, r.es_coordinador, r.es_funcionario_revision, r.es_admin
            FROM usuarios u
            LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id AND ur.activo = TRUE
            LEFT JOIN roles r ON ur.rol_id = r.id
            WHERE u.correo = :correo
            ORDER BY r.nombre ASC
        """)
        rows = db.execute(query, {"correo": correo}).mappings().all()
        if not rows:
            return None

        usuario = rows[0]
        roles = []
        for row in rows:
            if row["rol_id"] is not None:
                roles.append({
                    "id": row["rol_id"],
                    "nombre": row["rol_nombre"],
                    "descripcion": row["rol_descripcion"],
                    "requiere_firma": row["requiere_firma"],
                    "es_coordinador": row["es_coordinador"],
                    "es_funcionario_revision": row["es_funcionario_revision"],
                    "es_admin": row["es_admin"]
                })

        return {**dict(usuario), "roles": roles}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener usuario por correo: {e}")
        raise


def get_usuario_by_id_con_password(db: Session, usuario_id: int) -> Optional[dict]:
    """
    Obtiene un usuario por ID incluyendo password_hash.
    Se usa para validación de contraseña en operaciones sensibles.
    """
    try:
        query = text("""
            SELECT
                u.id, u.documento, u.nombre_completo, u.correo, u.telefono,
                u.password_hash, u.firma_registrada, u.firma_url,
                u.activo, u.debe_cambiar_password, u.debe_registrar_firma,
                u.created_at
            FROM usuarios u
            WHERE u.id = :usuario_id
        """)
        usuario = db.execute(query, {"usuario_id": usuario_id}).mappings().first()
        return dict(usuario) if usuario else None
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener usuario por ID con password: {e}")
        raise


def get_all_usuarios(db: Session, page: int = 1, limit: int = 50) -> list:
    """
    Obtiene todos los funcionarios con sus roles.
    """
    try:
        query = text("""
            SELECT
                u.id, u.documento, u.nombre_completo, u.correo, u.telefono,
                u.firma_registrada, u.activo, u.debe_cambiar_password,
                u.debe_registrar_firma, u.created_at,
                r.id as rol_id, r.nombre as rol_nombre, r.descripcion as rol_descripcion,
                r.requiere_firma, r.es_coordinador, r.es_funcionario_revision, r.es_admin
            FROM (
                SELECT id, documento, nombre_completo, correo, telefono,
                    firma_registrada, activo, debe_cambiar_password,
                    debe_registrar_firma, created_at
                FROM usuarios
                ORDER BY nombre_completo ASC
                LIMIT :limit OFFSET :offset
            ) u
            LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id AND ur.activo = TRUE
            LEFT JOIN roles r ON ur.rol_id = r.id
            ORDER BY u.nombre_completo ASC, r.nombre ASC
        """)
        rows = db.execute(query, {"limit": limit, "offset": (page - 1) * limit}).mappings().all()

        # Agrupar en Python
        usuarios_dict = {}
        for row in rows:
            user_id = row["id"]
            if user_id not in usuarios_dict:
                usuarios_dict[user_id] = {
                    "id": row["id"],
                    "documento": row["documento"],
                    "nombre_completo": row["nombre_completo"],
                    "correo": row["correo"],
                    "telefono": row["telefono"],
                    "firma_registrada": row["firma_registrada"],
                    "activo": row["activo"],
                    "debe_cambiar_password": row["debe_cambiar_password"],
                    "debe_registrar_firma": row["debe_registrar_firma"],
                    "created_at": row["created_at"],
                    "roles": []
                }
            if row["rol_id"]:  # Solo agregar si hay rol
                usuarios_dict[user_id]["roles"].append({
                    "id": row["rol_id"],
                    "nombre": row["rol_nombre"],
                    "descripcion": row["rol_descripcion"],
                    "requiere_firma": row["requiere_firma"],
                    "es_coordinador": row["es_coordinador"],
                    "es_funcionario_revision": row["es_funcionario_revision"],
                    "es_admin": row["es_admin"]
                })

        return list(usuarios_dict.values())
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener usuarios: {e}")
        raise


def get_roles_by_usuario(db: Session, usuario_id: int) -> list:
    """
    Obtiene los roles activos de un usuario.
    """
    try:
        query = text("""
            SELECT r.id, r.nombre, r.descripcion, r.requiere_firma,
                r.es_coordinador, r.es_funcionario_revision, r.es_admin
            FROM roles r
            INNER JOIN usuario_roles ur ON ur.rol_id = r.id
            WHERE ur.usuario_id = :usuario_id
            AND ur.activo = TRUE
        """)
        return db.execute(query, {"usuario_id": usuario_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener roles del usuario: {e}")
        raise


# -------------------------------------------------------
# Actualizar usuario
# -------------------------------------------------------

def update_usuario(db: Session, usuario_id: int, data: UsuarioUpdate) -> bool:
    """
    Actualiza los datos básicos de un funcionario.
    """
    try:
        fields = data.model_dump(exclude_unset=True)
        if not fields:
            return False

        set_clause = ", ".join([f"{key} = :{key}" for key in fields])
        fields["usuario_id"] = usuario_id

        query = text(f"UPDATE usuarios SET {set_clause} WHERE id = :usuario_id")
        db.execute(query, fields)
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar usuario: {e}")
        raise


def cambiar_password(db: Session, usuario_id: int, nueva_password: str) -> bool:
    """
    Actualiza la contraseña del funcionario y marca
    debe_cambiar_password = FALSE si era el primer login.
    """
    try:
        query = text("""
            UPDATE usuarios
            SET password_hash = :password_hash,
                debe_cambiar_password = FALSE
            WHERE id = :usuario_id
        """)
        db.execute(query, {
            "password_hash": hash_password(nueva_password),
            "usuario_id": usuario_id
        })
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al cambiar contraseña: {e}")
        raise


def toggle_activo(db: Session, usuario_id: int, activo: bool) -> bool:
    """
    Activa o desactiva un funcionario.
    Si se desactiva un coordinador, no hace cambios en solicitudes existentes.
    """
    try:
        query = text("""
            UPDATE usuarios SET activo = :activo WHERE id = :usuario_id
        """)
        db.execute(query, {"activo": activo, "usuario_id": usuario_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al cambiar estado del usuario: {e}")
        raise


def get_solicitudes_con_coordinador_inactivo(db: Session) -> list:
    """
    Obtiene solicitudes que tienen asignado un coordinador inactivo.
    Se usa para mostrar alertas en el panel de certificación.
    """
    try:
        query = text("""
            SELECT DISTINCT
                s.id, s.numero_documento, s.numero_ficha, s.nombre_aprendiz,
                s.nombre_programa, s.estado_actual, s.fecha_solicitud,
                u.nombre_completo AS nombre_coordinador,
                u.correo AS correo_coordinador
            FROM solicitudes s
            INNER JOIN firmas f ON f.solicitud_id = s.id
            INNER JOIN roles r ON r.id = f.rol_id
            INNER JOIN usuarios u ON u.id = f.usuario_id
            WHERE r.nombre = 'COORDINADOR'
            AND u.activo = FALSE
            AND s.estado_actual IN ('PENDIENTE_FIRMAS', 'PENDIENTE_CERTIFICACION')
            ORDER BY s.fecha_solicitud DESC
        """)
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener solicitudes con coordinador inactivo: {e}")
        raise


def update_firma_url(db: Session, usuario_id: int, firma_url: str) -> bool:
    """
    Guarda la URL de la imagen de firma del funcionario,
    marca firma_registrada = TRUE y debe_registrar_firma = FALSE.
    """
    try:
        query = text("""
            UPDATE usuarios
            SET firma_url = :firma_url,
                firma_registrada = TRUE,
                debe_registrar_firma = FALSE
            WHERE id = :usuario_id
        """)
        db.execute(query, {"firma_url": firma_url, "usuario_id": usuario_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al actualizar firma: {e}")
        raise


# -------------------------------------------------------
# Gestión de roles
# -------------------------------------------------------

def agregar_rol(db: Session, usuario_id: int, rol_id: int) -> bool:
    """
    Agrega un rol a un funcionario existente.
    Si el rol ya existe pero estaba inactivo, lo reactiva.
    """
    try:
        query = text("""
            INSERT INTO usuario_roles (usuario_id, rol_id, activo)
            VALUES (:usuario_id, :rol_id, TRUE)
            ON DUPLICATE KEY UPDATE activo = TRUE
        """)
        db.execute(query, {"usuario_id": usuario_id, "rol_id": rol_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al agregar rol: {e}")
        raise


def revocar_rol(db: Session, usuario_id: int, rol_id: int) -> bool:
    """
    Revoca un rol de un funcionario (lo marca como inactivo).
    """
    try:
        query = text("""
            UPDATE usuario_roles
            SET activo = FALSE
            WHERE usuario_id = :usuario_id AND rol_id = :rol_id
        """)
        db.execute(query, {"usuario_id": usuario_id, "rol_id": rol_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al revocar rol: {e}")
        raise


# -------------------------------------------------------
# Validaciones
# -------------------------------------------------------

def exists_by_correo(db: Session, correo: str) -> bool:
    """Verifica si ya existe un usuario con ese correo."""
    try:
        query = text("SELECT id FROM usuarios WHERE correo = :correo")
        result = db.execute(query, {"correo": correo}).first()
        return result is not None
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar correo: {e}")
        raise


def exists_by_documento(db: Session, documento: str) -> bool:
    """Verifica si ya existe un usuario con ese documento."""
    try:
        query = text("SELECT id FROM usuarios WHERE documento = :documento")
        result = db.execute(query, {"documento": documento}).first()
        return result is not None
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar documento: {e}")
        raise


def rol_requiere_firma(db: Session, rol_id: int) -> bool:
    """Verifica si un rol requiere firma registrada."""
    try:
        query = text("""
            SELECT requiere_firma FROM roles WHERE id = :rol_id
        """)
        result = db.execute(query, {"rol_id": rol_id}).mappings().first()
        return result["requiere_firma"] if result else False
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar si rol requiere firma: {e}")
        raise



def reset_password(db: Session, usuario_id: int, password_temporal: str) -> bool:
    """
    Restablece la contraseña de un usuario con una clave temporal
    y fuerza el cambio en el próximo login.
    """
    try:
        query = text("""
            UPDATE usuarios
            SET password_hash = :password_hash,
                debe_cambiar_password = TRUE
            WHERE id = :usuario_id
        """)
        db.execute(query, {
            "password_hash": hash_password(password_temporal),
            "usuario_id": usuario_id
        })
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al restablecer contraseña: {e}")
        raise