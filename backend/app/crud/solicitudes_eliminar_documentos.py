import os
import logging
import shutil
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Obtener solicitudes certificadas sin documentos eliminados
# -------------------------------------------------------

def obtener_solicitudes_certificadas_sin_docs_eliminados(db: Session, solicitud_ids: List[int]) -> List[dict]:
    """
    Obtiene solicitudes que:
    - Estado = CERTIFICADO
    - documentos_eliminados = FALSE
    - Tienen documentos activos
    """
    try:
        placeholders = ','.join(['?' for _ in solicitud_ids])
        query = text(f"""
            SELECT 
                s.id, s.numero_documento, s.numero_ficha, s.nombre_aprendiz,
                s.estado_actual, s.documentos_eliminados,
                COUNT(sd.id) as cantidad_documentos
            FROM solicitudes s
            LEFT JOIN solicitud_documentos sd ON sd.solicitud_id = s.id 
                AND sd.es_version_activa = TRUE
            WHERE s.id IN ({','.join([':id_' + str(i) for i in range(len(solicitud_ids))])})
            AND s.estado_actual = 'CERTIFICADO'
            AND s.documentos_eliminados = FALSE
            GROUP BY s.id
            HAVING cantidad_documentos > 0
        """)
        
        params = {f'id_{i}': id_ for i, id_ in enumerate(solicitud_ids)}
        resultado = db.execute(query, params).mappings().all()
        return [dict(row) for row in resultado]
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener solicitudes certificadas: {e}")
        raise


# -------------------------------------------------------
# Eliminar carpeta con los documentos de una solicitud
# -------------------------------------------------------

def eliminar_carpeta_documentos_solicitud(
    upload_dir: str,
    solicitud_id: int
) -> Tuple[int, List[str]]:
    """
    Elimina completamente la carpeta:
    uploads/documentos/{solicitud_id}

    Retorna:
        (cantidad_eliminados_aproximada, errores)
    """
    errores = []

    try:
        ruta_carpeta = os.path.join(
            upload_dir,
            str(solicitud_id)
        )

        ruta_absoluta = os.path.abspath(ruta_carpeta)
        upload_absoluto = os.path.abspath(upload_dir)

        # Seguridad: validar que esté dentro de uploads
        if not ruta_absoluta.startswith(upload_absoluto):
            errores.append("Ruta inválida detectada")
            return 0, errores

        if os.path.exists(ruta_absoluta):
            cantidad_archivos = sum(
                len(files)
                for _, _, files in os.walk(ruta_absoluta)
            )

            shutil.rmtree(ruta_absoluta)

            logger.info(f"Carpeta eliminada: {ruta_absoluta}")

            return cantidad_archivos, []

        error_msg = f"Carpeta de documentos no encontrada: {ruta_absoluta}"
        logger.error(error_msg)
        errores.append(error_msg)
        return 0, errores

    except Exception as e:
        error_msg = f"Error eliminando carpeta de solicitud {solicitud_id}: {str(e)}"
        logger.error(error_msg)
        errores.append(error_msg)
        return 0, errores

# -------------------------------------------------------
# Eliminar documentos de BD
# -------------------------------------------------------

def eliminar_registros_documentos_bd(db: Session, solicitud_id: int) -> bool:
    """
    Elimina todos los registros de solicitud_documentos de una solicitud.
    """
    try:
        query = text("""
            DELETE FROM solicitud_documentos
            WHERE solicitud_id = :solicitud_id
        """)
        result = db.execute(query, {"solicitud_id": solicitud_id})
        db.commit()
        return result.rowcount > 0
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al eliminar registros de documentos: {e}")
        raise


# -------------------------------------------------------
# Marcar solicitud como documentos eliminados
# -------------------------------------------------------

def marcar_documentos_como_eliminados(db: Session, solicitud_id: int) -> bool:
    """
    Marca una solicitud como documentos eliminados
    y limpia el PDF consolidado generado.
    """
    try:
        query = text("""
            UPDATE solicitudes
            SET 
                documentos_eliminados = TRUE,
                fecha_eliminacion_documentos = NOW(),
                pdf_consolidado_url = NULL,
                pdf_hash = NULL,
                fecha_generacion_pdf = NULL
            WHERE id = :solicitud_id
        """)

        result = db.execute(query, {"solicitud_id": solicitud_id})
        db.commit()

        return result.rowcount > 0

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al marcar documentos como eliminados: {e}")
        raise


# -------------------------------------------------------
# Función principal: Eliminar documentos de una solicitud
# -------------------------------------------------------

def eliminar_todos_documentos_solicitud(
    db: Session, 
    solicitud_id: int, 
    upload_dir: str
) -> Tuple[int, List[str]]:
    """
    Elimina todos los documentos de una solicitud:
    1. Obtiene documentos con rutas
    2. Elimina archivos físicos
    3. Elimina registros de BD
    4. Marca solicitud como documentos_eliminados = TRUE
    
    Retorna: (documentos_eliminados, lista_errores)
    """
    try:

        # 1. Eliminar carpeta completa de documentos
        eliminados_fisicos, errores_fisicos = eliminar_carpeta_documentos_solicitud(
            upload_dir,
            solicitud_id
        )

        # 2. Si hubo errores eliminando archivos físicos, detener proceso
        if errores_fisicos:
            logger.error(
                f"No se eliminó completamente la carpeta de la solicitud {solicitud_id}. "
                f"Se cancela eliminación en BD."
            )
            raise Exception(
                f"No se pudieron eliminar los archivos físicos: {', '.join(errores_fisicos[:3])}"
            )

        # 3. Eliminar registros de BD
        eliminar_registros_documentos_bd(db, solicitud_id)
        
        # 4. Marcar solicitud
        marcar_documentos_como_eliminados(db, solicitud_id)
        
        logger.info(f"Documentos de solicitud {solicitud_id} eliminados exitosamente")
        
        return eliminados_fisicos, errores_fisicos
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error en eliminación de documentos de solicitud {solicitud_id}: {e}")
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error inesperado en eliminación de documentos: {e}")
        raise
