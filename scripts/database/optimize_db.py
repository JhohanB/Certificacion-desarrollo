#!/usr/bin/env python3
"""
Script para optimizar el rendimiento de la base de datos agregando índices.
Ejecutar después de hacer backup de la base de datos.
"""

import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from backend.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def optimize_database():
    """Agrega índices para mejorar el rendimiento de las consultas."""
    try:
        engine = create_engine(settings.DATABASE_URL)

        with engine.connect() as conn:
            logger.info("Iniciando optimización de base de datos...")

            # Función helper para crear índice si no existe
            def create_index_if_not_exists(index_name, table_name, columns):
                try:
                    # Verificar si el índice ya existe
                    result = conn.execute(text(f"""
                        SELECT COUNT(*) as count
                        FROM information_schema.statistics
                        WHERE table_schema = DATABASE()
                        AND table_name = '{table_name}'
                        AND index_name = '{index_name}'
                    """))
                    exists = result.fetchone()[0] > 0

                    if not exists:
                        if isinstance(columns, str):
                            columns_str = columns
                        else:
                            columns_str = ', '.join(columns)
                        conn.execute(text(f"CREATE INDEX {index_name} ON {table_name} ({columns_str})"))
                        logger.info(f"Índice {index_name} creado en {table_name}")
                    else:
                        logger.info(f"Índice {index_name} ya existe en {table_name}")
                except Exception as e:
                    logger.warning(f"Error creando índice {index_name}: {e}")

            # Índices para solicitud_documentos
            logger.info("Agregando índices para solicitud_documentos...")
            create_index_if_not_exists('idx_solicitud_documentos_solicitud_activa', 'solicitud_documentos', ['solicitud_id', 'es_version_activa'])
            create_index_if_not_exists('idx_solicitud_documentos_documento', 'solicitud_documentos', 'documento_id')

            # Índices para firmas
            logger.info("Agregando índices para firmas...")
            create_index_if_not_exists('idx_firmas_solicitud', 'firmas', 'solicitud_id')
            create_index_if_not_exists('idx_firmas_rol', 'firmas', 'rol_id')
            create_index_if_not_exists('idx_firmas_usuario', 'firmas', 'usuario_id')
            create_index_if_not_exists('idx_firmas_estado', 'firmas', 'estado_firma')

            # Índices para estados_historial
            logger.info("Agregando índices para estados_historial...")
            create_index_if_not_exists('idx_estados_historial_solicitud', 'estados_historial', 'solicitud_id')
            create_index_if_not_exists('idx_estados_historial_fecha', 'estados_historial', 'fecha_cambio')

            # Índices para solicitudes
            logger.info("Agregando índices para solicitudes...")
            create_index_if_not_exists('idx_solicitudes_estado', 'solicitudes', 'estado_actual')
            create_index_if_not_exists('idx_solicitudes_tipo_programa', 'solicitudes', 'tipo_programa_id')
            create_index_if_not_exists('idx_solicitudes_fecha', 'solicitudes', 'fecha_solicitud')

            # Índices para tipo_programa_roles
            logger.info("Agregando índices para tipo_programa_roles...")
            create_index_if_not_exists('idx_tipo_programa_roles_tipo_programa', 'tipo_programa_roles', 'tipo_programa_id')
            create_index_if_not_exists('idx_tipo_programa_roles_rol', 'tipo_programa_roles', 'rol_id')

            # Índices para usuarios
            logger.info("Agregando índices para usuarios...")
            create_index_if_not_exists('idx_usuarios_activo', 'usuarios', 'activo')
            create_index_if_not_exists('idx_usuarios_rol', 'usuarios', 'rol_id')

            # Índices para auditoria
            logger.info("Agregando índices para auditoria...")
            create_index_if_not_exists('idx_auditoria_tabla_id', 'auditoria', ['tabla', 'registro_id'])
            create_index_if_not_exists('idx_auditoria_fecha', 'auditoria', 'fecha_accion')

            conn.commit()
            logger.info("Optimización completada exitosamente!")

            # Verificar índices creados
            logger.info("Verificando índices...")
            result = conn.execute(text("""
                SELECT table_name, COUNT(*) as indices_count
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                GROUP BY table_name
                ORDER BY table_name
            """))
            for row in result:
                logger.info(f"{row[0]}: {row[1]} índices")

    except SQLAlchemyError as e:
        logger.error(f"Error durante la optimización: {e}")
        raise

if __name__ == "__main__":
    optimize_database()