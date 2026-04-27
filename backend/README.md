# 🔧 Backend - API REST FastAPI

API REST que maneja toda la lógica de gestión de certificaciones.

---

## 📋 Contenidos

- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecutar](#ejecutar)
- [Estructura](#estructura)
- [Endpoints](#endpoints)
- [Base de Datos](#base-de-datos)

---

## 💾 Instalación

### Requisitos Previos

- Python 3.9+
- MySQL 5.7+
- pip

### Pasos

```bash
# 1. Navegar a carpeta backend
cd backend

# 2. Crear entorno virtual
python -m venv venv

# 3. Activar entorno
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 4. Instalar dependencias
pip install -r requirements.txt

# 5. Crear archivo .env
cp .env.example .env

# 6. Editar .env con valores reales
```

---

## ⚙️ Configuración

### Variables de Entorno (`.env`)

```env
# Base de Datos
DB_HOST=localhost              # Host MySQL
DB_PORT=3306                   # Puerto MySQL
DB_USER=root                   # Usuario MySQL
DB_PASSWORD=contraseña         # Contraseña
DB_NAME=railway                # Nombre de BD

# JWT Authentication
JWT_SECRET=clave_muy_segura    # Clave secreta (32+ caracteres)
JWT_ALGORITHM=HS256            # Algoritmo
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Almacenamiento de Archivos
UPLOAD_DIR=uploads/documentos  # Carpeta de uploads
MAX_FILE_SIZE_MB=10            # Tamaño máximo archivo

# Email
MAIL_SERVER=smtp.gmail.com     # Servidor SMTP
MAIL_PORT=587                  # Puerto SMTP
MAIL_USERNAME=email@gmail.com  # Usuario correo
MAIL_PASSWORD=app_password     # Contraseña app
MAIL_FROM=email@gmail.com      # Email origen
MAIL_FROM_NAME=Certificaciones

# URLs
BASE_URL=http://localhost:8000       # URL backend
FRONTEND_URL=http://localhost:5173   # URL frontend
```

### Generar JWT_SECRET Seguro

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 🚀 Ejecutar

### Desarrollo

```bash
python main.py

# Salida esperada:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete
```

**API disponible en**: `http://localhost:8000`

**Documentación interactiva**: `http://localhost:8000/docs`

### Producción

```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

---

## 📁 Estructura

```
backend/
├── app/
│   ├── crud/                    # Operaciones Base de Datos
│   │   ├── solicitudes.py       # CRUD solicitudes
│   │   ├── documentos.py        # CRUD documentos
│   │   ├── usuarios.py          # CRUD usuarios
│   │   ├── roles.py             # CRUD roles
│   │   ├── auth.py              # CRUD autenticación
│   │   └── ...
│   │
│   ├── router/                  # Endpoints API
│   │   ├── solicitudes.py       # Endpoints /solicitudes
│   │   ├── documentos.py        # Endpoints /documentos
│   │   ├── usuarios.py          # Endpoints /usuarios
│   │   ├── auth.py              # Endpoints /auth
│   │   ├── auditoria.py         # Endpoints /auditoria
│   │   └── ...
│   │
│   ├── schemas/                 # Validación Pydantic
│   │   ├── solicitudes.py       # Esquemas solicitudes
│   │   ├── usuarios.py          # Esquemas usuarios
│   │   └── ...
│   │
│   └── utils/                   # Utilidades
│       ├── email_service.py     # Envío de emails
│       ├── file_validation.py   # Validación de archivos
│       ├── pdf.py               # Procesamiento PDFs
│       └── auditoria.py         # Registro de auditoría
│
├── core/
│   ├── config.py                # Configuración general
│   ├── database.py              # Conexión a BD
│   └── security.py              # Funciones seguridad
│
├── main.py                      # Aplicación principal
├── requirements.txt             # Dependencias
└── .env.example                 # Plantilla variables
```

---

## 🔌 Endpoints Principales

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/refresh` | Renovar token |
| POST | `/auth/logout` | Cerrar sesión |
| POST | `/auth/cambiar-password` | Cambiar contraseña |

### Solicitudes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/solicitudes` | Listar solicitudes |
| POST | `/solicitudes` | Crear nueva solicitud |
| GET | `/solicitudes/{id}` | Obtener detalles |
| PUT | `/solicitudes/{id}` | Actualizar solicitud |
| DELETE | `/solicitudes/{id}` | Eliminar solicitud |

### Documentos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/documentos/upload` | Subir documento |
| GET | `/documentos/{id}` | Descargar documento |
| PUT | `/documentos/{id}` | Actualizar documento |

### Firmas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/firmas/pendientes` | Firmas pendientes |
| POST | `/firmas/{id}/firmar` | Firmar documento |
| POST | `/firmas/{id}/rechazar` | Rechazar firma |

### Reportes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/reportes/solicitudes` | Reporte solicitudes |
| GET | `/reportes/auditoría` | Reporte auditoría |

**Documentación completa**: `http://localhost:8000/docs`

---

## 🗄️ Base de Datos

### Crear BD Local

```bash
# Conectar a MySQL
mysql -u root -p

# Crear base de datos
CREATE DATABASE railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Importar schema
mysql -u root -p railway < ../schema.sql

# Importar datos iniciales (acciones, módulos, roles)
mysql -u root -p railway < ../seed.sql

# Verificar
mysql -u root -p railway -e "SHOW TABLES;"
```

### Modelos Principales

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Usuarios del sistema |
| `roles` | Roles (Admin, Funcionario, etc) |
| `solicitudes` | Solicitudes de certificación |
| `documentos_requeridos` | Tipos de documentos |
| `solicitud_documentos` | Documentos por solicitud |
| `firmas` | Control de firmas digitales |
| `auditoria` | Registro de todas las acciones |

---

## 📦 Dependencias Principales

```
fastapi==0.104.1           # Framework web
uvicorn==0.24.0            # ASGI server
sqlalchemy==2.0            # ORM
pydantic==2.5              # Validación datos
python-dotenv==1.0.0       # Variables entorno
python-magic-bin==0.4.14   # Validación archivos (Windows compatible)
PyJWT==2.8.1               # JWT tokens
pydantic-settings==2.1     # Configuración
fastapi-cors==0.0.6        # CORS middleware
```

---

## 🔒 Seguridad

✅ Rate limiting en endpoints sensibles
✅ Validación de tipos MIME de archivos
✅ Hashing de contraseñas con bcrypt
✅ JWT tokens con expiración
✅ SQL injection prevention
✅ CORS configurado
✅ Auditoría de todas las acciones

---

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'fastapi'"

```bash
pip install -r requirements.txt
```

### "Cannot connect to database"

```bash
# Verificar variables de entorno
echo $DB_HOST
echo $DB_PORT

# Probar conexión directa
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD
```

### "The field 'id' is required"

Verificar que el schema SQL se ejecutó correctamente.

---

## 📝 Desarrollo

### Crear nuevo endpoint

```python
# En router/ejemplo.py
from fastapi import APIRouter

router = APIRouter(prefix="/ejemplo", tags=["ejemplo"])

@router.get("/")
async def obtener_todos():
    return {"mensaje": "Hola"}

# En main.py agregar:
from app.router import ejemplo
app.include_router(ejemplo.router)
```

### Crear nuevo modelo CRUD

```python
# En app/crud/ejemplo.py
from sqlalchemy.orm import Session
from app.schemas import ejemplo as schemas_ejemplo

def obtener_todos(db: Session):
    return db.query(Ejemplo).all()

# En router/ejemplo.py usar:
from app.crud import ejemplo
items = ejemplo.obtener_todos(db)
```

---

## 📞 Soporte

Ver sección "Solucionar Problemas" en [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md)

---

**Versión**: 1.0.0
**Python**: 3.9+
**Última actualización**: 27/04/2026
