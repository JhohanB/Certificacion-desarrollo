import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Plantillas
# -------------------------------------------------------

def create_plantilla(db: Session, version: str, archivo_url: str, usuario_id: int) -> int:
    """Crea una nueva plantilla de formato."""
    try:
        query = text("""
            INSERT INTO plantillas_formato (version, archivo_url, activa, creado_por)
            VALUES (:version, :archivo_url, FALSE, :usuario_id)
        """)
        result = db.execute(query, {
            "version": version,
            "archivo_url": archivo_url,
            "usuario_id": usuario_id
        })
        db.commit()
        return result.lastrowid
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al crear plantilla: {e}")
        raise


def activar_plantilla(db: Session, plantilla_id: int) -> bool:
    """
    Activa una plantilla y desactiva la anterior.
    Se hace en dos pasos para evitar el error del trigger de MySQL.
    """
    try:
        # Primero desactivar todas
        db.execute(text("UPDATE plantillas_formato SET activa = FALSE WHERE activa = TRUE"))
        # Luego activar la nueva
        db.execute(text("UPDATE plantillas_formato SET activa = TRUE WHERE id = :id"), {"id": plantilla_id})
        db.commit()
        return True
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al activar plantilla: {e}")
        raise


def get_plantilla_by_id(db: Session, plantilla_id: int) -> Optional[dict]:
    """Obtiene una plantilla con sus coordenadas."""
    try:
        query = text("""
            SELECT id, version, archivo_url, activa, creado_en
            FROM plantillas_formato
            WHERE id = :plantilla_id
        """)
        plantilla = db.execute(query, {"plantilla_id": plantilla_id}).mappings().first()
        if not plantilla:
            return None

        coordenadas = get_coordenadas_by_plantilla(db, plantilla_id)
        return {**dict(plantilla), "coordenadas": coordenadas}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener plantilla: {e}")
        raise


def get_all_plantillas(db: Session) -> list:
    """Obtiene todas las plantillas ordenadas por fecha de creación."""
    try:
        query = text("""
            SELECT id, version, archivo_url, activa, creado_en
            FROM plantillas_formato
            ORDER BY creado_en DESC
        """)
        return db.execute(query).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener plantillas: {e}")
        raise


def get_plantilla_activa(db: Session) -> Optional[dict]:
    """Obtiene la plantilla activa con sus coordenadas."""
    try:
        query = text("""
            SELECT id, version, archivo_url, activa, creado_en
            FROM plantillas_formato
            WHERE activa = TRUE
            LIMIT 1
        """)
        plantilla = db.execute(query).mappings().first()
        if not plantilla:
            return None

        coordenadas = get_coordenadas_by_plantilla(db, plantilla["id"])
        return {**dict(plantilla), "coordenadas": coordenadas}
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener plantilla activa: {e}")
        raise


# -------------------------------------------------------
# Coordenadas
# -------------------------------------------------------

def save_coordenadas(db: Session, plantilla_id: int, coordenadas: list) -> None:
    """
    Guarda las coordenadas de firma para una plantilla.
    Reemplaza las coordenadas existentes.
    """
    try:
        # Eliminar coordenadas anteriores
        query_delete = text("""
            DELETE FROM coordenadas_firma WHERE plantilla_id = :plantilla_id
        """)
        db.execute(query_delete, {"plantilla_id": plantilla_id})

        # Insertar nuevas coordenadas
        for coord in coordenadas:
            query = text("""
                INSERT INTO coordenadas_firma (
                    plantilla_id, rol_id, pagina,
                    x_porcentaje, y_porcentaje, ancho_porcentaje, alto_porcentaje,
                    nombre_x_porcentaje, nombre_y_porcentaje,
                    nombre_ancho_porcentaje, nombre_alto_porcentaje
                ) VALUES (
                    :plantilla_id, :rol_id, :pagina,
                    :x_porcentaje, :y_porcentaje, :ancho_porcentaje, :alto_porcentaje,
                    :nombre_x_porcentaje, :nombre_y_porcentaje,
                    :nombre_ancho_porcentaje, :nombre_alto_porcentaje
                )
            """)
            db.execute(query, {
                "plantilla_id": plantilla_id,
                "rol_id": coord["rol_id"],
                "pagina": coord["pagina"],
                "x_porcentaje": coord["x_porcentaje"],
                "y_porcentaje": coord["y_porcentaje"],
                "ancho_porcentaje": coord["ancho_porcentaje"],
                "alto_porcentaje": coord["alto_porcentaje"],
                "nombre_x_porcentaje": coord["nombre_x_porcentaje"],
                "nombre_y_porcentaje": coord["nombre_y_porcentaje"],
                "nombre_ancho_porcentaje": coord["nombre_ancho_porcentaje"],
                "nombre_alto_porcentaje": coord["nombre_alto_porcentaje"],
            })
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error al guardar coordenadas: {e}")
        raise


def get_coordenadas_by_plantilla(db: Session, plantilla_id: int) -> list:
    """Obtiene las coordenadas de firma de una plantilla."""
    try:
        query = text("""
            SELECT
                cf.id, cf.rol_id, r.nombre AS nombre_rol,
                cf.pagina, cf.x_porcentaje, cf.y_porcentaje,
                cf.ancho_porcentaje, cf.alto_porcentaje,
                cf.nombre_x_porcentaje, cf.nombre_y_porcentaje,
                cf.nombre_ancho_porcentaje, cf.nombre_alto_porcentaje
            FROM coordenadas_firma cf
            INNER JOIN roles r ON r.id = cf.rol_id
            WHERE cf.plantilla_id = :plantilla_id
            ORDER BY cf.pagina ASC, cf.rol_id ASC
        """)
        return db.execute(query, {"plantilla_id": plantilla_id}).mappings().all()
    except SQLAlchemyError as e:
        logger.error(f"Error al obtener coordenadas: {e}")
        raise


def tiene_coordenadas_completas(db: Session, plantilla_id: int) -> bool:
    """
    Verifica que la plantilla tenga coordenadas configuradas
    para todos los roles firmantes activos.
    """
    try:
        query = text("""
            SELECT COUNT(*) AS roles_activos
            FROM roles
            WHERE requiere_firma = TRUE AND activo = TRUE
        """)
        total = db.execute(query).mappings().first()["roles_activos"]

        query_coord = text("""
            SELECT COUNT(*) AS coords_configuradas
            FROM coordenadas_firma
            WHERE plantilla_id = :plantilla_id
        """)
        configuradas = db.execute(query_coord, {"plantilla_id": plantilla_id}).mappings().first()["coords_configuradas"]

        return total > 0 and total == configuradas
    except SQLAlchemyError as e:
        logger.error(f"Error al verificar coordenadas: {e}")
        raise