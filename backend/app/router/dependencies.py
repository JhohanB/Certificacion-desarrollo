import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import verify_access_token
from app.crud import usuarios as crud_usuarios

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> dict:
    """
    Dependencia base para obtener el funcionario autenticado.
    Se usa en todos los endpoints protegidos.

    Raises:
        401: Si el token es inválido o expiró.
        404: Si el usuario no existe.
        403: Si el usuario está inactivo.
    """
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"}
        )

    usuario_id = int(payload.get("sub"))
    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)

    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    if not usuario["activo"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo, contacte al administrador"
        )

    # Bloquear acceso si debe cambiar contraseña o registrar firma
    if usuario["debe_cambiar_password"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debe cambiar su contraseña antes de continuar"
        )

    if usuario["debe_registrar_firma"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debe registrar su firma antes de continuar"
        )

    return usuario


def get_current_user_primer_login(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> dict:
    """
    Permite acceso aunque debe_cambiar_password = TRUE
    o debe_registrar_firma = TRUE.

    Se usa ÚNICAMENTE en estos dos endpoints del primer login:
    - PUT /auth/cambiar-password
    - POST /usuarios/{id}/firma

    En cualquier otro endpoint usar get_current_user.
    """
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"}
        )

    usuario_id = int(payload.get("sub"))
    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)

    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    if not usuario["activo"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo, contacte al administrador"
        )

    return usuario


def require_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependencia que exige que el usuario tenga rol ADMIN.
    Se usa en endpoints exclusivos del administrador.

    Raises:
        403: Si el usuario no tiene rol ADMIN.
    """
    roles = [r["nombre"] for r in current_user["roles"]]
    if "ADMIN" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para realizar esta acción"
        )
    return current_user


def require_roles(*roles_requeridos: str):
    """
    Fábrica de dependencias para exigir uno o más roles específicos.

    Uso:
        @router.get("/firmas", dependencies=[Depends(require_roles("APE", "COORDINADOR"))])

    Args:
        roles_requeridos: Nombres de roles permitidos para acceder al endpoint.

    Raises:
        403: Si el usuario no tiene ninguno de los roles requeridos.
    """
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        roles_usuario = [r["nombre"] for r in current_user["roles"]]
        tiene_permiso = any(rol in roles_usuario for rol in roles_requeridos)
        if not tiene_permiso:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para realizar esta acción"
            )
        return current_user
    return dependency


def check_permission(modulo: str, accion: str):
    """
    Fábrica de dependencias para verificar permisos RBAC
    por módulo y acción contra la base de datos.

    Uso:
        @router.post("/", dependencies=[Depends(check_permission("solicitudes", "crear"))])

    Args:
        modulo: Nombre del módulo (ej. "solicitudes", "documentos").
        accion: Nombre de la acción (ej. "crear", "leer", "firmar").

    Raises:
        403: Si el usuario no tiene el permiso requerido.
    """
    def dependency(
        current_user: dict = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> dict:
        from sqlalchemy import text
        roles_usuario = [r["id"] for r in current_user["roles"]]
        if not roles_usuario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para realizar esta acción"
            )

        placeholders = ", ".join([f":rol_{i}" for i in range(len(roles_usuario))])
        params = {f"rol_{i}": rol_id for i, rol_id in enumerate(roles_usuario)}
        params["modulo"] = modulo
        params["accion"] = accion

        query = text(f"""
            SELECT COUNT(*) as total
            FROM rol_permisos rp
            INNER JOIN modulos m ON m.id = rp.modulo_id
            INNER JOIN acciones a ON a.id = rp.accion_id
            WHERE rp.rol_id IN ({placeholders})
            AND m.nombre = :modulo
            AND a.nombre = :accion
        """)

        result = db.execute(query, params).mappings().first()
        if not result or result["total"] == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tiene permiso para '{accion}' en '{modulo}'"
            )
        return current_user
    return dependency