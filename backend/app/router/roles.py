import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from app.schemas.roles import (
    RolCreate, RolUpdate, RolOut, RolConPermisos,
    ModuloOut, AccionOut, PermisoCreate
)
from app.crud import roles as crud_roles
from app.router.dependencies import check_permission, require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# -------------------------------------------------------
# Roles
# -------------------------------------------------------

@router.get("/", response_model=List[RolOut])
def listar_roles(
    incluir_inactivos: bool = True,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("roles", "leer"))
):
    return crud_roles.get_all_roles(db, incluir_inactivos=incluir_inactivos)


@router.get("/modulos", response_model=List[ModuloOut])
def listar_modulos(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """Lista todos los módulos disponibles para asignar permisos."""
    return crud_roles.get_all_modulos(db)


@router.get("/acciones", response_model=List[AccionOut])
def listar_acciones(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """Lista todas las acciones disponibles para asignar permisos."""
    return crud_roles.get_all_acciones(db)


@router.get("/{rol_id}", response_model=RolConPermisos)
def obtener_rol(
    rol_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """Obtiene un rol con todos sus permisos."""
    rol = crud_roles.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )
    return rol


@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_rol(
    datos: RolCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Crea un nuevo rol.
    El nombre se convierte automáticamente a mayúsculas.
    El rol se crea sin permisos, asígnalos con POST /{rol_id}/permisos.
    """
    if crud_roles.get_rol_by_nombre(db, datos.nombre.upper()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un rol con ese nombre"
        )

    rol_id = crud_roles.create_rol(db, datos.nombre, datos.descripcion, datos.requiere_firma)

    from app.utils.auditoria import registrar
    registrar(db, "ROL_CREADO", "roles", rol_id,
              f"Rol creado: {datos.nombre.upper()}", current_user["id"])

    return {"message": "Rol creado correctamente", "rol_id": rol_id}


@router.put("/{rol_id}")
def actualizar_rol(
    rol_id: int,
    datos: RolUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Actualiza la descripción y/o si requiere firma de un rol."""
    rol = crud_roles.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )

    crud_roles.update_rol(db, rol_id, datos.model_dump(exclude_unset=True))

    from app.utils.auditoria import registrar
    registrar(db, "ROL_ACTUALIZADO", "roles", rol_id,
              f"Rol actualizado: {rol['nombre']}", current_user["id"])

    return {"message": "Rol actualizado correctamente"}


@router.put("/{rol_id}/estado")
def cambiar_estado_rol(
    rol_id: int,
    activo: bool,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Activa o desactiva un rol.
    No se puede desactivar un rol que tiene usuarios asignados.
    """
    rol = crud_roles.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )

    if not activo and crud_roles.rol_tiene_usuarios(db, rol_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede desactivar un rol que tiene usuarios asignados"
        )

    crud_roles.toggle_rol_activo(db, rol_id, activo)
    estado = "activado" if activo else "desactivado"

    from app.utils.auditoria import registrar
    registrar(db, f"ROL_{estado.upper()}", "roles", rol_id,
              f"Rol {estado}: {rol['nombre']}", current_user["id"])

    return {"message": f"Rol {estado} correctamente"}


# -------------------------------------------------------
# Permisos
# -------------------------------------------------------

@router.post("/{rol_id}/permisos", status_code=status.HTTP_201_CREATED)
def asignar_permiso(
    rol_id: int,
    datos: PermisoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Asigna un permiso (módulo + acción) a un rol."""
    rol = crud_roles.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )

    if crud_roles.permiso_exists(db, rol_id, datos.modulo_id, datos.accion_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol ya tiene ese permiso asignado"
        )

    crud_roles.asignar_permiso(db, rol_id, datos.modulo_id, datos.accion_id)

    from app.utils.auditoria import registrar
    registrar(db, "PERMISO_ASIGNADO", "rol_permisos", rol_id,
              f"Permiso asignado a {rol['nombre']}: módulo {datos.modulo_id} acción {datos.accion_id}",
              current_user["id"])

    return {"message": "Permiso asignado correctamente"}


@router.delete("/{rol_id}/permisos/{permiso_id}")
def revocar_permiso(
    rol_id: int,
    permiso_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Revoca un permiso específico de un rol."""
    rol = crud_roles.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )

    crud_roles.revocar_permiso(db, permiso_id)

    from app.utils.auditoria import registrar
    registrar(db, "PERMISO_REVOCADO", "rol_permisos", rol_id,
              f"Permiso {permiso_id} revocado de {rol['nombre']}", current_user["id"])

    return {"message": "Permiso revocado correctamente"}


@router.delete("/{rol_id}/permisos")
def revocar_todos_permisos(
    rol_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Revoca todos los permisos de un rol. Útil para reconfigurar permisos desde cero."""
    rol = crud_roles.get_rol_by_id(db, rol_id)
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rol no encontrado"
        )

    crud_roles.revocar_todos_permisos(db, rol_id)

    from app.utils.auditoria import registrar
    registrar(db, "PERMISOS_REVOCADOS", "rol_permisos", rol_id,
              f"Todos los permisos revocados de {rol['nombre']}", current_user["id"])

    return {"message": "Todos los permisos del rol fueron revocados"}