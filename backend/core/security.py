import secrets
import logging
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from jose import JWTError, jwt

from core.config import settings

logger = logging.getLogger(__name__)

# -------------------------------------------------------
# Hashing de contraseñas
# -------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Genera el hash de una contraseña en texto plano.
    Se usa al crear o actualizar la contraseña de un funcionario.

    Args:
        password: Contraseña en texto plano.

    Returns:
        str: Hash de la contraseña.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con su hash.

    Se usa en dos momentos:
    1. Al hacer login el funcionario.
    2. Cuando el funcionario va a firmar un documento,
       el sistema le pide ingresar su contraseña nuevamente.

    Args:
        plain_password: Contraseña ingresada por el usuario.
        hashed_password: Hash almacenado en la base de datos.

    Returns:
        bool: True si coinciden, False si no.
    """
    return pwd_context.verify(plain_password, hashed_password)


# -------------------------------------------------------
# JWT para funcionarios
# -------------------------------------------------------

def create_access_token(data: dict) -> str:
    """
    Crea un token JWT para la sesión de un funcionario.

    El token incluye:
    - sub: ID del usuario
    - rol: nombre del rol del funcionario
    - exp: fecha de expiración

    Args:
        data: Diccionario con los datos a incluir en el token.
              Ejemplo: {"sub": "5", "rol": "COORDINADOR"}

    Returns:
        str: Token JWT firmado.
    """
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_access_token(token: str) -> dict | None:
    """
    Verifica y decodifica un token JWT de funcionario.

    Returns:
        dict: Payload del token si es válido.
              Contiene 'sub' (id usuario) y 'rol'.
        None: Si el token es inválido o ha expirado.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token JWT expirado")
        return None
    except JWTError as e:
        logger.warning(f"Token JWT inválido: {str(e)}")
        return None


# -------------------------------------------------------
# Refresh token
# -------------------------------------------------------

def create_refresh_token() -> str:
    """Genera un refresh token seguro y aleatorio."""
    return secrets.token_urlsafe(64)


# -------------------------------------------------------
# Token de edición para aprendices
# -------------------------------------------------------

def generate_edit_token() -> str:
    """
    Genera un token único y seguro para que el aprendiz
    pueda editar su solicitud cuando tiene documentos observados.

    Características:
    - Un solo uso (se marca como usado al enviar la corrección)
    - Sin fecha de expiración (el aprendiz puede usarlo cuando pueda)
    - Generado con secrets para garantizar aleatoriedad segura

    Returns:
        str: Token único en formato URL-safe de 64 caracteres.
    """
    return secrets.token_urlsafe(48)


def verify_edit_token(token_data: dict) -> bool:
    """
    Verifica si un token de edición es válido.

    El token es válido si:
    - Existe en la base de datos
    - No ha sido usado (usado = FALSE)

    Args:
        token_data: Registro del token obtenido desde la base de datos.
                    Debe tener el campo 'usado'.

    Returns:
        bool: True si el token es válido, False si ya fue usado.

    Example:
        token_db = crud_tokens.get_token(db, token)
        if not token_db:
            raise HTTPException(404, "Token no encontrado")
        if not verify_edit_token(token_db):
            raise HTTPException(400, "Token ya utilizado")
    """
    if token_data is None:
        return False
    if token_data["usado"]:
        logger.warning("Intento de uso de token ya utilizado")
        return False
    return True


# -------------------------------------------------------
# Utilidad para verificar permisos de firma
# -------------------------------------------------------

def can_sign(user_role: str, target_role: str) -> bool:
    """
    Verifica si el rol del usuario coincide con el rol
    requerido para firmar una solicitud.

    Args:
        user_role: Rol del funcionario autenticado.
        target_role: Rol requerido para firmar.

    Returns:
        bool: True si puede firmar, False si no.
    """
    return user_role == target_role