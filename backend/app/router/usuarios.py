import os
import secrets
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from app.schemas.usuarios import (
    UsuarioCreate, UsuarioUpdate, UsuarioOut,
    UsuarioListOut, AsignarRol
)
from app.crud import usuarios as crud_usuarios
from app.router.dependencies import check_permission, get_current_user, get_current_user_primer_login, require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Crea un nuevo funcionario.
    Solo el ADMIN puede acceder a este endpoint.

    - Genera contraseña temporal automáticamente
    - Envía correo con la contraseña temporal
    - El funcionario deberá cambiarla en el primer login
    """
    if crud_usuarios.exists_by_correo(db, usuario.correo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un funcionario con ese correo"
        )

    if crud_usuarios.exists_by_documento(db, usuario.documento):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un funcionario con ese documento"
        )

    # Generar contraseña temporal legible
    password_temporal = secrets.token_urlsafe(10)

    # Verificar si alguno de los roles asignados requiere firma
    debe_registrar_firma = any(
        crud_usuarios.rol_requiere_firma(db, rol_id)
        for rol_id in usuario.roles
    )

    usuario_id = crud_usuarios.create_usuario(db, usuario, password_temporal, debe_registrar_firma)
    crud_usuarios.asignar_roles(db, usuario_id, usuario.roles)

    # Enviar correo de bienvenida con contraseña temporal
    from app.utils.email_service import enviar_bienvenida_funcionario
    await enviar_bienvenida_funcionario(
        correo=usuario.correo,
        nombre=usuario.nombre_completo,
        password_temporal=password_temporal,
    )
    from app.utils.auditoria import registrar, USUARIO_CREADO
    registrar(db, USUARIO_CREADO, "usuarios", usuario_id,
              f"Usuario creado: {usuario.correo}", current_user["id"])
    logger.info(f"Usuario {usuario.correo} creado. Correo de bienvenida enviado.")

    return {
        "message": "Funcionario creado correctamente, se enviaron las credenciales al correo",
        "usuario_id": usuario_id
    }


@router.get("/", response_model=List[UsuarioListOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """
    Lista todos los funcionarios del sistema.
    Solo el ADMIN puede acceder.
    """
    return crud_usuarios.get_all_usuarios(db)


@router.get("/coordinadores")
def listar_coordinadores(
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    """Lista usuarios con rol COORDINADOR activos. Accesible para funcionarios."""
    from sqlalchemy import text
    query = text("""
        SELECT u.id, u.nombre_completo, u.correo
        FROM usuarios u
        INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
        INNER JOIN roles r ON r.id = ur.rol_id
        WHERE r.nombre = 'COORDINADOR'
        AND u.activo = TRUE AND ur.activo = TRUE
        ORDER BY u.nombre_completo ASC
    """)
    return db.execute(query).mappings().all()


@router.get("/{usuario_id}", response_model=UsuarioOut)
def obtener_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene un funcionario por ID.
    El ADMIN puede ver cualquier usuario.
    Un funcionario solo puede verse a sí mismo.
    """
    roles_usuario = [r["nombre"] for r in current_user["roles"]]
    if "ADMIN" not in roles_usuario and current_user["id"] != usuario_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para ver este usuario"
        )

    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return usuario


@router.put("/{usuario_id}")
def actualizar_usuario(
    usuario_id: int,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Actualiza datos básicos de un funcionario.
    Cada funcionario solo puede actualizar sus propios datos.
    """
    if current_user["id"] != usuario_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puede actualizar sus propios datos"
        )

    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    crud_usuarios.update_usuario(db, usuario_id, datos)
    return {"message": "Datos actualizados correctamente"}


@router.put("/{usuario_id}/estado")
def cambiar_estado_usuario(
    usuario_id: int,
    activo: bool,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Activa o desactiva un funcionario.
    Solo el ADMIN puede acceder.
    El ADMIN no puede desactivarse a sí mismo.
    """
    if current_user["id"] == usuario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puede cambiar su propio estado"
        )

    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    crud_usuarios.toggle_activo(db, usuario_id, activo)
    estado = "activado" if activo else "desactivado"

    from app.utils.auditoria import registrar, USUARIO_ACTIVADO, USUARIO_DESACTIVADO
    accion_audit = USUARIO_ACTIVADO if activo else USUARIO_DESACTIVADO
    registrar(db, accion_audit, "usuarios", usuario_id,
              f"Usuario {estado}: {usuario['correo']}", current_user["id"])

    return {"message": f"Funcionario {estado} correctamente"}


@router.post("/{usuario_id}/firma")
def subir_firma(
    usuario_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_primer_login)
):
    """
    Sube la imagen de firma de un funcionario.

    - Accesible en el primer login aunque debe_registrar_firma = TRUE
    - El funcionario puede subir su propia firma
    - El ADMIN puede subir la firma de cualquier funcionario
    - Solo se permite para roles que requieren firma
    - Formatos permitidos: jpg, jpeg, png
    """
    roles_usuario = [r["nombre"] for r in current_user["roles"]]
    if "ADMIN" not in roles_usuario and current_user["id"] != usuario_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para subir esta firma"
        )

    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    # Verificar que al menos uno de sus roles requiere firma
    requiere_firma = any(r["requiere_firma"] for r in usuario["roles"])
    if not requiere_firma:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este funcionario no requiere firma registrada"
        )

    # Validar extensión del archivo
    extension = archivo.filename.split(".")[-1].lower()
    if extension not in ["jpg", "jpeg", "png"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten imágenes JPG o PNG"
        )

    # Eliminar firma anterior si existe
    os.makedirs(f"{settings.UPLOAD_DIR}/firmas", exist_ok=True)
    carpeta_firmas = f"{settings.UPLOAD_DIR}/firmas"
    for ext in ["png", "jpg", "jpeg"]:
        ruta_anterior = f"{carpeta_firmas}/firma_{usuario_id}.{ext}"
        if os.path.exists(ruta_anterior):
            os.remove(ruta_anterior)
            logger.info(f"Firma anterior eliminada: {ruta_anterior}")

    nombre_archivo = f"firma_{usuario_id}.png"  # Siempre PNG para soportar transparencia
    ruta = f"{carpeta_firmas}/{nombre_archivo}"

    contenido = archivo.file.read()

    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(contenido)).convert("RGBA")

        # Hacer transparente el fondo blanco/claro
        datos = img.getdata()
        nuevos_datos = []
        umbral = 200  # Píxeles más claros que este valor se hacen transparentes
        for pixel in datos:
            r, g, b, a = pixel
            if r > umbral and g > umbral and b > umbral:
                nuevos_datos.append((r, g, b, 0))  # Transparente
            else:
                nuevos_datos.append(pixel)
        img.putdata(nuevos_datos)

        img.save(ruta, "PNG")
        logger.info(f"Firma procesada con fondo transparente para usuario {usuario_id}")

    except Exception as e:
        logger.warning(f"No se pudo procesar la imagen, guardando original: {e}")
        with open(ruta, "wb") as f:
            f.write(contenido)

    crud_usuarios.update_firma_url(db, usuario_id, ruta)

    from app.utils.auditoria import registrar, FIRMA_REGISTRADA
    registrar(db, FIRMA_REGISTRADA, "usuarios", usuario_id,
              f"Firma registrada para usuario {usuario_id}", current_user["id"])

    return {"message": "Firma registrada correctamente", "firma_url": ruta}


@router.post("/{usuario_id}/roles")
def agregar_rol(
    usuario_id: int,
    datos: AsignarRol,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """
    Agrega un rol a un funcionario existente.
    Solo el ADMIN puede acceder.
    """
    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    crud_usuarios.agregar_rol(db, usuario_id, datos.rol_id)
    return {"message": "Rol asignado correctamente"}


@router.delete("/{usuario_id}/roles/{rol_id}")
def revocar_rol(
    usuario_id: int,
    rol_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Revoca un rol de un funcionario.
    Solo el ADMIN puede acceder.
    """
    if current_user["id"] == usuario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puede revocar sus propios roles"
        )

    crud_usuarios.revocar_rol(db, usuario_id, rol_id)
    return {"message": "Rol revocado correctamente"}



@router.post("/{usuario_id}/restablecer-password")
async def restablecer_password(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Restablece la contraseña de un usuario generando una clave temporal
    y enviándola al correo del usuario.
    Solo el ADMIN puede acceder.
    """
    if current_user["id"] == usuario_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puede restablecer su propia contraseña"
        )

    usuario = crud_usuarios.get_usuario_by_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    # Generar clave temporal
    password_temporal = secrets.token_urlsafe(10)

    # Actualizar contraseña y forzar cambio en próximo login
    crud_usuarios.reset_password(db, usuario_id, password_temporal)

    # Revocar todos los refresh tokens activos
    from app.crud.auth import revocar_todos_refresh_tokens
    revocar_todos_refresh_tokens(db, usuario_id)

    # Enviar correo con clave temporal
    from app.utils.email_service import enviar_restablecer_password
    await enviar_restablecer_password(
        correo=usuario["correo"],
        nombre=usuario["nombre_completo"],
        password_temporal=password_temporal,
    )

    from app.utils.auditoria import registrar, USUARIO_CREADO
    registrar(db, USUARIO_CREADO, "usuarios", usuario_id,
              f"Contraseña restablecida para: {usuario['correo']}", current_user["id"])

    return {"message": "Contraseña restablecida y enviada al correo del usuario"}