import os
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from app.schemas.plantillas import (
    CoordenadaFirmaCreate, PlantillaOut, PlantillaListOut
)
from app.crud import plantillas as crud_plantillas
from app.router.dependencies import check_permission

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[PlantillaListOut])
def listar_plantillas(
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("plantillas", "leer"))
):
    """Lista todas las versiones de plantillas."""
    return crud_plantillas.get_all_plantillas(db)


@router.get("/activa", response_model=PlantillaOut)
def get_plantilla_activa(
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("plantillas", "leer"))
):
    """Obtiene la plantilla activa con sus coordenadas."""
    plantilla = crud_plantillas.get_plantilla_activa(db)
    if not plantilla:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay ninguna plantilla activa"
        )
    return plantilla


@router.get("/{plantilla_id}", response_model=PlantillaOut)
def get_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("plantillas", "leer"))
):
    """Obtiene una plantilla con sus coordenadas."""
    plantilla = crud_plantillas.get_plantilla_by_id(db, plantilla_id)
    if not plantilla:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada"
        )
    return plantilla


@router.post("/", status_code=status.HTTP_201_CREATED)
async def subir_plantilla(
    version: str = Form(..., min_length=1, max_length=20),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("plantillas", "crear"))
):
    """
    Sube una nueva versión de la plantilla del paz y salvo.
    Solo acepta archivos PDF.
    La plantilla se crea inactiva hasta que se configuren
    las coordenadas y se active manualmente.
    """
    if not archivo.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La plantilla debe ser un archivo PDF"
        )

    contenido = await archivo.read()
    if not contenido.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es un PDF válido"
        )

    carpeta = f"{settings.UPLOAD_DIR}/plantillas"
    os.makedirs(carpeta, exist_ok=True)
    ruta = f"{carpeta}/plantilla_v{version}.pdf"

    with open(ruta, "wb") as f:
        f.write(contenido)

    plantilla_id = crud_plantillas.create_plantilla(db, version, ruta, current_user["id"])

    from app.utils.auditoria import registrar, PLANTILLA_SUBIDA
    registrar(db, PLANTILLA_SUBIDA, "plantillas_formato", plantilla_id,
              f"Plantilla v{version} subida", current_user["id"])

    return {
        "message": "Plantilla subida correctamente. Configure las coordenadas de firma antes de activarla",
        "plantilla_id": plantilla_id
    }


@router.put("/{plantilla_id}/coordenadas")
def guardar_coordenadas(
    plantilla_id: int,
    coordenadas: List[CoordenadaFirmaCreate],
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("plantillas", "editar"))
):
    """
    Guarda las coordenadas de firma para una plantilla.
    Las coordenadas se expresan en porcentaje (0-100) del tamaño de la página.
    Esto permite que funcionen independientemente del tamaño del PDF del aprendiz.
    Reemplaza las coordenadas anteriores si ya existían.
    """
    plantilla = crud_plantillas.get_plantilla_by_id(db, plantilla_id)
    if not plantilla:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada"
        )

    crud_plantillas.save_coordenadas(
        db, plantilla_id,
        [c.model_dump() for c in coordenadas]
    )

    from app.utils.auditoria import registrar, COORDENADAS_GUARDADAS
    registrar(db, COORDENADAS_GUARDADAS, "coordenadas_firma", plantilla_id,
              f"Coordenadas guardadas para plantilla {plantilla_id}", current_user["id"])

    return {"message": "Coordenadas guardadas correctamente"}


@router.post("/{plantilla_id}/activar")
def activar_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("plantillas", "editar"))
):
    """
    Activa una plantilla para que sea usada en nuevas solicitudes.
    Requiere que tenga coordenadas configuradas para todos los roles firmantes.
    Al activarla la plantilla anterior queda inactiva automáticamente.
    Las solicitudes existentes mantienen su plantilla original.
    """
    plantilla = crud_plantillas.get_plantilla_by_id(db, plantilla_id)
    if not plantilla:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada"
        )

    if plantilla["activa"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta plantilla ya está activa"
        )

    if not crud_plantillas.tiene_coordenadas_completas(db, plantilla_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La plantilla no tiene coordenadas configuradas para todos los roles firmantes activos"
        )

    crud_plantillas.activar_plantilla(db, plantilla_id)

    from app.utils.auditoria import registrar, PLANTILLA_ACTIVADA
    registrar(db, PLANTILLA_ACTIVADA, "plantillas_formato", plantilla_id,
              f"Plantilla v{plantilla['version']} activada", current_user["id"])

    return {"message": f"Plantilla versión {plantilla['version']} activada correctamente"}


@router.get("/{plantilla_id}/preview-coordenadas")
def preview_coordenadas(
    plantilla_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("plantillas", "leer"))
):
    """
    Devuelve las coordenadas de una plantilla para que el frontend
    pueda mostrar una previsualización de dónde quedarán las firmas.
    El frontend usa estas coordenadas con PDF.js para superponer
    las imágenes de firma sobre el PDF del aprendiz.
    """
    plantilla = crud_plantillas.get_plantilla_by_id(db, plantilla_id)
    if not plantilla:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada"
        )

    return {
        "plantilla_id": plantilla_id,
        "version": plantilla["version"],
        "coordenadas": plantilla["coordenadas"]
    }