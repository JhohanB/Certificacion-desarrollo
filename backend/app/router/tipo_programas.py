import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from app.schemas.tipo_programas import (
    TipoProgramaCreate, TipoProgramaUpdate, TipoProgramaOut,
    TipoProgramaDetalleOut, DocumentoRequeridoCreate, DocumentoRequeridoUpdate,
    DocumentoRequeridoOut, AsignarDocumentoCreate, AsignarRolFirmanteCreate
)
from app.crud import tipo_programas as crud_tipos
from app.router.dependencies import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# -------------------------------------------------------
# Tipos de programa
# -------------------------------------------------------

@router.get("/", response_model=List[TipoProgramaOut])
def listar_tipos_programa(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """Lista todos los tipos de programa."""
    return crud_tipos.get_all_tipos_programa(db)


@router.get("/{tipo_id}", response_model=TipoProgramaDetalleOut)
def obtener_tipo_programa(
    tipo_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """Obtiene un tipo de programa con sus documentos y roles firmantes."""
    tipo = crud_tipos.get_tipo_programa_by_id(db, tipo_id)
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de programa no encontrado"
        )
    return tipo


@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_tipo_programa(
    datos: TipoProgramaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Crea un nuevo tipo de programa. El nombre se convierte a mayúsculas."""
    if crud_tipos.get_tipo_programa_by_nombre(db, datos.nombre):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un tipo de programa con ese nombre"
        )

    tipo_id = crud_tipos.create_tipo_programa(db, datos.nombre)

    from app.utils.auditoria import registrar
    registrar(db, "TIPO_PROGRAMA_CREADO", "tipo_programas", tipo_id,
              f"Tipo de programa creado: {datos.nombre.upper()}", current_user["id"])

    return {"message": "Tipo de programa creado correctamente", "tipo_id": tipo_id}


@router.put("/{tipo_id}")
def actualizar_tipo_programa(
    tipo_id: int,
    datos: TipoProgramaUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Actualiza el nombre de un tipo de programa."""
    tipo = crud_tipos.get_tipo_programa_by_id(db, tipo_id)
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de programa no encontrado"
        )

    existente = crud_tipos.get_tipo_programa_by_nombre(db, datos.nombre)
    if existente and existente["id"] != tipo_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un tipo de programa con ese nombre"
        )

    crud_tipos.update_tipo_programa(db, tipo_id, datos.nombre)

    from app.utils.auditoria import registrar
    registrar(db, "TIPO_PROGRAMA_ACTUALIZADO", "tipo_programas", tipo_id,
              f"Tipo de programa actualizado: {datos.nombre.upper()}", current_user["id"])

    return {"message": "Tipo de programa actualizado correctamente"}


@router.delete("/{tipo_id}")
def eliminar_tipo_programa(
    tipo_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Elimina un tipo de programa y sus relaciones con documentos y roles.
    No se puede eliminar si tiene solicitudes asociadas.
    """
    tipo = crud_tipos.get_tipo_programa_by_id(db, tipo_id)
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de programa no encontrado"
        )

    if crud_tipos.tipo_programa_tiene_solicitudes(db, tipo_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un tipo de programa que tiene solicitudes asociadas"
        )

    crud_tipos.delete_tipo_programa(db, tipo_id)

    from app.utils.auditoria import registrar
    registrar(db, "TIPO_PROGRAMA_ELIMINADO", "tipo_programas", tipo_id,
              f"Tipo de programa eliminado: {tipo['nombre']}", current_user["id"])

    return {"message": "Tipo de programa eliminado correctamente"}


# -------------------------------------------------------
# Relación tipo_programa - documentos
# -------------------------------------------------------

@router.post("/{tipo_id}/documentos", status_code=status.HTTP_201_CREATED)
def asignar_documento(
    tipo_id: int,
    datos: AsignarDocumentoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Asigna un documento requerido a un tipo de programa."""
    tipo = crud_tipos.get_tipo_programa_by_id(db, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de programa no encontrado")

    if crud_tipos.documento_asignado_a_tipo(db, tipo_id, datos.documento_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El documento ya está asignado a este tipo de programa")

    crud_tipos.asignar_documento_a_tipo(db, tipo_id, datos.documento_id, datos.obligatorio)

    from app.utils.auditoria import registrar
    registrar(db, "DOCUMENTO_ASIGNADO_A_TIPO", "tipo_programa_documentos", tipo_id,
              f"Documento {datos.documento_id} asignado a tipo {tipo_id}", current_user["id"])

    return {"message": "Documento asignado correctamente"}


@router.delete("/{tipo_id}/documentos/{relacion_id}")
def quitar_documento(
    tipo_id: int,
    relacion_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Quita un documento requerido de un tipo de programa."""
    crud_tipos.quitar_documento_de_tipo(db, relacion_id)

    from app.utils.auditoria import registrar
    registrar(db, "DOCUMENTO_QUITADO_DE_TIPO", "tipo_programa_documentos", tipo_id,
              f"Documento quitado de tipo {tipo_id}", current_user["id"])

    return {"message": "Documento quitado correctamente"}


# -------------------------------------------------------
# Relación tipo_programa - roles firmantes
# -------------------------------------------------------

@router.post("/{tipo_id}/roles", status_code=status.HTTP_201_CREATED)
def asignar_rol_firmante(
    tipo_id: int,
    datos: AsignarRolFirmanteCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Asigna un rol firmante a un tipo de programa con su orden de firma.
    El orden_firma determina el turno en que debe firmar cada rol.
    """
    tipo = crud_tipos.get_tipo_programa_by_id(db, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de programa no encontrado")

    if crud_tipos.rol_asignado_a_tipo(db, tipo_id, datos.rol_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El rol ya está asignado a este tipo de programa")

    crud_tipos.asignar_rol_a_tipo(db, tipo_id, datos.rol_id, datos.orden_firma, datos.obligatorio)

    from app.utils.auditoria import registrar
    registrar(db, "ROL_ASIGNADO_A_TIPO", "tipo_programa_roles", tipo_id,
              f"Rol {datos.rol_id} asignado a tipo {tipo_id} con orden {datos.orden_firma}", current_user["id"])

    return {"message": "Rol firmante asignado correctamente"}


@router.delete("/{tipo_id}/roles/{relacion_id}")
def quitar_rol_firmante(
    tipo_id: int,
    relacion_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Quita un rol firmante de un tipo de programa."""
    crud_tipos.quitar_rol_de_tipo(db, relacion_id)

    from app.utils.auditoria import registrar
    registrar(db, "ROL_QUITADO_DE_TIPO", "tipo_programa_roles", tipo_id,
              f"Rol quitado de tipo {tipo_id}", current_user["id"])

    return {"message": "Rol firmante quitado correctamente"}


# -------------------------------------------------------
# Documentos requeridos
# -------------------------------------------------------

@router.get("/documentos/", response_model=List[DocumentoRequeridoOut])
def listar_documentos_requeridos(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    """Lista todos los documentos requeridos disponibles."""
    return crud_tipos.get_all_documentos_requeridos(db)


@router.post("/documentos/", status_code=status.HTTP_201_CREATED)
def crear_documento_requerido(
    datos: DocumentoRequeridoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Crea un nuevo documento requerido."""
    doc_id = crud_tipos.create_documento_requerido(db, datos.nombre, datos.descripcion)

    from app.utils.auditoria import registrar
    registrar(db, "DOCUMENTO_REQUERIDO_CREADO", "documentos_requeridos", doc_id,
              f"Documento requerido creado: {datos.nombre}", current_user["id"])

    return {"message": "Documento requerido creado correctamente", "documento_id": doc_id}


@router.put("/documentos/{doc_id}")
def actualizar_documento_requerido(
    doc_id: int,
    datos: DocumentoRequeridoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Actualiza nombre y/o descripción de un documento requerido."""
    doc = crud_tipos.get_documento_requerido_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento requerido no encontrado")

    crud_tipos.update_documento_requerido(db, doc_id, datos.model_dump(exclude_unset=True))

    from app.utils.auditoria import registrar
    registrar(db, "DOCUMENTO_REQUERIDO_ACTUALIZADO", "documentos_requeridos", doc_id,
              f"Documento requerido actualizado: {doc['nombre']}", current_user["id"])

    return {"message": "Documento requerido actualizado correctamente"}


@router.delete("/documentos/{doc_id}")
def eliminar_documento_requerido(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Elimina un documento requerido.
    No se puede eliminar si está asignado a algún tipo de programa.
    """
    doc = crud_tipos.get_documento_requerido_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento requerido no encontrado")

    if crud_tipos.documento_en_uso(db, doc_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un documento que está asignado a un tipo de programa"
        )

    crud_tipos.delete_documento_requerido(db, doc_id)

    from app.utils.auditoria import registrar
    registrar(db, "DOCUMENTO_REQUERIDO_ELIMINADO", "documentos_requeridos", doc_id,
              f"Documento requerido eliminado: {doc['nombre']}", current_user["id"])

    return {"message": "Documento requerido eliminado correctamente"}


@router.put("/{tipo_id}/estado")
def cambiar_estado_tipo_programa(
    tipo_id: int,
    activo: bool,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin)
):
    from app.crud.tipo_programas import toggle_activo_tipo_programa
    try:
        toggle_activo_tipo_programa(db, tipo_id, activo)
        return {"message": f"Tipo de programa {'activado' if activo else 'desactivado'}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

