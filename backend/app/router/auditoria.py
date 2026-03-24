import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from core.database import get_db
from app.router.dependencies import check_permission

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
def consultar_auditoria(
    usuario_id: Optional[int] = Query(default=None, description="Filtrar por usuario"),
    accion: Optional[str] = Query(default=None, description="Filtrar por acción"),
    tabla_afectada: Optional[str] = Query(default=None, description="Filtrar por tabla"),
    registro_id: Optional[int] = Query(default=None, description="Filtrar por ID de registro"),
    fecha_desde: Optional[str] = Query(default=None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_hasta: Optional[str] = Query(default=None, description="Fecha fin (YYYY-MM-DD)"),
    pagina: int = Query(default=1, ge=1, description="Número de página"),
    por_pagina: int = Query(default=50, ge=1, le=200, description="Registros por página"),
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("auditoria", "leer"))
):
    """
    Consulta el log de auditoría con filtros opcionales y paginación.
    Solo accesible para ADMIN.
    """
    filtros = []
    params = {}

    if usuario_id:
        filtros.append("a.usuario_id = :usuario_id")
        params["usuario_id"] = usuario_id

    if accion:
        filtros.append("a.accion = :accion")
        params["accion"] = accion

    if tabla_afectada:
        filtros.append("a.tabla_afectada = :tabla_afectada")
        params["tabla_afectada"] = tabla_afectada

    if registro_id:
        filtros.append("a.registro_id = :registro_id")
        params["registro_id"] = registro_id

    if fecha_desde:
        filtros.append("DATE(a.fecha_evento) >= :fecha_desde")
        params["fecha_desde"] = fecha_desde

    if fecha_hasta:
        filtros.append("DATE(a.fecha_evento) <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    where = f"WHERE {' AND '.join(filtros)}" if filtros else ""

    # Contar total
    query_total = text(f"SELECT COUNT(*) AS total FROM auditoria a {where}")
    total = db.execute(query_total, params).mappings().first()["total"]

    # Paginación
    offset = (pagina - 1) * por_pagina
    params["limit"] = por_pagina
    params["offset"] = offset

    query = text(f"""
        SELECT
            a.id, a.accion, a.tabla_afectada, a.registro_id,
            a.descripcion, a.ip_origen, a.fecha_evento,
            u.nombre_completo AS nombre_usuario,
            u.correo AS correo_usuario
        FROM auditoria a
        LEFT JOIN usuarios u ON u.id = a.usuario_id
        {where}
        ORDER BY a.fecha_evento DESC
        LIMIT :limit OFFSET :offset
    """)
    registros = db.execute(query, params).mappings().all()

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "paginas": (total + por_pagina - 1) // por_pagina,
        "registros": list(registros)
    }


@router.get("/acciones")
def listar_acciones_auditoria(
    db: Session = Depends(get_db),
    _: dict = Depends(check_permission("auditoria", "leer"))
):
    """
    Lista todas las acciones distintas registradas en auditoría.
    Útil para poblar filtros en el frontend.
    """
    query = text("""
        SELECT DISTINCT accion
        FROM auditoria
        ORDER BY accion ASC
    """)
    acciones = db.execute(query).scalars().all()
    return {"acciones": list(acciones)}