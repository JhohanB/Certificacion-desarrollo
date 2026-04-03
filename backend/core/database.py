from typing import Generator
import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError, OperationalError, DisconnectionError
from sqlalchemy.pool import QueuePool

from core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    echo=True,           # Imprime las sentencias SQL en consola, cambiar a False en producción
    pool_pre_ping=True,  # Verifica que las conexiones estén activas antes de usarlas
    pool_recycle=3600,   # Recicla conexiones después de 1 hora
    pool_size=10,        # Conexiones permanentes en el pool
    max_overflow=20,     # Conexiones adicionales cuando el pool está lleno
    pool_timeout=30,     # Tiempo máximo de espera para obtener una conexión
    poolclass=QueuePool
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db() -> Generator:
    """
    Dependencia para obtener una sesión de base de datos en FastAPI.
    Se usa en todos los endpoints como Depends(get_db).
    
    Configura automáticamente la zona horaria de Colombia para todos los queries.

    Yields:
        Session: Sesión de SQLAlchemy para interactuar con la base de datos.

    Example:
        @router.get("/solicitudes")
        def get_solicitudes(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        # Configurar timezone de Colombia (UTC-5) para esta sesión
        # Usando offset en lugar de nombre de zona horaria para compatibilidad
        db.execute(text("SET time_zone = '-05:00'"))
        yield db
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error de base de datos: {str(e)}")
        raise
    finally:
        db.close()


def check_database_connection() -> bool:
    """
    Verifica que la conexión a la base de datos esté activa.
    Se llama al iniciar la aplicación en main.py.

    Returns:
        bool: True si la conexión es exitosa, False en caso contrario.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info("Conexión a la base de datos exitosa")
        return True
    except (OperationalError, DisconnectionError) as e:
        logger.error(f"Error de conexión a la base de datos: {str(e)}")
        return False