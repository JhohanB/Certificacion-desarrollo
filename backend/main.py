import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from core.config import settings
from core.database import check_database_connection
from app.router import auth, usuarios, solicitudes, documentos, plantillas, auditoria, reportes, roles, tipo_programas, solicitudes_eliminar_documentos

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicación...")

    if check_database_connection():
        logger.info("Base de datos conectada correctamente")
    else:
        logger.error("No se pudo conectar a la base de datos")

    yield

    logger.info("Cerrando aplicación...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description=settings.PROJECT_DESCRIPTION,
    swagger_ui_oauth2_redirect_url="/auth/token",
    lifespan=lifespan
)

# -------------------------------------------------------
# CORS Middleware
# En producción cambiar allow_origins por el dominio real
# -------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"]
)

# -------------------------------------------------------
# Servir archivos estáticos (firmas y documentos subidos)
# -------------------------------------------------------
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# @app.get("/uploads/{file_path:path}")
# async def serve_upload(file_path: str):
#     full_path = f"uploads/{file_path}"
#     logger.info(f"Sirviendo archivo: {full_path}, existe: {os.path.exists(full_path)}")
#     if not os.path.exists(full_path):
#         logger.error(f"Archivo no encontrado: {full_path}")
#         raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
#     response = FileResponse(
#         full_path,
#         media_type="application/pdf"
#     )

#     # forzar headers manualmente
#     response.headers["Access-Control-Allow-Origin"] = "*"
#     response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
#     response.headers["Access-Control-Allow-Headers"] = "*"
    
#     return response

# -------------------------------------------------------
# Routers
# -------------------------------------------------------
app.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
app.include_router(usuarios.router, prefix="/usuarios", tags=["Usuarios"])
app.include_router(solicitudes.router, prefix="/solicitudes", tags=["Solicitudes"])
app.include_router(solicitudes_eliminar_documentos.router, prefix="/solicitudes", tags=["Solicitudes"])
app.include_router(documentos.router, prefix="/documentos", tags=["Documentos y Firmas"])
app.include_router(plantillas.router, prefix="/plantillas", tags=["Plantillas de Formato"])
app.include_router(auditoria.router, prefix="/auditoria", tags=["Auditoría"])
app.include_router(reportes.router, prefix="/reportes", tags=["Reportes"])
app.include_router(roles.router, prefix="/roles", tags=["Roles y Permisos"])
app.include_router(tipo_programas.router, prefix="/tipo-programas", tags=["Niveles de Formación"])


@app.get("/")
def root():
    return {
        "sistema": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "estado": "activo"
    }

@app.get("/health", tags=["Sistema"])
def health_check(db=None):
    """
    Endpoint de salud del sistema.
    Verifica que el servidor y la base de datos estén operativos.
    Útil para monitoreo y despliegue.
    """
    from core.database import check_database_connection
    db_ok = check_database_connection()
    return {
        "estado": "ok" if db_ok else "degradado",
        "servidor": "ok",
        "base_de_datos": "ok" if db_ok else "error",
        "version": settings.PROJECT_VERSION
    }