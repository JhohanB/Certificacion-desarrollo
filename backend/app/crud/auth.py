import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

MAX_INTENTOS = 5
BLOQUEO_MINUTOS = 5
REFRESH_TOKEN_HORAS = 8


# -------------------------------------------------------
# Intentos fallidos de login
# -------------------------------------------------------

def get_estado_bloqueo(db: Session, usuario_id: int) -> dict:
    """Devuelve el estado de bloqueo del usuario."""
    try:
        query = text("""
            SELECT intentos_fallidos, bloqueado_hasta
            FROM usuarios WHERE id = :id
        """)
        return db.execute(query, {"id": usuario_id}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener estado de bloqueo: {e}")
        raise


def esta_bloqueado(estado: dict) -> bool:
    """Verifica si el usuario está bloqueado por intentos fallidos."""
    try:
        if not estado or not estado.get("bloqueado_hasta"):
            return False
        ahora = datetime.now(tz=timezone.utc).replace(tzinfo=None)
        return estado["bloqueado_hasta"] > ahora
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar bloqueo: {e}")
        raise


def get_minutos_restantes_bloqueo(estado: dict) -> int:
    """Devuelve los minutos restantes de bloqueo."""
    try:
        if not estado or not estado.get("bloqueado_hasta"):
            return 0
        ahora = datetime.now(tz=timezone.utc).replace(tzinfo=None)
        diff = estado["bloqueado_hasta"] - ahora
        return max(0, int(diff.total_seconds() / 60) + 1)
    except SQLAlchemyError as e:
        logger.error(f"Error al calcular minutos de bloqueo: {e}")
        raise


def registrar_intento_fallido(db: Session, usuario_id: int) -> int:
    try:
        query = text("""
            UPDATE usuarios
            SET 
                intentos_fallidos = intentos_fallidos + 1,
                bloqueado_hasta = CASE 
                    WHEN intentos_fallidos + 1 >= :max_intentos 
                    THEN :bloqueado_hasta
                    ELSE bloqueado_hasta
                END
            WHERE id = :id
        """)

        bloqueado_hasta = datetime.now(tz=timezone.utc).replace(tzinfo=None) + timedelta(minutes=BLOQUEO_MINUTOS)

        db.execute(query, {
            "id": usuario_id,
            "max_intentos": MAX_INTENTOS,
            "bloqueado_hasta": bloqueado_hasta
        })
        db.commit()

        estado = get_estado_bloqueo(db, usuario_id)
        return estado["intentos_fallidos"]

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al registrar intento fallido: {e}")
        raise


def resetear_intentos_fallidos(db: Session, usuario_id: int) -> None:
    try:
        query = text("""
            UPDATE usuarios
            SET intentos_fallidos = 0, bloqueado_hasta = NULL
            WHERE id = :id
            AND intentos_fallidos > 0
        """)
        db.execute(query, {"id": usuario_id})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al resetear intentos: {e}")
        raise


# -------------------------------------------------------
# Refresh tokens
# -------------------------------------------------------

def crear_refresh_token(db: Session, usuario_id: int, token: str) -> None:
    """Guarda un nuevo refresh token en la BD."""
    try:
        expira_en = datetime.now(tz=timezone.utc).replace(tzinfo=None) + timedelta(hours=REFRESH_TOKEN_HORAS)
        query = text("""
            INSERT INTO refresh_tokens (usuario_id, token, expira_en, revocado)
            VALUES (:usuario_id, :token, :expira_en, FALSE)
        """)
        db.execute(query, {"usuario_id": usuario_id, "token": token, "expira_en": expira_en})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear refresh token: {e}")
        raise


def get_refresh_token(db: Session, token: str) -> Optional[dict]:
    """Busca un refresh token en la BD."""
    try:
        query = text("""
            SELECT id, usuario_id, expira_en, revocado
            FROM refresh_tokens WHERE token = :token
        """)
        return db.execute(query, {"token": token}).mappings().first()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener refresh token: {e}")
        raise


def revocar_refresh_token(db: Session, token: str) -> None:
    """Revoca un refresh token específico."""
    try:
        query = text("UPDATE refresh_tokens SET revocado = TRUE WHERE token = :token AND revocado = FALSE")
        db.execute(query, {"token": token})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al revocar refresh token: {e}")
        raise


def revocar_todos_refresh_tokens(db: Session, usuario_id: int) -> None:
    """Revoca todos los refresh tokens de un usuario. Se usa al cambiar contraseña."""
    try:
        query = text("UPDATE refresh_tokens SET revocado = TRUE WHERE usuario_id = :usuario_id AND revocado = FALSE")
        db.execute(query, {"usuario_id": usuario_id})
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al revocar tokens del usuario: {e}")
        raise


def refresh_token_valido(token_data: dict) -> bool:
    """Verifica si un refresh token es válido (no revocado y no expirado)."""
    if not token_data:
        return False
    if token_data["revocado"]:
        return False
    ahora = datetime.now(tz=timezone.utc).replace(tzinfo=None)
    return token_data["expira_en"] > ahora