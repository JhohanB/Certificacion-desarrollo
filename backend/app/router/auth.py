import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import verify_password, create_access_token, create_refresh_token
from app.schemas.usuarios import LoginRequest, LoginResponse, CambiarPassword, RefreshTokenRequest
from app.crud import usuarios as crud_usuarios
from app.crud import auth as crud_auth
from app.router.dependencies import get_current_user_primer_login

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(datos: LoginRequest, db: Session = Depends(get_db)):
    """
    Login de funcionario.
    - Verifica correo y contraseña
    - Bloquea al usuario por 15 minutos tras 5 intentos fallidos
    - Devuelve access token (60 min) y refresh token (7 días)
    - Si debe_cambiar_password = TRUE el frontend debe redirigir al formulario de cambio
    """
    from app.utils.auditoria import registrar

    usuario = crud_usuarios.get_usuario_by_correo(db, datos.correo)

    if not usuario:
        registrar(db, "LOGIN_FALLIDO", "usuarios", None,
                  f"Login fallido - correo no encontrado: {datos.correo}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos"
        )

    if not usuario["activo"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo, contacte al administrador"
        )

    # Verificar si está bloqueado
    if crud_auth.esta_bloqueado(db, usuario["id"]):
        minutos = crud_auth.get_minutos_restantes_bloqueo(db, usuario["id"])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Usuario bloqueado por demasiados intentos fallidos. Intente de nuevo en {minutos} minuto(s)"
        )

    # Verificar contraseña
    if not verify_password(datos.password, usuario["password_hash"]):
        intentos = crud_auth.registrar_intento_fallido(db, usuario["id"])
        registrar(db, "LOGIN_FALLIDO", "usuarios", usuario["id"],
                  f"Login fallido - contraseña incorrecta. Intento {intentos}/5")

        restantes = max(0, 5 - intentos)
        if restantes == 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Usuario bloqueado por 15 minutos por demasiados intentos fallidos"
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Correo o contraseña incorrectos. Intentos restantes: {restantes}"
        )

    # Login exitoso - resetear intentos fallidos
    crud_auth.resetear_intentos_fallidos(db, usuario["id"])

    roles_nombres = [r["nombre"] for r in usuario["roles"]]
    access_token = create_access_token(data={"sub": str(usuario["id"]), "roles": roles_nombres})
    refresh_token = create_refresh_token()
    crud_auth.crear_refresh_token(db, usuario["id"], refresh_token)

    registrar(db, "LOGIN_EXITOSO", "usuarios", usuario["id"],
              f"Login exitoso: {usuario['correo']}")

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        debe_cambiar_password=usuario["debe_cambiar_password"],
        debe_registrar_firma=usuario["debe_registrar_firma"],
        usuario=usuario
    )


@router.post("/refresh")
def refresh_token(datos: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Renueva el access token usando el refresh token.
    - El refresh token tiene validez de 7 días
    - Devuelve un nuevo access token sin necesidad de hacer login
    - El refresh token se rota (se revoca el anterior y se crea uno nuevo)
    """
    token_data = crud_auth.get_refresh_token(db, datos.refresh_token)

    if not token_data or not crud_auth.refresh_token_valido(token_data):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado"
        )

    usuario = crud_usuarios.get_usuario_by_id(db, token_data["usuario_id"])
    if not usuario or not usuario["activo"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo"
        )

    # Rotar refresh token: revocar el anterior y crear uno nuevo
    crud_auth.revocar_refresh_token(db, datos.refresh_token)
    nuevo_refresh_token = create_refresh_token()
    crud_auth.crear_refresh_token(db, usuario["id"], nuevo_refresh_token)

    roles_nombres = [r["nombre"] for r in usuario["roles"]]
    access_token = create_access_token(data={"sub": str(usuario["id"]), "roles": roles_nombres})

    return {
        "access_token": access_token,
        "refresh_token": nuevo_refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout(
    datos: RefreshTokenRequest,
    current_user: dict = Depends(get_current_user_primer_login),
    db: Session = Depends(get_db)
):
    """Cierra la sesión revocando el refresh token."""
    crud_auth.revocar_refresh_token(db, datos.refresh_token)
    return {"message": "Sesión cerrada correctamente"}


@router.post("/token", include_in_schema=False)
def login_swagger(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """Endpoint exclusivo para el botón Authorize de Swagger."""
    usuario = crud_usuarios.get_usuario_by_correo(db, form_data.username)

    if not usuario or not verify_password(form_data.password, usuario["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not usuario["activo"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

    roles_nombres = [r["nombre"] for r in usuario["roles"]]
    access_token = create_access_token(data={"sub": str(usuario["id"]), "roles": roles_nombres})
    return {"access_token": access_token, "token_type": "bearer"}


@router.put("/cambiar-password")
def cambiar_password(
    datos: CambiarPassword,
    current_user: dict = Depends(get_current_user_primer_login),
    db: Session = Depends(get_db)
):
    """
    Cambiar contraseña del funcionario autenticado.
    Al cambiar contraseña se revocan todos los refresh tokens activos.
    """
    if datos.password_nueva != datos.password_confirmacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña y su confirmación no coinciden"
        )

    usuario_completo = crud_usuarios.get_usuario_by_correo(db, current_user["correo"])

    if not verify_password(datos.password_actual, usuario_completo["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña actual es incorrecta"
        )

    if datos.password_actual == datos.password_nueva:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña no puede ser igual a la actual"
        )

    crud_usuarios.cambiar_password(db, current_user["id"], datos.password_nueva)
    crud_auth.revocar_todos_refresh_tokens(db, current_user["id"])

    return {"message": "Contraseña actualizada correctamente"}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user_primer_login)):
    """Devuelve los datos del funcionario autenticado."""
    return current_user