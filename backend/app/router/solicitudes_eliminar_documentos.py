import logging
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel as PydanticBaseModel

from core.database import get_db
from core.config import settings
from core.security import verify_password
from app.schemas.solicitudes import (
    EliminarDocumentosSolicitudRequest,
    EliminarDocumentosSolicitudResponse,
    SolicitudEliminada
)
from app.crud import solicitudes_eliminar_documentos as crud_eliminar
from app.crud import solicitudes as crud_solicitudes
from app.crud import usuarios as crud_usuarios
from app.router.dependencies import get_current_user, check_permission
from app.utils.auditoria import registrar

logger = logging.getLogger(__name__)

router = APIRouter()


# -------------------------------------------------------
# Endpoint: Eliminar documentos de solicitudes certificadas
# -------------------------------------------------------

@router.post(
    "/eliminar-documentos",
    response_model=EliminarDocumentosSolicitudResponse,
    status_code=status.HTTP_200_OK
)
async def eliminar_documentos_solicitudes(
    request: Request,
    payload: EliminarDocumentosSolicitudRequest,
    db: Session = Depends(get_db),
    usuario_actual = Depends(check_permission("solicitudes", "eliminar"))
):
    """
    Elimina los documentos de múltiples solicitudes certificadas.
    
    SOLO accesible por: ADMIN y FUNCIONARIO_CERTIFICACION
    
    Requisitos:
    - Las solicitudes deben estar en estado CERTIFICADO
    - Deben tener documentos (documentos_eliminados = FALSE)
    - El usuario debe ingresar su contraseña
    
    Resultado:
    - Elimina archivos físicos
    - Elimina registros de BD
    - Marca solicitud como documentos_eliminados = TRUE
    - Registra en auditoría
    """
    
    # -------------------------------------------------------
    # 1. Validar contraseña del usuario
    # -------------------------------------------------------
    usuario_id = int(usuario_actual['id'])
    usuario = crud_usuarios.get_usuario_by_id_con_password(db, usuario_id)
    
    if not usuario:
        logger.error(f"Usuario {usuario_id} no encontrado")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido"
        )
    
    if not verify_password(payload.password, usuario['password_hash']):
        logger.warning(f"Intento fallido de eliminar documentos por usuario {usuario_id}: contraseña incorrecta")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )
    
    # -------------------------------------------------------
    # 2. Validar que solicitudes existan y sean CERTIFICADO
    # -------------------------------------------------------
    solicitudes_validas = crud_eliminar.obtener_solicitudes_certificadas_sin_docs_eliminados(
        db, payload.solicitud_ids
    )
    
    if not solicitudes_validas:
        logger.warning(f"Usuario {usuario_id}: Ninguna solicitud válida para eliminar documentos")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay solicitudes certificadas con documentos para eliminar"
        )
    
    # Obtener IDs de solicitudes válidas
    solicitud_ids_validos = {s['id'] for s in solicitudes_validas}
    
    # -------------------------------------------------------
    # 3. Procesar eliminación
    # -------------------------------------------------------
    detalles = []
    exitosas = 0
    fallidas = 0
    
    for solicitud in solicitudes_validas:
        try:
            solicitud_id = solicitud['id']
            
            # Eliminar documentos
            eliminados, errores = crud_eliminar.eliminar_todos_documentos_solicitud(
                db, 
                solicitud_id,
                settings.UPLOAD_DIR
            )
            
            if errores:
                # Aunque haya errores, si algunos archivos se eliminaron, se considera parcialmente exitoso
                detalles.append(SolicitudEliminada(
                    solicitud_id=solicitud_id,
                    numero_documento=solicitud['numero_documento'],
                    numero_ficha=solicitud['numero_ficha'],
                    nombre_aprendiz=solicitud['nombre_aprendiz'],
                    documentos_cantidad=solicitud['cantidad_documentos'],
                    documentos_eliminados=eliminados,
                    estado="parcial",
                    mensaje=f"Eliminados {eliminados}/{solicitud['cantidad_documentos']} documentos. Errores: {', '.join(errores[:3])}"
                ))
                exitosas += 1
            else:
                detalles.append(SolicitudEliminada(
                    solicitud_id=solicitud_id,
                    numero_documento=solicitud['numero_documento'],
                    numero_ficha=solicitud['numero_ficha'],
                    nombre_aprendiz=solicitud['nombre_aprendiz'],
                    documentos_cantidad=solicitud['cantidad_documentos'],
                    documentos_eliminados=eliminados,
                    estado="éxito",
                    mensaje=f"Se eliminaron {eliminados} documento(s)"
                ))
                exitosas += 1
            
            # Registrar en auditoría
            try:
                registrar(
                    db=db,
                    accion="Eliminar Documentos Solicitud",
                    tabla_afectada="solicitud_documentos",
                    registro_id=solicitud_id,
                    descripcion=f"Eliminados {eliminados} documento(s) de solicitud {solicitud['numero_documento']}/{solicitud['numero_ficha']}",
                    usuario_id=usuario_id,
                    ip_origen=request.client.host if request.client else "desconocida"
                )
            except Exception as e:
                logger.error(f"Error registrando auditoría: {e}")
                # No fallar la operación por error en auditoría
            
        except Exception as e:
            logger.error(f"Error eliminando documentos de solicitud {solicitud['id']}: {e}")
            fallidas += 1
            detalles.append(SolicitudEliminada(
                solicitud_id=solicitud['id'],
                numero_documento=solicitud['numero_documento'],
                numero_ficha=solicitud['numero_ficha'],
                nombre_aprendiz=solicitud['nombre_aprendiz'],
                documentos_cantidad=solicitud['cantidad_documentos'],
                documentos_eliminados=0,
                estado="error",
                mensaje=f"Error: {str(e)[:100]}"
            ))
    
    # -------------------------------------------------------
    # 4. Retornar resultado
    # -------------------------------------------------------
    mensaje_resumen = f"Procesadas {exitosas} solicitudes exitosamente"
    if fallidas > 0:
        mensaje_resumen += f" y {fallidas} con errores"
    
    logger.info(f"Usuario {usuario_id} eliminó documentos de {exitosas} solicitudes (fallidas: {fallidas})")
    
    return EliminarDocumentosSolicitudResponse(
        total_solicitudes=len(solicitudes_validas),
        exitosas=exitosas,
        fallidas=fallidas,
        detalles=detalles,
        mensaje_resumen=mensaje_resumen
    )
