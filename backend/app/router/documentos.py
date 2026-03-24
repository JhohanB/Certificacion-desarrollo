import os
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from core.security import verify_password
from app.schemas.documentos import (
    RevisarDocumento, FirmarSolicitud, RechazarFirma,
    FirmaOut, EstadoFirma, ReubicarDocumento
)
from app.crud import documentos as crud_docs
from app.crud import solicitudes as crud_solicitudes
from app.router.dependencies import check_permission
from app.utils.email_service import (
    enviar_certificacion_completada,
)
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()


# -------------------------------------------------------
# Revisión de documentos (funcionario de certificación)
# -------------------------------------------------------

@router.put("/{documento_id}/revisar")
async def revisar_documento(
    documento_id: int,
    datos: RevisarDocumento,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("documentos", "aprobar"))
):
    """
    Aprueba u observa un documento de una solicitud.
    Ya no pasa automáticamente a PENDIENTE_FIRMAS.
    El funcionario debe usar confirmar-revision para eso.
    """
    documento = crud_docs.get_documento_by_id(db, documento_id)
    if not documento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    solicitud = crud_solicitudes.get_solicitud_by_id(db, documento["solicitud_id"])
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )

    estados_permitidos = ["PENDIENTE_REVISION", "CORREGIDO"]
    if solicitud["estado_actual"] not in estados_permitidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pueden revisar documentos en estado '{solicitud['estado_actual']}'"
        )

    if documento["bloqueado"] and datos.estado_documento.value != "OBSERVADO":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este documento está bloqueado y no puede modificarse"
        )

    crud_docs.revisar_documento(
        db, documento_id,
        datos.estado_documento.value,
        datos.observaciones,
        current_user["id"]
    )

    solicitud_id = documento["solicitud_id"]

    from app.utils.auditoria import registrar, DOCUMENTO_OBSERVADO
    if datos.estado_documento.value == "OBSERVADO":
        registrar(db, DOCUMENTO_OBSERVADO, "solicitud_documentos", documento_id,
                  f"Documento observado en solicitud {solicitud_id}: {datos.observaciones}", current_user["id"])

    return {"message": f"Documento marcado como {datos.estado_documento.value}"}


# -------------------------------------------------------
# Corrección de documentos por aprendiz (con token)
# -------------------------------------------------------

@router.get("/corregir/{token}")
def obtener_documentos_para_corregir(token: str, db: Session = Depends(get_db)):
    """
    Obtiene los documentos observados de una solicitud usando el token.
    No requiere login.
    El token debe ser válido y no haber sido usado.
    """
    token_data = crud_docs.get_token_edicion(db, token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token no encontrado"
        )
    if token_data["usado"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este enlace ya fue utilizado. Contacte al funcionario de certificación si necesita uno nuevo"
        )

    documentos = crud_docs.get_documentos_observados(db, token_data["solicitud_id"])
    solicitud = crud_solicitudes.get_solicitud_by_id(db, token_data["solicitud_id"])

    return {
        "solicitud_id": token_data["solicitud_id"],
        "nombre_aprendiz": solicitud["nombre_aprendiz"],
        "nombre_programa": solicitud["nombre_programa"],
        "documentos_observados": documentos
    }


@router.post("/corregir/{token}")
async def corregir_documentos(
    token: str,
    archivos: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    El aprendiz sube los documentos corregidos usando su token.
    No requiere login.

    - Valida el token
    - Valida que los archivos sean PDF
    - Reemplaza los documentos observados con las nuevas versiones
    - Marca el token como usado
    - Cambia el estado a CORREGIDO
    """
    token_data = crud_docs.get_token_edicion(db, token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token no encontrado"
        )
    if token_data["usado"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este enlace ya fue utilizado"
        )

    solicitud_id = token_data["solicitud_id"]
    docs_observados = crud_docs.get_documentos_observados(db, solicitud_id)

    if not docs_observados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay documentos pendientes de corrección"
        )

    if len(archivos) != len(docs_observados):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Se esperan {len(docs_observados)} documentos corregidos, se recibieron {len(archivos)}"
        )

    # Validar archivos
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    for archivo in archivos:
        extension = archivo.filename.split(".")[-1].lower()
        if extension != "pdf":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo '{archivo.filename}' no es un PDF"
            )
        contenido = await archivo.read()
        if len(contenido) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo '{archivo.filename}' supera el tamaño máximo de {settings.MAX_FILE_SIZE_MB}MB"
            )
        if not contenido.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo '{archivo.filename}' no es un PDF válido"
            )
        await archivo.seek(0)

    # Guardar documentos corregidos
    carpeta = f"{settings.UPLOAD_DIR}/{solicitud_id}"
    os.makedirs(carpeta, exist_ok=True)

    for archivo, doc in zip(archivos, docs_observados):
        contenido = await archivo.read()
        nombre_archivo = f"doc_{doc['documento_id']}_v{doc['version'] + 1}.pdf"
        ruta = f"{carpeta}/{nombre_archivo}"

        with open(ruta, "wb") as f:
            f.write(contenido)

        crud_docs.reemplazar_documento(db, solicitud_id, doc["documento_id"], ruta)

    # Marcar token como usado y cambiar estado
    crud_docs.marcar_token_usado(db, token)
    crud_solicitudes.update_estado_solicitud(
        db, solicitud_id, "CORREGIDO", None, "Aprendiz corrigió documentos observados"
    )

    logger.info(f"Solicitud {solicitud_id} corregida por aprendiz")

    return {"message": "Documentos corregidos correctamente. El funcionario revisará sus documentos nuevamente"}


@router.get("/corregir/{token}/solicitud")
def get_solicitud_por_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Obtiene los datos completos de la solicitud asociada al token.
    No requiere login.
    """
    from app.crud.documentos import get_token_edicion
    from app.crud.solicitudes import get_solicitud_by_id

    token_data = get_token_edicion(db, token)
    if not token_data:
        raise HTTPException(status_code=404, detail="Token no encontrado")
    if token_data["usado"]:
        raise HTTPException(status_code=400, detail="Este enlace ya fue utilizado")

    solicitud = get_solicitud_by_id(db, token_data["solicitud_id"])
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    return solicitud


@router.put("/{documento_id}/reubicar")
def reubicar_documento(
    documento_id: int,
    datos: ReubicarDocumento,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("documentos", "aprobar"))
):
    """
    Reasigna el tipo de documento de un archivo ya subido.
    Se usa cuando el aprendiz sube un archivo en el campo equivocado.

    Validaciones:
    - El nuevo_documento_id debe ser requerido para el tipo de programa de la solicitud
    - No debe existir ya un archivo activo con ese documento_id en la solicitud
    - El documento debe estar en estado PENDIENTE u OBSERVADO (no APROBADO)
    """
    documento = crud_docs.get_documento_by_id(db, documento_id)
    if not documento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    if documento["estado_documento"] == "APROBADO":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede reubicar un documento ya aprobado"
        )

    if documento["documento_id"] == datos.nuevo_documento_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El documento ya está asignado a ese tipo"
        )

    resultado = crud_docs.reubicar_documento(db, documento_id, datos.nuevo_documento_id)

    if not resultado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede reubicar: el tipo de documento no es válido para este programa o ya existe un archivo en ese campo"
        )

    return {"message": "Documento reubicado correctamente"}

# -------------------------------------------------------
# Firmas
# -------------------------------------------------------

@router.get("/{solicitud_id}/firmas", response_model=List[FirmaOut])
def get_firmas(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("firmas", "leer"))
):
    """Obtiene el estado de todas las firmas de una solicitud."""
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    return crud_docs.get_firmas_by_solicitud(db, solicitud_id)


@router.post("/{solicitud_id}/firmar")
async def firmar_solicitud(
    solicitud_id: int,
    datos: FirmarSolicitud,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("firmas", "firmar"))
):
    """
    El funcionario firma una solicitud ingresando su contraseña.

    Reglas:
    - La solicitud debe estar en PENDIENTE_FIRMAS
    - El funcionario debe tener un rol firmante en esa solicitud
    - El Coordinador solo puede firmar si todos los demás ya firmaron
    - Si todos firmaron → estado PENDIENTE_CERTIFICACION
    """
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )

    if solicitud["estado_actual"] != "PENDIENTE_FIRMAS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La solicitud no está en estado de firma"
        )

    # Verificar contraseña
    usuario_completo = crud_solicitudes.get_usuario_by_id_con_password(db, current_user["id"])
    if not verify_password(datos.password, usuario_completo["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )

    # Verificar que el funcionario tenga firma registrada si su rol la requiere
    roles_requieren_firma = [r for r in current_user["roles"] if r.get("requiere_firma")]
    if roles_requieren_firma:
        from app.crud.usuarios import get_usuario_by_id
        usuario_data = get_usuario_by_id(db, current_user["id"])
        if not usuario_data or not usuario_data.get("firma_url"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe registrar su firma antes de poder firmar solicitudes. Ingrese a su perfil y suba su imagen de firma"
            )

    # Obtener el rol firmante del usuario en esta solicitud
    firma = None
    for rol in current_user["roles"]:
        f = crud_docs.get_firma_by_solicitud_rol(db, solicitud_id, rol["id"])
        if f and f["estado_firma"] == "PENDIENTE":
            # Si la firma tiene usuario_id asignado, verificar que sea el usuario actual
            if f.get("usuario_id") is not None and f["usuario_id"] != current_user["id"]:
                continue  # Esta firma es de otro coordinador
            firma = f
            break

    if not firma:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tiene una firma pendiente en esta solicitud"
        )

    # Verificar orden de firma: orden 0 = libre, orden > 0 debe esperar a los de menor orden
    if not crud_docs.todos_anteriores_firmaron(db, solicitud_id, firma["rol_id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe esperar a que los roles anteriores hayan firmado antes que usted"
        )

    # Registrar firma
    ip_origen = request.client.host
    crud_docs.registrar_firma(db, solicitud_id, firma["rol_id"], current_user["id"], ip_origen)

    from app.utils.auditoria import registrar, SOLICITUD_FIRMADA
    registrar(db, SOLICITUD_FIRMADA, "firmas", solicitud_id,
              f"Solicitud {solicitud_id} firmada por {current_user['nombre_completo']}",
              current_user["id"], ip_origen)

    # Verificar si todas las firmas están completas
    if crud_docs.todas_firmas_completadas(db, solicitud_id):
        # Incrustar firmas en el PDF consolidado
        try:
            from app.utils.pdf import incrustar_firmas_en_pdf
            from app.crud.plantillas import get_coordenadas_by_plantilla

            solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
            pdf_original = solicitud["pdf_consolidado_url"]

            # Obtener firmas con imagen de cada funcionario
            firmas_completas = crud_docs.get_firmas_con_imagen(db, solicitud_id)

            # Obtener coordenadas de la plantilla asignada a esta solicitud
            plantilla_id = solicitud.get("plantilla_id")
            if not plantilla_id:
                raise Exception("La solicitud no tiene plantilla de formato asignada")

            coordenadas = get_coordenadas_by_plantilla(db, plantilla_id)
            if not coordenadas:
                raise Exception("La plantilla no tiene coordenadas de firma configuradas")

            # Generar PDF con firmas incrustadas
            carpeta_pdf = os.path.dirname(pdf_original)
            timestamp_firmado = datetime.now().strftime("%Y%m%d_%H%M%S")
            ruta_firmado = f"{carpeta_pdf}/consolidado_firmado_{timestamp_firmado}.pdf"
            ruta_final, hash_final = incrustar_firmas_en_pdf(
                ruta_pdf_original=pdf_original,
                firmas=list(firmas_completas),
                coordenadas=list(coordenadas),
                ruta_salida=ruta_firmado
            )

            # Actualizar URL y hash del PDF consolidado
            crud_docs.update_pdf_consolidado(db, solicitud_id, ruta_final, hash_final)
            logger.info(f"Firmas incrustadas en PDF de solicitud {solicitud_id}")

        except Exception as e:
            logger.error(f"Error al incrustar firmas en solicitud {solicitud_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al generar el PDF con firmas: {str(e)}"
            )

        crud_solicitudes.update_estado_solicitud(
            db, solicitud_id, "PENDIENTE_CERTIFICACION",
            current_user["id"], "Todas las firmas completadas"
        )
        logger.info(f"Solicitud {solicitud_id} pasó a PENDIENTE_CERTIFICACION")
        return {"message": "Firma registrada. Todas las firmas completadas, solicitud lista para certificación"}

    return {"message": "Firma registrada correctamente"}


@router.post("/{solicitud_id}/rechazar-firma")
async def rechazar_firma(
    solicitud_id: int,
    datos: RechazarFirma,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("firmas", "firmar"))
):
    """
    El funcionario rechaza firmar una solicitud indicando el motivo.
    """
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )

    if solicitud["estado_actual"] != "PENDIENTE_FIRMAS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La solicitud no está en estado de firma"
        )

    # Verificar contraseña
    usuario_completo = crud_solicitudes.get_usuario_by_id_con_password(db, current_user["id"])
    if not verify_password(datos.password, usuario_completo["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )

    # Obtener firma pendiente del usuario
    firma = None
    for rol in current_user["roles"]:
        f = crud_docs.get_firma_by_solicitud_rol(db, solicitud_id, rol["id"])
        if f and f["estado_firma"] == "PENDIENTE":
            if f.get("usuario_id") is not None and f["usuario_id"] != current_user["id"]:
                continue
            firma = f
            break

    if not firma:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tiene una firma pendiente en esta solicitud"
        )

    ip_origen = request.client.host

    # Registrar rechazo solo de esta firma
    crud_docs.registrar_rechazo_firma(
        db, solicitud_id, firma["rol_id"],
        current_user["id"], datos.motivo_rechazo, ip_origen
    )

    # Guardar observación
    from sqlalchemy import text as sql_text
    motivo_completo = f"Rechazado por {firma['nombre_rol']} ({current_user['nombre_completo']}): {datos.motivo_rechazo}"
    db.execute(sql_text("""
        UPDATE solicitudes SET observaciones_generales = :motivo WHERE id = :id
    """), {"motivo": motivo_completo, "id": solicitud_id})
    db.commit()

    # Cambiar estado a PENDIENTE_REVISION sin eliminar PDF ni otras firmas
    crud_solicitudes.update_estado_solicitud(
        db, solicitud_id, "PENDIENTE_REVISION",
        current_user["id"], f"Firma rechazada por {firma['nombre_rol']}: {datos.motivo_rechazo}"
    )

    return {"message": "Rechazo registrado. La solicitud vuelve a revisión del funcionario."}


# -------------------------------------------------------
# Marcar como certificado (funcionario de certificación)
# -------------------------------------------------------


@router.get("/{solicitud_id}/pdf")
def descargar_pdf(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "descargar"))
):
    import urllib.parse
    from fastapi.responses import FileResponse

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    pdf_url = solicitud.get("pdf_consolidado_url")
    if not pdf_url:
        raise HTTPException(status_code=404, detail="Esta solicitud aún no tiene PDF generado")

    if not os.path.exists(pdf_url):
        raise HTTPException(status_code=404, detail="El archivo PDF no fue encontrado en el servidor")

    nombre_archivo = f"PAZ Y SALVO {solicitud['numero_documento']} {solicitud['nombre_aprendiz']}.pdf"
    nombre_encoded = urllib.parse.quote(nombre_archivo)

    return FileResponse(
        path=pdf_url,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{nombre_encoded}"
        }
    )

@router.put("/{solicitud_id}/certificar")
async def certificar_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "certificar"))
):
    """
    El funcionario de certificación marca la solicitud como CERTIFICADO
    después de realizar el proceso en el sistema oficial del SENA.
    Solo disponible cuando el estado es PENDIENTE_CERTIFICACION.
    """
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )

    if solicitud["estado_actual"] != "PENDIENTE_CERTIFICACION":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La solicitud no está en estado de certificación"
        )

    crud_solicitudes.update_estado_solicitud(
        db, solicitud_id, "CERTIFICADO",
        current_user["id"], "Certificación completada en sistema oficial SENA"
    )

    # Notificar al aprendiz que fue certificado
    await enviar_certificacion_completada(
        correo=solicitud["correo_aprendiz"],
        nombre=solicitud["nombre_aprendiz"],
        programa=solicitud["nombre_programa"],
        solicitud_id=solicitud_id,
        db=db,
    )
    from app.utils.auditoria import registrar, SOLICITUD_CERTIFICADA
    registrar(db, SOLICITUD_CERTIFICADA, "solicitudes", solicitud_id,
              f"Solicitud {solicitud_id} certificada por {current_user['nombre_completo']}",
              current_user["id"])
    logger.info(f"Solicitud {solicitud_id} certificada")
    return {"message": "Solicitud marcada como certificada. Se notificará al aprendiz"}


@router.post("/{solicitud_id}/aprobar-todos")
async def aprobar_todos_documentos(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("documentos", "aprobar"))
):
    """Aprueba todos los documentos pendientes de una solicitud de una vez."""
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    estados_permitidos = ["PENDIENTE_REVISION", "CORREGIDO"]
    if solicitud["estado_actual"] not in estados_permitidos:
        raise HTTPException(status_code=400, detail=f"No se pueden aprobar documentos en estado '{solicitud['estado_actual']}'")

    from sqlalchemy import text
    query = text("""
        UPDATE solicitud_documentos
        SET estado_documento = 'APROBADO',
            observaciones = NULL,
            aprobado_por = :usuario_id,
            fecha_revision = NOW()
        WHERE solicitud_id = :solicitud_id
        AND es_version_activa = TRUE
        AND estado_documento != 'APROBADO'
    """)
    db.execute(query, {"solicitud_id": solicitud_id, "usuario_id": current_user["id"]})
    db.commit()

    return {"message": "Todos los documentos aprobados"}