# 📦 Guía de Despliegue a Producción - Certificación SENA

**Estado del Proyecto**: ✅ Completado y listo para deploy

---

## 📋 Tabla de Contenidos
1. [Pre-requisitos](#pre-requisitos)
2. [Paso a Paso Despliegue](#paso-a-paso-despliegue)
3. [Configuración del Backend](#configuración-del-backend)
4. [Configuración del Frontend](#configuración-del-frontend)
5. [Variables de Entorno](#variables-de-entorno)
6. [Base de Datos](#base-de-datos)
7. [Consideraciones de Seguridad](#consideraciones-de-seguridad)
8. [Solucionar Problemas](#solucionar-problemas)

---

## 🔧 Pre-requisitos

Independientemente del servidor elegido, necesitas:

- **Python 3.9+** (backend)
- **Node.js 18+** (frontend)
- **MySQL 5.7+** (base de datos)
- **Git** (versionamiento)
- Acceso a un servidor (Railway, Render, Vercel, AWS, DigitalOcean, etc)

---

## 🚀 Paso a Paso Despliegue

### **FASE 1: Preparar Repositorio Git**

```bash
# 1. Inicializar Git si no lo hiciste
cd /tu/ruta/proyecto
git init

# 2. Crear .gitignore
# (Ya incluido en el proyecto)

# 3. Primer commit
git add .
git commit -m "Initial commit: Certificación SENA Sistema Completo"

# 4. Agregar repositorio remoto (GitHub, GitLab, etc)
git remote add origin https://github.com/tuusuario/certificacion-sena.git
git branch -M main
git push -u origin main
```

---

### **FASE 2: Elegir Estrategia de Despliegue**

#### **Opción A: Railway (Recomendado para este proyecto - pequeña escala)**

**Ventajas:**
- ✅ Fácil de usar
- ✅ Soporta Python y Node.js
- ✅ MySQL incluido
- ✅ Despliegue automático desde Git
- ✅ Tier gratuito generoso

**Pasos:**
1. Crear cuenta en [railway.app](https://railway.app)
2. Conectar GitHub
3. Crear nuevo proyecto desde repositorio
4. Railway detectará automáticamente:
   - Backend (Python/FastAPI)
   - Frontend (Node/Vite)
5. Configurar variables de entorno en dashboard
6. Deploy automático en cada push

---

#### **Opción B: Render (Alternativa)**

**Ventajas:**
- ✅ Gratis con limitaciones
- ✅ Deploy desde Git
- ✅ Incluye PostgreSQL (MySQL requiere pago)

---

#### **Opción C: AWS/DigitalOcean (Para Alta Disponibilidad)**

**Ventajas:**
- ✅ Escalable
- ✅ Control total
- Requiere más configuración

---

### **FASE 3: Configurar Variables de Entorno en Producción**

**Backend (.env en servidor):**

```env
# Database - CAMBIAR SEGÚN TU SERVIDOR
DB_HOST=tu-servidor-mysql.com
DB_PORT=3306
DB_USER=usuario_prod
DB_PASSWORD=contraseña_muy_segura_32_caracteres
DB_NAME=railway

# JWT - GENERAR NUEVA CLAVE
JWT_SECRET=genera_con: python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Almacenamiento
UPLOAD_DIR=uploads/documentos
MAX_FILE_SIZE_MB=10

# Email - Usar contraseña de aplicación
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=tu_email@gmail.com
MAIL_PASSWORD=tu_app_password
MAIL_FROM=tu_email@gmail.com
MAIL_FROM_NAME=Certificaciones SENA

# URLs en Producción
BASE_URL=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com
```

**Frontend (.env.production en servidor):**

```env
VITE_API_URL=https://tu-dominio-backend.com
```

---

## 🎛️ Configuración del Backend

### **Requisitos**

```bash
# Instalar dependencias
pip install -r requirements.txt

# Verificar instalación
pip list | grep fastapi
```

### **Base de Datos**

```bash
# 1. Crear base de datos
mysql -u root -p
CREATE DATABASE railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 2. Ejecutar schema
mysql -u root -p railway < schema.sql

# 3. Cargar datos iniciales
mysql -u root -p railway < seed.sql

# 4. Verificar tablas
mysql -u root -p railway -e "SHOW TABLES;"
```

### **Ejecutar Backend**

```bash
# Desarrollo
python main.py
# Se ejecuta en http://localhost:8000

# Producción (con gunicorn)
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

---

## 🎨 Configuración del Frontend

### **Requisitos**

```bash
# Instalar dependencias
npm install

# Build de producción
npm run build

# Resultado en carpeta: dist/
```

### **Ejecutar Frontend**

```bash
# Desarrollo
npm run dev
# Se ejecuta en http://localhost:5173

# Producción (servir con servidor web)
# El contenido de dist/ se sirve con nginx, Apache, etc
```

---

## 🔐 Variables de Entorno - Resumen

| Variable | Backend | Frontend | Descripción | Ejemplo |
|----------|---------|----------|-------------|---------|
| `DB_HOST` | ✅ | ❌ | Host de MySQL | `mysql.railway.internal` |
| `DB_PORT` | ✅ | ❌ | Puerto MySQL | `3306` |
| `DB_USER` | ✅ | ❌ | Usuario BD | `root` |
| `DB_PASSWORD` | ✅ | ❌ | Contraseña BD | `***` |
| `DB_NAME` | ✅ | ❌ | Nombre BD | `railway` |
| `JWT_SECRET` | ✅ | ❌ | Clave JWT | `secreto_seguro_32_chars` |
| `JWT_ALGORITHM` | ✅ | ❌ | Algoritmo | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | ✅ | ❌ | Expiración token | `60` |
| `UPLOAD_DIR` | ✅ | ❌ | Carpeta uploads | `uploads/documentos` |
| `MAX_FILE_SIZE_MB` | ✅ | ❌ | Tamaño máx archivo | `10` |
| `MAIL_SERVER` | ✅ | ❌ | Servidor SMTP | `smtp.gmail.com` |
| `MAIL_PORT` | ✅ | ❌ | Puerto SMTP | `587` |
| `MAIL_USERNAME` | ✅ | ❌ | Usuario correo | `tu_email@gmail.com` |
| `MAIL_PASSWORD` | ✅ | ❌ | Password app | `***` |
| `MAIL_FROM` | ✅ | ❌ | Email origen | `tu_email@gmail.com` |
| `MAIL_FROM_NAME` | ✅ | ❌ | Nombre remitente | `Certificaciones SENA` |
| `BASE_URL` | ✅ | ❌ | URL backend | `https://api.tudominio.com` |
| `FRONTEND_URL` | ✅ | ❌ | URL frontend | `https://tudominio.com` |
| `VITE_API_URL` | ❌ | ✅ | URL API (frontend) | `https://api.tudominio.com` |

---

## 🗄️ Base de Datos

### **Crear Nueva BD en Producción**

```bash
# Usando MySQL Workbench
1. Host: tu-mysql-server.com
2. Port: 3306
3. Username: root
4. Password: tu_password

# O por línea de comandos
mysql -h tu-mysql-server.com -u root -p -e "CREATE DATABASE railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Importar schema
mysql -h tu-mysql-server.com -u root -p railway < schema.sql

# Importar datos iniciales
mysql -h tu-mysql-server.com -u root -p railway < seed.sql
```

### **Respaldo de BD**

```bash
# Crear backup
mysqldump -h tu-servidor -u usuario -p nombre_db > backup_$(date +%Y%m%d).sql

# Restaurar desde backup
mysql -h tu-servidor -u usuario -p nombre_db < backup_20260427.sql
```

---

## 🔐 Consideraciones de Seguridad

### **Crítico - ANTES de Producción**

- ✅ **Cambiar `JWT_SECRET`** - Generar nueva clave segura
- ✅ **Cambiar `DB_PASSWORD`** - No usar contraseña débil
- ✅ **HTTPS/SSL** - Usar certificado válido
- ✅ **CORS** - Configurar según dominio final
- ✅ **Rate Limiting** - Ya implementado ✓
- ✅ **Validación de Archivos** - Ya implementada ✓
- ✅ **Variables NO en Git** - Solo `.env.example` en repo

### **Generar JWT_SECRET Seguro**

```python
import secrets
print(secrets.token_urlsafe(32))
# Ejemplo: "dPqZc4kT_N9mL2vX8wFj-B5HyR1PqK3L"
```

### **Configurar CORS en Backend** (si es necesario)

En `main.py` agregar:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tudominio.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🆘 Solucionar Problemas

### **Error: "Cannot connect to database"**

```bash
# Verificar variables de entorno
echo $DB_HOST
echo $DB_PORT

# Probar conexión
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "SELECT 1;"
```

### **Error: "Module not found: fastapi"**

```bash
# Backend
pip install -r requirements.txt

# Verificar
python -c "import fastapi; print(fastapi.__version__)"
```

### **Error: "VITE_API_URL not defined"**

```bash
# Frontend - Asegurarse que .env existe
echo "VITE_API_URL=https://tu-api.com" > .env

# Build nuevamente
npm run build
```

### **Archivos no se suben correctamente**

- Verificar permisos carpeta `uploads/`
- Verificar `UPLOAD_DIR` en `.env`
- Confirmar `MAX_FILE_SIZE_MB`

---

## 📞 Soporte y Referencias

- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)
- [Railway Documentation](https://railway.app/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)

---

**Última actualización**: 27/04/2026
**Versión del Sistema**: 1.0.0
