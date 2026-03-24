import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from core.database import get_db
from app.router.dependencies import check_permission, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# -------------------------------------------------------
# Reporte 1: Resumen general del sistema
# -------------------------------------------------------

@router.get("/resumen-general")
def reporte_resumen_general(
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("reportes", "leer"))
):
    """
    Resumen general del estado actual del sistema.
    Totales por estado, por tipo de programa y tiempos promedio.
    """
    # Totales por estado
    query_estados = text("""
        SELECT estado_actual, COUNT(*) AS total
        FROM solicitudes
        GROUP BY estado_actual
        ORDER BY FIELD(estado_actual,
            'PENDIENTE_REVISION','CON_OBSERVACIONES','CORREGIDO',
            'PENDIENTE_FIRMAS','PENDIENTE_CERTIFICACION','CERTIFICADO')
    """)
    por_estado = db.execute(query_estados).mappings().all()

    # Totales por tipo de programa
    query_tipos = text("""
        SELECT tp.nombre AS tipo_programa, COUNT(*) AS total,
               SUM(CASE WHEN s.estado_actual = 'CERTIFICADO' THEN 1 ELSE 0 END) AS certificadas
        FROM solicitudes s
        INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
        GROUP BY tp.id, tp.nombre
        ORDER BY total DESC
    """)
    por_tipo = db.execute(query_tipos).mappings().all()

    # Tiempo promedio de certificación (días desde solicitud hasta certificado)
    query_tiempo = text("""
        SELECT
            ROUND(AVG(DATEDIFF(
                (SELECT fecha_cambio FROM estados_historial
                 WHERE solicitud_id = s.id AND estado_nuevo = 'CERTIFICADO'
                 LIMIT 1),
                s.fecha_solicitud
            )), 1) AS dias_promedio_certificacion
        FROM solicitudes s
        WHERE s.estado_actual = 'CERTIFICADO'
    """)
    tiempo = db.execute(query_tiempo).mappings().first()

    # Total general
    query_total = text("SELECT COUNT(*) AS total FROM solicitudes")
    total = db.execute(query_total).mappings().first()["total"]

    return {
        "total_solicitudes": total,
        "por_estado": list(por_estado),
        "por_tipo_programa": list(por_tipo),
        "dias_promedio_certificacion": tiempo["dias_promedio_certificacion"] if tiempo else None,
    }


# -------------------------------------------------------
# Reporte 2: Solicitudes por período
# -------------------------------------------------------

@router.get("/solicitudes-por-periodo")
def reporte_solicitudes_periodo(
    fecha_desde: str = Query(..., description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: str = Query(..., description="Fecha fin (YYYY-MM-DD)"),
    tipo_programa_id: Optional[int] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("reportes", "leer"))
):
    """
    Solicitudes creadas en un período con filtros opcionales.
    Incluye detalle de cada solicitud y sus estados.
    """
    filtros = [
        "DATE(s.fecha_solicitud) >= :fecha_desde",
        "DATE(s.fecha_solicitud) <= :fecha_hasta"
    ]
    params = {"fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta}

    if tipo_programa_id:
        filtros.append("s.tipo_programa_id = :tipo_programa_id")
        params["tipo_programa_id"] = tipo_programa_id

    if estado:
        filtros.append("s.estado_actual = :estado")
        params["estado"] = estado

    where = f"WHERE {' AND '.join(filtros)}"

    query = text(f"""
        SELECT
            s.id, s.numero_documento, s.numero_ficha,
            s.nombre_aprendiz, s.nombre_programa,
            tp.nombre AS tipo_programa,
            s.estado_actual, s.fecha_solicitud,
            (SELECT fecha_cambio FROM estados_historial
             WHERE solicitud_id = s.id AND estado_nuevo = 'CERTIFICADO'
             LIMIT 1) AS fecha_certificacion,
            (SELECT COUNT(*) FROM solicitud_documentos
             WHERE solicitud_id = s.id AND estado_documento = 'OBSERVADO'
             AND es_version_activa = TRUE) AS documentos_observados,
            (SELECT COUNT(*) FROM firmas
             WHERE solicitud_id = s.id AND estado_firma = 'FIRMADO') AS firmas_completadas
        FROM solicitudes s
        INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
        {where}
        ORDER BY s.fecha_solicitud DESC
    """)
    solicitudes = db.execute(query, params).mappings().all()

    # Resumen del período
    query_resumen = text(f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN s.estado_actual = 'CERTIFICADO' THEN 1 ELSE 0 END) AS certificadas,
            SUM(CASE WHEN s.estado_actual = 'CON_OBSERVACIONES' THEN 1 ELSE 0 END) AS con_observaciones,
            SUM(CASE WHEN s.estado_actual = 'PENDIENTE_REVISION' THEN 1 ELSE 0 END) AS pendientes_revision
        FROM solicitudes s
        {where}
    """)
    resumen = db.execute(query_resumen, params).mappings().first()

    return {
        "periodo": {"desde": fecha_desde, "hasta": fecha_hasta},
        "resumen": dict(resumen),
        "solicitudes": list(solicitudes)
    }


# -------------------------------------------------------
# Reporte 3: Actividad de funcionarios
# -------------------------------------------------------

@router.get("/actividad-funcionarios")
def reporte_actividad_funcionarios(
    fecha_desde: Optional[str] = Query(default=None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(default=None, description="Fecha fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("reportes", "leer"))
):
    """
    Actividad de cada funcionario: documentos revisados, firmas, rechazos.
    """
    filtros_fecha = []
    params = {}

    if fecha_desde:
        filtros_fecha.append("DATE(a.fecha_evento) >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        filtros_fecha.append("DATE(a.fecha_evento) <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where_fecha = f"AND {' AND '.join(filtros_fecha)}" if filtros_fecha else ""

    # Documentos aprobados y observados por funcionario
    query_docs = text(f"""
        SELECT
            u.id AS usuario_id,
            u.nombre_completo,
            SUM(CASE WHEN sd.estado_documento = 'APROBADO' THEN 1 ELSE 0 END) AS documentos_aprobados,
            SUM(CASE WHEN sd.estado_documento = 'OBSERVADO' THEN 1 ELSE 0 END) AS documentos_observados
        FROM solicitud_documentos sd
        INNER JOIN usuarios u ON u.id = sd.aprobado_por
        WHERE sd.aprobado_por IS NOT NULL
        GROUP BY u.id, u.nombre_completo
        ORDER BY documentos_aprobados DESC
    """)
    actividad_docs = db.execute(query_docs, params).mappings().all()

    # Firmas y rechazos por funcionario
    query_firmas = text(f"""
        SELECT
            u.id AS usuario_id,
            u.nombre_completo,
            r.nombre AS rol,
            SUM(CASE WHEN f.estado_firma = 'FIRMADO' THEN 1 ELSE 0 END) AS firmas_completadas,
            SUM(CASE WHEN f.estado_firma = 'RECHAZADO' THEN 1 ELSE 0 END) AS firmas_rechazadas
        FROM firmas f
        INNER JOIN usuarios u ON u.id = f.usuario_id
        INNER JOIN roles r ON r.id = f.rol_id
        WHERE f.fecha_firma IS NOT NULL
        GROUP BY u.id, u.nombre_completo, r.nombre
        ORDER BY firmas_completadas DESC
    """)
    actividad_firmas = db.execute(query_firmas, params).mappings().all()

    # Logins por funcionario
    query_logins = text(f"""
        SELECT
            u.id AS usuario_id,
            u.nombre_completo,
            SUM(CASE WHEN a.accion = 'LOGIN_EXITOSO' THEN 1 ELSE 0 END) AS logins_exitosos,
            SUM(CASE WHEN a.accion = 'LOGIN_FALLIDO' THEN 1 ELSE 0 END) AS logins_fallidos,
            MAX(CASE WHEN a.accion = 'LOGIN_EXITOSO' THEN a.fecha_evento END) AS ultimo_login
        FROM auditoria a
        LEFT JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')
        {where_fecha}
        GROUP BY u.id, u.nombre_completo
        ORDER BY ultimo_login DESC
    """)
    actividad_logins = db.execute(query_logins, params).mappings().all()

    return {
        "periodo": {"desde": fecha_desde, "hasta": fecha_hasta},
        "revision_documentos": list(actividad_docs),
        "firmas": list(actividad_firmas),
        "logins": list(actividad_logins),
    }


# -------------------------------------------------------
# Reporte 4: Estado de firmas
# -------------------------------------------------------

@router.get("/estado-firmas")
def reporte_estado_firmas(
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("reportes", "leer"))
):
    """
    Estado de firmas por rol firmante.
    Muestra cuántas solicitudes tiene pendientes, firmadas y rechazadas cada rol.
    """
    filtros = []
    params = {}

    if fecha_desde:
        filtros.append("DATE(s.fecha_solicitud) >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        filtros.append("DATE(s.fecha_solicitud) <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = f"AND {' AND '.join(filtros)}" if filtros else ""

    query = text(f"""
        SELECT
            r.nombre AS rol,
            COUNT(*) AS total_asignadas,
            SUM(CASE WHEN f.estado_firma = 'FIRMADO' THEN 1 ELSE 0 END) AS firmadas,
            SUM(CASE WHEN f.estado_firma = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
            SUM(CASE WHEN f.estado_firma = 'RECHAZADO' THEN 1 ELSE 0 END) AS rechazadas,
            ROUND(SUM(CASE WHEN f.estado_firma = 'FIRMADO' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS porcentaje_firmado
        FROM firmas f
        INNER JOIN roles r ON r.id = f.rol_id
        INNER JOIN solicitudes s ON s.id = f.solicitud_id
        WHERE 1=1 {where}
        GROUP BY r.id, r.nombre
        ORDER BY pendientes DESC
    """)
    estado_firmas = db.execute(query, params).mappings().all()

    # Solicitudes con firmas pendientes hace más de 3 días
    query_atrasadas = text(f"""
        SELECT
            s.id AS solicitud_id,
            s.nombre_aprendiz,
            s.nombre_programa,
            r.nombre AS rol_pendiente,
            DATEDIFF(NOW(), s.fecha_solicitud) AS dias_en_proceso
        FROM firmas f
        INNER JOIN solicitudes s ON s.id = f.solicitud_id
        INNER JOIN roles r ON r.id = f.rol_id
        WHERE f.estado_firma = 'PENDIENTE'
        AND s.estado_actual = 'PENDIENTE_FIRMAS'
        AND DATEDIFF(NOW(), s.fecha_solicitud) > 3
        {where}
        ORDER BY dias_en_proceso DESC
    """)
    atrasadas = db.execute(query_atrasadas, params).mappings().all()

    return {
        "por_rol": list(estado_firmas),
        "solicitudes_atrasadas": list(atrasadas)
    }


# -------------------------------------------------------
# Reporte 5: Documentos con más observaciones
# -------------------------------------------------------

@router.get("/documentos-observados")
def reporte_documentos_observados(
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("reportes", "leer"))
):
    """
    Documentos que más frecuentemente son observados.
    Útil para identificar documentos problemáticos.
    """
    filtros = []
    params = {}

    if fecha_desde:
        filtros.append("DATE(s.fecha_solicitud) >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        filtros.append("DATE(s.fecha_solicitud) <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = f"AND {' AND '.join(filtros)}" if filtros else ""

    query = text(f"""
        SELECT
            dr.nombre AS documento,
            COUNT(*) AS total_subidos,
            SUM(CASE WHEN sd.estado_documento = 'OBSERVADO' THEN 1 ELSE 0 END) AS observados,
            SUM(CASE WHEN sd.estado_documento = 'APROBADO' THEN 1 ELSE 0 END) AS aprobados,
            ROUND(SUM(CASE WHEN sd.estado_documento = 'OBSERVADO' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS porcentaje_observado
        FROM solicitud_documentos sd
        INNER JOIN documentos_requeridos dr ON dr.id = sd.documento_id
        INNER JOIN solicitudes s ON s.id = sd.solicitud_id
        WHERE sd.es_version_activa = TRUE {where}
        GROUP BY dr.id, dr.nombre
        ORDER BY porcentaje_observado DESC
    """)
    documentos = db.execute(query, params).mappings().all()

    return {
        "periodo": {"desde": fecha_desde, "hasta": fecha_hasta},
        "documentos": list(documentos)
    }


# -------------------------------------------------------
# Reporte 6: Notificaciones enviadas
# -------------------------------------------------------

@router.get("/notificaciones")
def reporte_notificaciones(
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("reportes", "leer"))
):
    """
    Resumen de notificaciones enviadas y fallidas por tipo.
    """
    filtros = []
    params = {}

    if fecha_desde:
        filtros.append("DATE(fecha_envio) >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        filtros.append("DATE(fecha_envio) <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = f"WHERE {' AND '.join(filtros)}" if filtros else ""

    query = text(f"""
        SELECT
            tipo_notificacion,
            COUNT(*) AS total,
            SUM(CASE WHEN enviado = TRUE THEN 1 ELSE 0 END) AS enviados,
            SUM(CASE WHEN enviado = FALSE THEN 1 ELSE 0 END) AS fallidos,
            ROUND(SUM(CASE WHEN enviado = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS porcentaje_exito
        FROM notificaciones_email
        {where}
        GROUP BY tipo_notificacion
        ORDER BY total DESC
    """)
    notificaciones = db.execute(query, params).mappings().all()

    # Correos fallidos recientes
    query_fallidos = text(f"""
        SELECT
            ne.solicitud_id, ne.destinatario, ne.tipo_notificacion,
            ne.asunto, ne.fecha_envio, ne.error_mensaje
        FROM notificaciones_email ne
        WHERE ne.enviado = FALSE
        {'AND' if where else 'WHERE'} {' AND '.join(filtros) if filtros else '1=1'}
        ORDER BY ne.fecha_envio DESC
        LIMIT 20
    """)
    # Reescribir query de fallidos correctamente
    query_fallidos = text(f"""
        SELECT
            solicitud_id, destinatario, tipo_notificacion,
            asunto, fecha_envio, error_mensaje
        FROM notificaciones_email
        WHERE enviado = FALSE
        {'AND ' + ' AND '.join(filtros) if filtros else ''}
        ORDER BY fecha_envio DESC
        LIMIT 20
    """)
    fallidos = db.execute(query_fallidos, params).mappings().all()

    return {
        "periodo": {"desde": fecha_desde, "hasta": fecha_hasta},
        "por_tipo": list(notificaciones),
        "correos_fallidos_recientes": list(fallidos)
    }


# -------------------------------------------------------
# Reporte 7: Dashboard por rol
# -------------------------------------------------------

@router.get("/dashboard")
def reporte_dashboard(
    rol_forzado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    usuario_id = current_user["id"]
    roles = current_user["roles"]

    if rol_forzado:
        roles = [r for r in roles if r["nombre"] == rol_forzado]

    if not roles:
        return {"rol": "DESCONOCIDO"}

    rol_activo = roles[0]
    es_admin = any(r.get("es_admin") for r in roles)
    es_funcionario = any(r.get("es_funcionario_revision") for r in roles)
    es_coordinador = any(r.get("es_coordinador") for r in roles)
    es_firmante = any(r.get("requiere_firma") and not r.get("es_coordinador") for r in roles)

    # -------------------------------------------------------
    # ADMIN
    # -------------------------------------------------------
    if es_admin:
        query_estados = text("""
            SELECT estado_actual, COUNT(*) AS total
            FROM solicitudes
            GROUP BY estado_actual
        """)
        por_estado = db.execute(query_estados).mappings().all()

        query_tipos = text("""
            SELECT tp.nombre AS tipo_programa, COUNT(*) AS total,
                   SUM(CASE WHEN s.estado_actual = 'CERTIFICADO' THEN 1 ELSE 0 END) AS certificadas
            FROM solicitudes s
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            GROUP BY tp.id, tp.nombre
            ORDER BY total DESC
        """)
        por_tipo = db.execute(query_tipos).mappings().all()

        query_tiempo = text("""
            SELECT ROUND(AVG(DATEDIFF(
                (SELECT fecha_cambio FROM estados_historial
                 WHERE solicitud_id = s.id AND estado_nuevo = 'CERTIFICADO' LIMIT 1),
                s.fecha_solicitud
            )), 1) AS dias_promedio
            FROM solicitudes s WHERE s.estado_actual = 'CERTIFICADO'
        """)
        tiempo = db.execute(query_tiempo).mappings().first()

        return {
            "rol": "ADMIN",
            "total_solicitudes": sum(e["total"] for e in por_estado),
            "por_estado": list(por_estado),
            "por_tipo_programa": list(por_tipo),
            "dias_promedio_certificacion": tiempo["dias_promedio"] if tiempo else None
        }

    # -------------------------------------------------------
    # FUNCIONARIO_CERTIFICACION
    # -------------------------------------------------------
    if es_funcionario:
        query_pendientes = text("""
            SELECT s.id, s.nombre_aprendiz, s.nombre_programa,
                   tp.nombre AS tipo_programa,
                   s.fecha_solicitud,
                   DATEDIFF(NOW(), s.fecha_solicitud) AS dias_esperando
            FROM solicitudes s
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            WHERE s.estado_actual = 'PENDIENTE_REVISION'
            ORDER BY s.fecha_solicitud ASC
        """)
        pendientes = db.execute(query_pendientes).mappings().all()

        query_corregidas = text("""
            SELECT s.id, s.nombre_aprendiz, s.nombre_programa,
                   tp.nombre AS tipo_programa,
                   s.fecha_solicitud,
                   DATEDIFF(NOW(), s.fecha_solicitud) AS dias_esperando
            FROM solicitudes s
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            WHERE s.estado_actual = 'CORREGIDO'
            ORDER BY s.fecha_solicitud ASC
        """)
        corregidas = db.execute(query_corregidas).mappings().all()

        query_rechazos = text("""
            SELECT f.solicitud_id, s.nombre_aprendiz, s.nombre_programa,
                   r.nombre AS rol_rechazo, u.nombre_completo AS funcionario,
                   f.motivo_rechazo, f.fecha_firma AS fecha_rechazo
            FROM firmas f
            INNER JOIN solicitudes s ON s.id = f.solicitud_id
            INNER JOIN roles r ON r.id = f.rol_id
            LEFT JOIN usuarios u ON u.id = f.usuario_id
            WHERE f.estado_firma = 'RECHAZADO'
            AND s.estado_actual IN ('PENDIENTE_REVISION', 'CON_OBSERVACIONES', 'CORREGIDO')
            ORDER BY f.fecha_firma DESC
            LIMIT 10
        """)
        rechazos = db.execute(query_rechazos).mappings().all()

        query_atrasadas = text("""
            SELECT COUNT(*) AS total
            FROM solicitudes
            WHERE estado_actual = 'PENDIENTE_REVISION'
            AND DATEDIFF(NOW(), fecha_solicitud) > 3
        """)
        atrasadas = db.execute(query_atrasadas).mappings().first()

        return {
            "rol": "FUNCIONARIO_CERTIFICACION",
            "pendientes_revision": list(pendientes),
            "corregidas": list(corregidas),
            "rechazos_recientes": list(rechazos),
            "total_atrasadas": atrasadas["total"]
        }

    # -------------------------------------------------------
    # COORDINADOR
    # -------------------------------------------------------
    if es_coordinador:
        query_pendientes_firma = text("""
            SELECT s.id, s.nombre_aprendiz, s.nombre_programa,
                tp.nombre AS tipo_programa,
                s.fecha_solicitud,
                DATEDIFF(NOW(), s.fecha_solicitud) AS dias_esperando
            FROM firmas f
            INNER JOIN solicitudes s ON s.id = f.solicitud_id
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            INNER JOIN roles r ON r.id = f.rol_id AND r.es_coordinador = TRUE
            INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
            INNER JOIN tipo_programa_roles tpr ON tpr.rol_id = f.rol_id
                AND tpr.tipo_programa_id = s.tipo_programa_id
            WHERE f.estado_firma = 'PENDIENTE'
            AND s.estado_actual = 'PENDIENTE_FIRMAS'
            AND f.usuario_id = :usuario_id
            AND NOT EXISTS (
                SELECT 1 FROM firmas f2
                INNER JOIN tipo_programa_roles tpr2 ON tpr2.rol_id = f2.rol_id
                    AND tpr2.tipo_programa_id = s.tipo_programa_id
                WHERE f2.solicitud_id = s.id
                AND f2.estado_firma = 'PENDIENTE'
                AND f2.rol_id != f.rol_id
                AND tpr2.orden_firma < tpr.orden_firma
            )
            ORDER BY s.fecha_solicitud ASC
        """)
        pendientes_firma = db.execute(query_pendientes_firma, {"usuario_id": usuario_id}).mappings().all()

        query_solo_coordinador = text("""
            SELECT COUNT(*) AS total
            FROM solicitudes s
            WHERE s.estado_actual = 'PENDIENTE_FIRMAS'
            AND NOT EXISTS (
                SELECT 1 FROM firmas f2
                INNER JOIN tipo_programa_roles tpr ON tpr.rol_id = f2.rol_id
                INNER JOIN solicitudes s2 ON s2.tipo_programa_id = tpr.tipo_programa_id
                WHERE f2.solicitud_id = s.id
                AND s2.id = s.id
                AND f2.estado_firma = 'PENDIENTE'
                AND tpr.orden_firma < (
                    SELECT MAX(tpr2.orden_firma)
                    FROM tipo_programa_roles tpr2
                    INNER JOIN solicitudes s3 ON s3.tipo_programa_id = tpr2.tipo_programa_id
                    WHERE s3.id = s.id
                )
            )
        """)
        solo_coordinador = db.execute(query_solo_coordinador).mappings().first()

        query_firmadas_mes = text("""
            SELECT COUNT(*) AS total
            FROM firmas f
            INNER JOIN roles r ON r.id = f.rol_id AND r.es_coordinador = TRUE
            INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
            WHERE f.estado_firma = 'FIRMADO'
            AND MONTH(f.fecha_firma) = MONTH(NOW())
            AND YEAR(f.fecha_firma) = YEAR(NOW())
        """)
        firmadas_mes = db.execute(query_firmadas_mes, {"usuario_id": usuario_id}).mappings().first()

        query_certificadas_mes = text("""
            SELECT COUNT(*) AS total
            FROM solicitudes
            WHERE estado_actual = 'CERTIFICADO'
            AND MONTH(fecha_solicitud) = MONTH(NOW())
            AND YEAR(fecha_solicitud) = YEAR(NOW())
        """)
        certificadas_mes = db.execute(query_certificadas_mes).mappings().first()

        query_rechazos_propios = text("""
            SELECT s.id, s.nombre_aprendiz, s.nombre_programa,
                tp.nombre AS tipo_programa,
                f.motivo_rechazo, f.fecha_firma AS fecha_rechazo
            FROM firmas f
            INNER JOIN solicitudes s ON s.id = f.solicitud_id
            INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
            INNER JOIN roles r ON r.id = f.rol_id AND r.es_coordinador = TRUE
            INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
            WHERE f.estado_firma = 'RECHAZADO'
            AND f.usuario_id = :usuario_id
            AND MONTH(f.fecha_firma) = MONTH(NOW())
            AND YEAR(f.fecha_firma) = YEAR(NOW())
            ORDER BY f.fecha_firma DESC
        """)
        rechazos_propios = db.execute(query_rechazos_propios, {
            "usuario_id": usuario_id
        }).mappings().all()

        return {
            "rol": "COORDINADOR",
            "pendientes_firma": list(pendientes_firma),
            "solo_esperando_coordinador": solo_coordinador["total"],
            "firmadas_este_mes": firmadas_mes["total"],
            "certificadas_este_mes": certificadas_mes["total"],
            "rechazos_propios": list(rechazos_propios)
        }

    # -------------------------------------------------------
    # Firmantes
    # -------------------------------------------------------
    if not es_firmante:
        return {"rol": "DESCONOCIDO"}

    rol_actual = rol_activo["nombre"]

    query_pendientes_firma = text("""
        SELECT s.id, s.nombre_aprendiz, s.nombre_programa,
            tp.nombre AS tipo_programa,
            s.fecha_solicitud,
            DATEDIFF(NOW(), s.fecha_solicitud) AS dias_esperando
        FROM firmas f
        INNER JOIN solicitudes s ON s.id = f.solicitud_id
        INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
        INNER JOIN roles r ON r.id = f.rol_id AND r.nombre = :rol_actual
        INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
        INNER JOIN tipo_programa_roles tpr ON tpr.rol_id = f.rol_id 
            AND tpr.tipo_programa_id = s.tipo_programa_id
        WHERE f.estado_firma = 'PENDIENTE'
        AND s.estado_actual = 'PENDIENTE_FIRMAS'
        AND (
            tpr.orden_firma = 0
            OR NOT EXISTS (
                SELECT 1 FROM firmas f2
                INNER JOIN tipo_programa_roles tpr2 ON tpr2.rol_id = f2.rol_id
                    AND tpr2.tipo_programa_id = s.tipo_programa_id
                WHERE f2.solicitud_id = s.id
                AND f2.estado_firma = 'PENDIENTE'
                AND f2.rol_id != f.rol_id
                AND tpr2.orden_firma < tpr.orden_firma
            )
        )
        ORDER BY s.fecha_solicitud ASC
    """)
    pendientes_firma = db.execute(query_pendientes_firma, {
        "usuario_id": usuario_id,
        "rol_actual": rol_actual
    }).mappings().all()

    query_firmadas_mes = text("""
        SELECT COUNT(*) AS total
        FROM firmas f
        INNER JOIN roles r ON r.id = f.rol_id AND r.nombre = :rol_actual
        INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
        WHERE f.estado_firma = 'FIRMADO'
        AND MONTH(f.fecha_firma) = MONTH(NOW())
        AND YEAR(f.fecha_firma) = YEAR(NOW())
    """)
    firmadas_mes = db.execute(query_firmadas_mes, {
        "usuario_id": usuario_id,
        "rol_actual": rol_actual
    }).mappings().first()

    query_rechazadas_mes = text("""
        SELECT COUNT(*) AS total
        FROM firmas f
        INNER JOIN roles r ON r.id = f.rol_id AND r.nombre = :rol_actual
        INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
        WHERE f.estado_firma = 'RECHAZADO'
        AND MONTH(f.fecha_firma) = MONTH(NOW())
        AND YEAR(f.fecha_firma) = YEAR(NOW())
    """)

    rechazadas_mes = db.execute(query_rechazadas_mes, {
        "usuario_id": usuario_id,
        "rol_actual": rol_actual
    }).mappings().first()

    query_rechazos_propios = text("""
        SELECT s.id, s.nombre_aprendiz, s.nombre_programa,
            tp.nombre AS tipo_programa,
            f.motivo_rechazo, f.fecha_firma AS fecha_rechazo
        FROM firmas f
        INNER JOIN solicitudes s ON s.id = f.solicitud_id
        INNER JOIN tipo_programas tp ON tp.id = s.tipo_programa_id
        INNER JOIN roles r ON r.id = f.rol_id AND r.nombre = :rol_actual
        INNER JOIN usuario_roles ur ON ur.rol_id = f.rol_id AND ur.usuario_id = :usuario_id
        WHERE f.estado_firma = 'RECHAZADO'
        AND f.usuario_id = :usuario_id
        AND MONTH(f.fecha_firma) = MONTH(NOW())
        AND YEAR(f.fecha_firma) = YEAR(NOW())
        ORDER BY f.fecha_firma DESC
    """)

    rechazos_propios = db.execute(query_rechazos_propios, {
        "usuario_id": usuario_id,
        "rol_actual": rol_actual
    }).mappings().all()

    return {
        "rol": rol_actual,
        "pendientes_firma": list(pendientes_firma),
        "firmadas_este_mes": firmadas_mes["total"],
        "rechazadas_este_mes": rechazadas_mes["total"],
        "rechazos_propios": list(rechazos_propios)
    }