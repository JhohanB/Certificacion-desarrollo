import os
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Form, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel as PydanticBaseModel

from core.database import get_db
from core.config import settings
from app.schemas.solicitudes import (
    SolicitudConsulta, SolicitudOut, SolicitudConsultaOut,
    SolicitudListOut, SolicitudUpdateFuncionario,
    CorreccionDatosAprendiz, EstadoSolicitud, TipoDocumento
)
from app.crud import solicitudes as crud_solicitudes
from app.router.dependencies import check_permission
from app.utils.email_service import enviar_confirmacion_solicitud
from app.utils.file_validation import validar_archivo_pdf

logger = logging.getLogger(__name__)

router = APIRouter()


class ConfirmarRevisionRequest(PydanticBaseModel):
    coordinador_id: int


# -------------------------------------------------------
# Endpoints públicos (sin login)
# -------------------------------------------------------

@router.get("/tipos-programa")
def get_tipos_programa(db: Session = Depends(get_db)):
    return crud_solicitudes.get_tipo_programas(db)


@router.get("/documentos-requeridos/{tipo_programa_id}")
def get_documentos_requeridos(tipo_programa_id: int, db: Session = Depends(get_db)):
    documentos = crud_solicitudes.get_documentos_requeridos_by_tipo(db, tipo_programa_id)
    if not documentos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de programa no encontrado o sin documentos configurados"
        )
    return documentos


@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_solicitud(
    request: Request,
    tipo_documento: TipoDocumento = Form(...),
    numero_documento: str = Form(..., min_length=3, max_length=20),
    numero_ficha: str = Form(..., min_length=3, max_length=30),
    nombre_aprendiz: str = Form(..., min_length=3, max_length=150),
    correo_aprendiz: str = Form(...),
    confirmar_correo: str = Form(...),
    telefono_aprendiz: Optional[str] = Form(default=None),
    tipo_programa_id: int = Form(...),
    nombre_programa: str = Form(..., min_length=3, max_length=150),
    db: Session = Depends(get_db)
):
    if correo_aprendiz != confirmar_correo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los correos no coinciden"
        )

    documento_completo = f"{tipo_documento.value} {numero_documento}"
    if crud_solicitudes.exists_solicitud(db, documento_completo, numero_ficha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una solicitud con ese número de documento y ficha"
        )

    docs_requeridos = crud_solicitudes.get_documentos_requeridos_by_tipo(db, tipo_programa_id)
    if not docs_requeridos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de programa inválido o sin documentos configurados"
        )

    form = await request.form()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    archivos_validados = {}

    for doc in docs_requeridos:
        campo = f"archivo_{doc['id']}"
        archivo = form.get(campo)

        if not archivo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Falta el documento requerido: {doc['nombre']} (campo: {campo})"
            )

        contenido = await archivo.read()

        # Validar archivo usando validación segura mejorada
        es_valido, mensaje_error = validar_archivo_pdf(contenido, archivo.filename)
        if not es_valido:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo '{doc['nombre']}' no es válido: {mensaje_error}"
            )

        archivos_validados[doc['id']] = (contenido, doc)

    solicitud_id = crud_solicitudes.create_solicitud(db, {
        "numero_documento": documento_completo,
        "numero_ficha": numero_ficha,
        "nombre_aprendiz": nombre_aprendiz,
        "correo_aprendiz": correo_aprendiz,
        "telefono_aprendiz": telefono_aprendiz,
        "tipo_programa_id": tipo_programa_id,
        "nombre_programa": nombre_programa
    })

    crud_solicitudes.registrar_historial_estado(
        db, solicitud_id, None, "PENDIENTE_REVISION"
    )

    carpeta = f"{settings.UPLOAD_DIR}/{solicitud_id}"
    os.makedirs(carpeta, exist_ok=True)

    for documento_id, (contenido, doc) in archivos_validados.items():
        nombre_archivo = f"doc_{documento_id}_v1.pdf"
        ruta = f"{carpeta}/{nombre_archivo}"
        with open(ruta, "wb") as f:
            f.write(contenido)
        crud_solicitudes.create_documento_solicitud(db, solicitud_id, documento_id, ruta)

    tipo_nombre = next(
        (d["nombre"] for d in crud_solicitudes.get_tipo_programas(db) if d["id"] == tipo_programa_id), ""
    )
    await enviar_confirmacion_solicitud(
        correo=correo_aprendiz,
        nombre=nombre_aprendiz,
        programa=nombre_programa,
        ficha=numero_ficha,
        tipo_programa=tipo_nombre,
        numero_documento=numero_documento,
    )
    logger.info(f"Solicitud {solicitud_id} creada para aprendiz {correo_aprendiz}")

    return {
        "message": "Solicitud creada correctamente, recibirás un correo de confirmación",
        "solicitud_id": solicitud_id
    }


@router.post("/{solicitud_id}/enviar-observaciones")
async def enviar_observaciones(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    from core.security import generate_edit_token
    from app.crud.documentos import create_token_edicion, get_documentos_observados
    from app.utils.email_service import enviar_observaciones_completas, enviar_notificacion_rechazo_externo
    from sqlalchemy import text

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if solicitud["estado_actual"] not in ["PENDIENTE_REVISION", "CON_OBSERVACIONES"]:
        raise HTTPException(status_code=400, detail="La solicitud debe estar en revisión")

    # Verificar tipo de rechazo de la firma rechazada
    firma_rechazada = db.execute(text("""
        SELECT f.tipo_rechazo, f.motivo_rechazo, u.nombre_completo, u.correo
        FROM firmas f
        LEFT JOIN usuarios u ON u.id = f.usuario_id
        WHERE f.solicitud_id = :sid AND f.estado_firma = 'RECHAZADO'
        ORDER BY f.fecha_firma DESC LIMIT 1
    """), {"sid": solicitud_id}).mappings().first()

    docs_observados = list(get_documentos_observados(db, solicitud_id))
    obs = solicitud.get("observaciones_generales") or ""

    if not docs_observados and not obs:
        raise HTTPException(status_code=400, detail="No hay observaciones para notificar")

    tipo_rechazo = firma_rechazada["tipo_rechazo"] if firma_rechazada else "POR_DOCUMENTOS"

    if tipo_rechazo == "POR_OTRA_RAZON":
        # Correo informativo sin token
        await enviar_notificacion_rechazo_externo(
            correo=solicitud["correo_aprendiz"],
            nombre=solicitud["nombre_aprendiz"],
            programa=solicitud["nombre_programa"],
            motivo=obs,
            nombre_funcionario_rechazo=firma_rechazada["nombre_completo"] if firma_rechazada else current_user["nombre_completo"],
            correo_funcionario_rechazo=firma_rechazada["correo"] if firma_rechazada else current_user["correo"],
            solicitud_id=solicitud_id,
            db=db,
        )
        crud_solicitudes.update_estado_solicitud(
            db, solicitud_id, "CON_OBSERVACIONES",
            current_user["id"], f"Notificación enviada al aprendiz: {obs}"
        )
    else:
        # Correo con token de corrección
        token = generate_edit_token()
        create_token_edicion(db, solicitud_id, token)
        await enviar_observaciones_completas(
            correo=solicitud["correo_aprendiz"],
            nombre=solicitud["nombre_aprendiz"],
            programa=solicitud["nombre_programa"],
            docs_observados=docs_observados,
            token=token,
            observaciones_generales=obs if obs else None,
            solicitud_id=solicitud_id,
            db=db,
        )
        crud_solicitudes.update_estado_solicitud(
            db, solicitud_id, "CON_OBSERVACIONES",
            current_user["id"], f"Observaciones enviadas al aprendiz: {obs}"
        )

    return {"message": "Notificación enviada al aprendiz correctamente"}


@router.post("/{solicitud_id}/reenviar-observaciones")
async def reenviar_observaciones(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    """
    Reenvía las observaciones al aprendiz cuando hay error en el envío o cuando
    la solicitud está en CON_OBSERVACIONES y necesita reenvío.
    
    Usa el mismo template e información que el envío original.
    """
    from core.security import generate_edit_token
    from app.crud.documentos import create_token_edicion, get_documentos_observados
    from app.utils.email_service import enviar_observaciones_completas, enviar_notificacion_rechazo_externo
    from sqlalchemy import text

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if solicitud["estado_actual"] not in ["PENDIENTE_REVISION", "CON_OBSERVACIONES"]:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden reenviar observaciones cuando la solicitud está en revisión o con observaciones"
        )

    # Verificar tipo de rechazo de la firma rechazada
    firma_rechazada = db.execute(text("""
        SELECT f.tipo_rechazo, f.motivo_rechazo, u.nombre_completo, u.correo
        FROM firmas f
        LEFT JOIN usuarios u ON u.id = f.usuario_id
        WHERE f.solicitud_id = :sid AND f.estado_firma = 'RECHAZADO'
        ORDER BY f.fecha_firma DESC LIMIT 1
    """), {"sid": solicitud_id}).mappings().first()

    docs_observados = list(get_documentos_observados(db, solicitud_id))
    obs = solicitud.get("observaciones_generales") or ""

    # Validar que haya algo que reenviar
    if not obs and not docs_observados:
        raise HTTPException(status_code=400, detail="No hay observaciones generales ni documentos observados para reenviar")

    tipo_rechazo = firma_rechazada["tipo_rechazo"] if firma_rechazada else "POR_DOCUMENTOS"

    if tipo_rechazo == "POR_OTRA_RAZON":
        # Reenviar correo informativo sin token
        motivo_envio = obs or "Se han observado documentos en tu solicitud. Revisa el proceso para corregirlos."
        await enviar_notificacion_rechazo_externo(
            correo=solicitud["correo_aprendiz"],
            nombre=solicitud["nombre_aprendiz"],
            programa=solicitud["nombre_programa"],
            motivo=motivo_envio,
            nombre_funcionario_rechazo=firma_rechazada["nombre_completo"] if firma_rechazada else current_user["nombre_completo"],
            correo_funcionario_rechazo=firma_rechazada["correo"] if firma_rechazada else current_user["correo"],
            solicitud_id=solicitud_id,
            db=db,
        )
    else:
        # Reenviar correo con token (generar uno nuevo si no existe o está expirado)
        token = generate_edit_token()
        create_token_edicion(db, solicitud_id, token)
        await enviar_observaciones_completas(
            correo=solicitud["correo_aprendiz"],
            nombre=solicitud["nombre_aprendiz"],
            programa=solicitud["nombre_programa"],
            docs_observados=docs_observados,
            token=token,
            observaciones_generales=obs if obs else None,
            solicitud_id=solicitud_id,
            db=db,
        )

    # Registrar reenvío en auditoría
    from app.utils.auditoria import registrar
    registrar(db, "OBSERVACIONES_REENVIADAS", "solicitudes", solicitud_id,
              f"Observaciones reenviadas por {current_user['nombre_completo']} - Tipo: {tipo_rechazo}",
              current_user["id"])

    return {"message": "Observaciones reenviadas al aprendiz correctamente"}


@router.get("/{solicitud_id}/tokens")
def get_tokens_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "leer"))
):
    from sqlalchemy import text

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    query = text("""
        SELECT id, token, usado, fecha_creacion, fecha_uso
        FROM tokens_edicion
        WHERE solicitud_id = :solicitud_id
        ORDER BY fecha_creacion DESC
    """)
    tokens = db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()
    token_activo = next((t for t in tokens if not t["usado"]), None)

    return {
        "solicitud_id": solicitud_id,
        "tiene_token_activo": token_activo is not None,
        "tokens": list(tokens)
    }


@router.get("/{solicitud_id}/notificaciones")
def get_notificaciones_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "leer"))
):
    from sqlalchemy import text

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    query = text("""
        SELECT id, destinatario, tipo_notificacion,
               asunto, enviado, fecha_envio, error_mensaje
        FROM notificaciones_email
        WHERE solicitud_id = :solicitud_id
        ORDER BY fecha_envio ASC
    """)
    notificaciones = db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()

    return {
        "solicitud_id": solicitud_id,
        "nombre_aprendiz": solicitud["nombre_aprendiz"],
        "notificaciones": list(notificaciones)
    }


@router.get("/{solicitud_id}/historial")
def get_historial_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "leer"))
):
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    historial = crud_solicitudes.get_historial_estados(db, solicitud_id)
    return {
        "solicitud_id": solicitud_id,
        "nombre_aprendiz": solicitud["nombre_aprendiz"],
        "estado_actual": solicitud["estado_actual"],
        "historial": list(historial)
    }


@router.post("/consultar", response_model=SolicitudConsultaOut)
def consultar_solicitud(datos: SolicitudConsulta, db: Session = Depends(get_db)):
    solicitud = crud_solicitudes.get_solicitud_by_doc_ficha(
        db, datos.numero_documento, datos.numero_ficha
    )
    if not solicitud:
        raise HTTPException(status_code=404, detail="No se encontró ninguna solicitud con esos datos")
    return solicitud


@router.get("/estados-posibles")
def get_estados_posibles(_: dict = Depends(check_permission("solicitudes", "leer"))):
    return [{"valor": e.value, "etiqueta": e.value.replace("_", " ")} for e in EstadoSolicitud]


@router.get("/", response_model=List[SolicitudListOut])
def listar_solicitudes(
    estado: Optional[EstadoSolicitud] = None,
    tipo_programa_id: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "leer"))
):
    return crud_solicitudes.get_all_solicitudes(
        db,
        estado.value if estado else None,
        tipo_programa_id,
        usuario_id=current_user["id"],
        page=page,
        limit=limit
    )


@router.get("/{solicitud_id}", response_model=SolicitudOut)
def obtener_solicitud(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "leer"))
):
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return solicitud


@router.put("/{solicitud_id}/programa")
def actualizar_programa_solicitud(
    solicitud_id: int,
    datos: SolicitudUpdateFuncionario,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    campos = datos.model_dump(exclude_unset=True)
    if 'observaciones_generales' in datos.model_fields_set:
        campos['observaciones_generales'] = datos.observaciones_generales
    crud_solicitudes.update_solicitud_programa(db, solicitud_id, campos)
    return {"message": "Datos actualizados correctamente"}


@router.put("/{solicitud_id}/datos-aprendiz")
def actualizar_datos_aprendiz(
    solicitud_id: int,
    datos: CorreccionDatosAprendiz,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    estados_permitidos = ["PENDIENTE_REVISION", "CORREGIDO"]
    if solicitud["estado_actual"] not in estados_permitidos:
        raise HTTPException(
            status_code=400,
            detail=f"No se pueden editar datos en estado '{solicitud['estado_actual']}'"
        )

    datos_dict = datos.model_dump(exclude_unset=True)
    campos_todos = list(datos_dict.keys())
    crud_solicitudes.corregir_datos_solicitud(db, solicitud_id, datos_dict, campos_todos)
    return {"message": "Datos del aprendiz actualizados correctamente"}


@router.post("/corregir-datos/{token}")
async def corregir_datos_aprendiz(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    from app.crud.documentos import get_token_edicion, marcar_token_usado, reemplazar_documento, validar_token_expirado

    token_data = get_token_edicion(db, token)
    if not token_data:
        raise HTTPException(status_code=404, detail="Token no encontrado")
    if token_data["usado"]:
        raise HTTPException(status_code=400, detail="Este enlace ya fue utilizado")
    
    # Validar que el token no haya expirado (7 días)
    if validar_token_expirado(db, token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de corrección ha expirado (válido por 7 días). Debe solicitar uno nuevo"
        )

    solicitud_id = token_data["solicitud_id"]
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    form = await request.form()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

    # Actualizar datos del aprendiz si vienen en el form
    campos_datos = ["nombre_aprendiz", "numero_documento", "tipo_documento",
                    "correo_aprendiz", "telefono_aprendiz", "tipo_programa_id",
                    "nombre_programa", "numero_ficha"]
    datos_dict = {}
    for campo in campos_datos:
        valor = form.get(campo)
        if valor:
            datos_dict[campo] = valor

    # Procesar documentos no aprobados
    docs_activos = solicitud.get("documentos", [])
    carpeta = f"{settings.UPLOAD_DIR}/{solicitud_id}"
    os.makedirs(carpeta, exist_ok=True)

    for doc in docs_activos:
        if doc.get("estado_documento") == "APROBADO":
            continue
        campo = f"archivo_{doc['documento_id']}"
        archivo = form.get(campo)
        if not archivo:
            continue
        contenido = await archivo.read()
        # Validar archivo usando validación segura mejorada
        es_valido, mensaje_error = validar_archivo_pdf(contenido, archivo.filename)
        if not es_valido:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo no es válido: {mensaje_error}"
            )

        version = doc.get("version", 1) + 1
        nombre_archivo = f"doc_{doc['documento_id']}_v{version}.pdf"
        ruta = f"{carpeta}/{nombre_archivo}"
        with open(ruta, "wb") as f:
            f.write(contenido)
        reemplazar_documento(db, solicitud_id, doc["documento_id"], ruta)

    if datos_dict:
        campos_todos = list(datos_dict.keys())
        crud_solicitudes.corregir_datos_solicitud(db, solicitud_id, datos_dict, campos_todos)

    marcar_token_usado(db, token)
    # Limpiar observaciones generales tras corrección del aprendiz
    from sqlalchemy import text
    db.execute(text("UPDATE solicitudes SET observaciones_generales = NULL WHERE id = :id"), 
               {"id": solicitud_id})
    db.commit()
    crud_solicitudes.update_estado_solicitud(
        db, solicitud_id, "CORREGIDO", None, "Aprendiz corrigió su solicitud"
    )

    return {"message": "Correcciones enviadas correctamente. El funcionario revisará nuevamente tu solicitud."}


@router.post("/{solicitud_id}/reenviar-notificacion")
async def reenviar_notificacion(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    from app.crud.documentos import get_documentos_observados, get_token_activo_solicitud
    from app.utils.email_service import enviar_observaciones_completas

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if solicitud["estado_actual"] != "CON_OBSERVACIONES":
        raise HTTPException(
            status_code=400,
            detail="Solo se puede reenviar cuando la solicitud está en CON_OBSERVACIONES"
        )

    token_data = get_token_activo_solicitud(db, solicitud_id)
    if not token_data:
        raise HTTPException(
            status_code=400,
            detail="No hay token activo. Use 'enviar-observaciones' primero"
        )

    docs_observados = get_documentos_observados(db, solicitud_id)

    await enviar_observaciones_completas(
        correo=solicitud["correo_aprendiz"],
        nombre=solicitud["nombre_aprendiz"],
        programa=solicitud["nombre_programa"],
        docs_observados=docs_observados,
        token=token_data["token"],
        nombre_funcionario=current_user["nombre_completo"],
        correo_funcionario=current_user["correo"],
        solicitud_id=solicitud_id,
        db=db,
    )

    from app.utils.auditoria import registrar
    registrar(db, "NOTIFICACION_REENVIADA", "solicitudes", solicitud_id,
              f"Correo reenviado para solicitud {solicitud_id}", current_user["id"])

    return {"message": "Correo reenviado correctamente al aprendiz"}


@router.post("/{solicitud_id}/confirmar-revision")
async def confirmar_revision(
    solicitud_id: int,
    datos: ConfirmarRevisionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    from core.security import generate_edit_token
    from app.crud.documentos import (
        create_token_edicion, get_documentos_observados,
        create_firmas_solicitud, update_pdf_consolidado
    )
    from app.utils.email_service import enviar_observaciones_completas
    from app.utils.pdf import generar_pdf_consolidado
    from sqlalchemy import text

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    estados_permitidos = ["PENDIENTE_REVISION", "CORREGIDO"]
    if solicitud["estado_actual"] not in estados_permitidos:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede confirmar revisión en estado '{solicitud['estado_actual']}'"
        )

    # Verificar que el coordinador es válido
    query_coord = text("""
        SELECT u.id FROM usuarios u
        INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
        INNER JOIN roles r ON r.id = ur.rol_id
        WHERE u.id = :coordinador_id AND r.nombre = 'COORDINADOR'
        AND u.activo = TRUE AND ur.activo = TRUE
    """)
    coordinador = db.execute(query_coord, {"coordinador_id": datos.coordinador_id}).first()
    if not coordinador:
        raise HTTPException(status_code=400, detail="Coordinador no válido")

    docs_observados = list(get_documentos_observados(db, solicitud_id))
    obs = solicitud.get("observaciones_generales") or ""
    hay_observaciones = obs.strip() != ""

    if not docs_observados and not hay_observaciones:
        # Todo aprobado — generar PDF y pasar a PENDIENTE_FIRMAS
        documentos = crud_solicitudes.get_documentos_by_solicitud(db, solicitud_id)
        try:
            pdf_url, pdf_hash = generar_pdf_consolidado(
                solicitud_id, documentos, settings.UPLOAD_DIR
            )
            update_pdf_consolidado(db, solicitud_id, pdf_url, pdf_hash)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al generar PDF: {str(e)}")

        from sqlalchemy import text as sql_text

        firmas_existentes = db.execute(sql_text("""
            SELECT COUNT(*) as total FROM firmas WHERE solicitud_id = :id
        """), {"id": solicitud_id}).mappings().first()

        if firmas_existentes["total"] > 0:
            # Reactivar solo firmas rechazadas
            db.execute(sql_text("""
                UPDATE firmas SET estado_firma = 'PENDIENTE',
                    fecha_firma = NULL, motivo_rechazo = NULL, tipo_rechazo = NULL
                WHERE solicitud_id = :id
                AND estado_firma = 'RECHAZADO'
            """), {"id": solicitud_id})

            # Limpiar firmas de roles que ya no son firmantes del tipo_programa
            from app.crud.documentos import limpiar_firmas_obsoletas
            limpiar_firmas_obsoletas(db, solicitud_id, solicitud["tipo_programa_id"])

            # Regenerar PDF con documentos corregidos
            try:
                pdf_url, pdf_hash = generar_pdf_consolidado(
                    solicitud_id, documentos, settings.UPLOAD_DIR
                )
                update_pdf_consolidado(db, solicitud_id, pdf_url, pdf_hash)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al regenerar PDF: {str(e)}")

            db.commit()
        else:
            create_firmas_solicitud(
                db, solicitud_id,
                solicitud["tipo_programa_id"],
                datos.coordinador_id
            )

        crud_solicitudes.update_estado_solicitud(
            db, solicitud_id, "PENDIENTE_FIRMAS",
            current_user["id"], "Revisión completada, todos los documentos aprobados"
        )
        return {
            "message": "Revisión aprobada. La solicitud pasa a proceso de firmas.",
            "estado": "PENDIENTE_FIRMAS"
        }
    else:
        # Hay observaciones — notificar al aprendiz
        token = generate_edit_token()
        create_token_edicion(db, solicitud_id, token)

        motivo_historial = []
        if docs_observados:
            nombres = [d['nombre_documento'] for d in docs_observados]
            motivo_historial.append(f"Documentos observados: {', '.join(nombres)}")
        if hay_observaciones:
            motivo_historial.append(f"Observaciones generales: {obs}")

        crud_solicitudes.update_estado_solicitud(
            db, solicitud_id, "CON_OBSERVACIONES",
            current_user["id"], " | ".join(motivo_historial) or "Revisión con observaciones"
        )

        await enviar_observaciones_completas(
            correo=solicitud["correo_aprendiz"],
            nombre=solicitud["nombre_aprendiz"],
            programa=solicitud["nombre_programa"],
            docs_observados=docs_observados,
            token=token,
            observaciones_generales=obs if hay_observaciones else None,
            solicitud_id=solicitud_id,
            db=db,
        )
        return {
            "message": "Observaciones enviadas al aprendiz.",
            "estado": "CON_OBSERVACIONES"
        }
    

@router.put("/{solicitud_id}/devolver-revision")
def devolver_a_revision(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    import os
    from sqlalchemy import text

    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud["estado_actual"] != "PENDIENTE_FIRMAS":
        raise HTTPException(status_code=400, detail="Solo se puede devolver desde PENDIENTE_FIRMAS")

    # Marcar firmas como RECHAZADO para que se reactiven al confirmar revisión
    db.execute(text("""
        UPDATE firmas SET estado_firma = 'RECHAZADO',
            motivo_rechazo = 'Devuelta a revisión por el funcionario de certificación',
            tipo_rechazo = NULL,
            fecha_firma = NOW()
        WHERE solicitud_id = :id
        AND estado_firma IN ('PENDIENTE', 'FIRMADO')
    """), {"id": solicitud_id})

    # Eliminar PDF consolidado del disco
    pdf_url = solicitud.get("pdf_consolidado_url")
    if pdf_url and os.path.exists(pdf_url):
        os.remove(pdf_url)

    # Limpiar referencia al PDF en BD
    db.execute(text("""
        UPDATE solicitudes
        SET pdf_consolidado_url = NULL,
            pdf_hash = NULL,
            fecha_generacion_pdf = NULL
        WHERE id = :id
    """), {"id": solicitud_id})
    db.commit()

    crud_solicitudes.update_estado_solicitud(
        db, solicitud_id, "PENDIENTE_REVISION",
        current_user["id"], "Devuelta a revisión por el funcionario"
    )
    return {"message": "Solicitud devuelta a revisión. El PDF consolidado fue eliminado."}


@router.get("/{solicitud_id}/historial-estados")
def get_historial_estados(
    solicitud_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("solicitudes", "leer"))
):
    from sqlalchemy import text
    query = text("""
        SELECT 
            eh.id,
            eh.estado_anterior,
            eh.estado_nuevo,
            u.nombre_completo AS nombre_usuario,
            eh.motivo,
            eh.fecha_cambio
        FROM (
            SELECT 
                eh.*,
                ROW_NUMBER() OVER (PARTITION BY eh.usuario_id ORDER BY eh.fecha_cambio DESC) AS rn
            FROM estados_historial eh
            WHERE eh.solicitud_id = :solicitud_id
        ) eh
        LEFT JOIN usuarios u ON u.id = eh.usuario_id
        WHERE eh.rn = 1
        ORDER BY eh.fecha_cambio DESC;
    """)
    rows = db.execute(query, {"solicitud_id": solicitud_id}).mappings().all()

    # Solo el último cambio por usuario
    vistos = {}
    resultado = []
    for row in rows:
        key = row["usuario_id"] if row.get("usuario_id") else f"anon_{row['id']}"
        if key not in vistos:
            vistos[key] = True
            resultado.append(dict(row))
    return resultado


class CambiarTipoRechazoRequest(PydanticBaseModel):
    tipo_rechazo: str
    firma_id: int

@router.put("/{solicitud_id}/cambiar-tipo-rechazo")
def cambiar_tipo_rechazo(
    solicitud_id: int,
    datos: CambiarTipoRechazoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    from sqlalchemy import text
    db.execute(text("""
        UPDATE firmas SET tipo_rechazo = :tipo_rechazo
        WHERE id = :firma_id AND solicitud_id = :solicitud_id
    """), {
        "tipo_rechazo": datos.tipo_rechazo,
        "firma_id": datos.firma_id,
        "solicitud_id": solicitud_id
    })
    db.commit()
    return {"message": "Tipo de rechazo actualizado"}


# -------------------------------------------------------
# Marcar una solicitud como resuelta (bypass del token)
# -------------------------------------------------------

@router.put("/{solicitud_id}/marcar-corregido")
def marcar_solicitud_corregida(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_permission("solicitudes", "actualizar"))
):
    """
    Permite al funcionario de certificación cambiar el estado de CON_OBSERVACIONES
    a CORREGIDO cuando hay un rechazo de firma por POR_OTRA_RAZON (sin token de edición).
    
    Validaciones:
    - La solicitud debe estar en estado CON_OBSERVACIONES
    - Debe existir una firma rechazada con tipo_rechazo = POR_OTRA_RAZON
    """
    from sqlalchemy import text
    
    solicitud = crud_solicitudes.get_solicitud_by_id(db, solicitud_id)
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    
    # Validar que está en CON_OBSERVACIONES
    if solicitud["estado_actual"] != "CON_OBSERVACIONES":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La solicitud no está en estado CON_OBSERVACIONES. Estado actual: {solicitud['estado_actual']}"
        )
    
    # Verificar que existe una firma rechazada con tipo_rechazo = POR_OTRA_RAZON
    firma_rechazo = db.execute(text("""
        SELECT id, tipo_rechazo, motivo_rechazo
        FROM firmas
        WHERE solicitud_id = :solicitud_id 
        AND estado_firma = 'RECHAZADO'
        AND tipo_rechazo = 'POR_OTRA_RAZON'
        ORDER BY fecha_firma DESC
        LIMIT 1
    """), {"solicitud_id": solicitud_id}).mappings().first()
    
    if not firma_rechazo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay un rechazo de firma por 'POR_OTRA_RAZON' en esta solicitud"
        )
    
    # Limpiar observaciones_generales al igual que cuando se quitan
    db.execute(text("""
        UPDATE solicitudes SET observaciones_generales = NULL
        WHERE id = :solicitud_id
    """), {"solicitud_id": solicitud_id})
    
    # Limpiar tipo_rechazo de las firmas rechazadas (se resetearán cuando se confirme revisión)
    db.execute(text("""
        UPDATE firmas SET tipo_rechazo = NULL
        WHERE solicitud_id = :solicitud_id 
        AND estado_firma = 'RECHAZADO'
    """), {"solicitud_id": solicitud_id})
    db.commit()
    
    # Cambiar estado a CORREGIDO
    crud_solicitudes.update_estado_solicitud(
        db, 
        solicitud_id, 
        "CORREGIDO",
        current_user["id"],
        f"Observación resuelta manualmente por {current_user['nombre_completo']}"
    )
    
    logger.info(f"Solicitud {solicitud_id} marcada como CORREGIDO por {current_user['nombre_completo']}")
    
    return {"message": "Solicitud marcada como resuelta. Pasará a revisión nuevamente."}