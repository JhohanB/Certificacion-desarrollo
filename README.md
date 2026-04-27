# 📜 Certificación SENA - Sistema de Gestión

Sistema web completo para gestionar y digitalizar el proceso de certificación de aprendices en el Centro de Atención Sector Agropecuario del SENA.

**Estado**: ✅ Producción Ready | **Versión**: 1.0.0

---

## 📋 Características

- ✅ Gestión de solicitudes de certificación
- ✅ Carga y validación de documentos PDF
- ✅ Flujo de firmas digitales
- ✅ Sistema de observaciones y correcciones
- ✅ Auditoría completa de cambios
- ✅ Control de roles y permisos
- ✅ Notificaciones por email
- ✅ Dashboard de reportes
- ✅ Soporte para múltiples formatos de certificación

---

## 🏗️ Estructura del Proyecto

```
certificacion-sena/
├── backend/                 # API FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── crud/           # Operaciones base de datos
│   │   ├── router/         # Endpoints API
│   │   ├── schemas/        # Validación Pydantic
│   │   └── utils/          # Utilidades (email, PDF, etc)
│   ├── core/               # Configuración y seguridad
│   ├── main.py             # Aplicación principal
│   ├── requirements.txt    # Dependencias Python
│   └── README.md           # Documentación backend
│
├── frontend/               # App React + Vite
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── pages/          # Páginas de la app
│   │   ├── api/            # Configuración axios
│   │   ├── context/        # Context API (auth)
│   │   └── hooks/          # Custom hooks
│   ├── package.json        # Dependencias Node
│   └── README.md           # Documentación frontend
│
├── scripts/                # Scripts de utilidad
│   ├── database/           # Scripts SQL y optimizaciones
│   └── testing/            # Pruebas y mediciones
│
├── .gitignore              # Archivos ignorados por Git
├── README.md               # Este archivo
├── PRODUCTION_DEPLOYMENT.md # Guía de despliegue
└── schema.sql / seed.sql   # Base de datos
```

---

## 🚀 Inicio Rápido

### **1. Clonar repositorio**

```bash
git clone https://github.com/tu-usuario/certificacion-sena.git
cd certificacion-sena
```

### **2. Configurar Backend**

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Ejecutar
python main.py
```

Backend en: `http://localhost:8000`
Docs API: `http://localhost:8000/docs`

### **3. Configurar Frontend**

```bash
cd frontend

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con URL del backend

# Ejecutar
npm run dev
```

Frontend en: `http://localhost:5173`

### **4. Base de Datos**

```bash
# Crear BD
mysql -u root -p
CREATE DATABASE railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Importar schema
mysql -u root -p railway < schema.sql

# Cargar datos iniciales
mysql -u root -p railway < seed.sql
```

---

## 📚 Documentación Completa

- **[Backend README](./backend/README.md)** - API, endpoints, configuración
- **[Frontend README](./frontend/README.md)** - UI, componentes, build
- **[Deployment Guide](./PRODUCTION_DEPLOYMENT.md)** - Paso a paso para producción
- **[Scripts README](./scripts/README.md)** - Utilidades y herramientas

---

## 🔧 Tecnologías Utilizadas

### Backend
- **FastAPI** 0.104.1 - Framework web moderno
- **SQLAlchemy** 2.0 - ORM para base de datos
- **Pydantic** 2.5 - Validación de datos
- **Python-magic-bin** 0.4.14 - Validación de archivos
- **MySQL** - Base de datos
- **JWT** - Autenticación

### Frontend
- **React** 19 - Librería UI
- **Vite** 7.3.1 - Build tool
- **Ant Design** 6.3.2 - Componentes UI
- **Axios** - HTTP client
- **React Router** 7.13.1 - Routing

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Tablas BD** | 20+ |
| **Endpoints API** | 40+ |
| **Componentes React** | 50+ |
| **Usuarios Objetivo** | 5-10 |
| **Tamaño Deploy** | ~15MB (frontend dist) |

---

## 🔐 Seguridad

✅ Rate limiting en login (5 intentos, 5 min bloqueo)
✅ Validación de archivos con análisis de MIME type
✅ Hashing de contraseñas
✅ JWT para autenticación
✅ CORS configurado
✅ SQL injection prevention
✅ Auditoría de acciones

---

## 🌐 Despliegue

Aplicación lista para desplegar en:

- ✅ **Railway** (recomendado)
- ✅ **Render**
- ✅ **Vercel** (frontend)
- ✅ **AWS**
- ✅ **DigitalOcean**
- ✅ **Heroku**

Ver [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) para instrucciones detalladas.

---

## 📝 Variables de Entorno Necesarias

### Backend (`.env`)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=contraseña
DB_NAME=railway

JWT_SECRET=tu_clave_segura
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=tu_email@gmail.com
MAIL_PASSWORD=app_password

BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:8000
```

---

## 🤝 Contribuciones

Este proyecto es específico del SENA Centro Atención Sector Agropecuario.

---

## 📄 Licencia

Uso interno SENA - Año 2026

---

## 📞 Contacto y Soporte

Para problemas o preguntas, revisar:
1. [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Sección "Solucionar Problemas"
2. Documentación en carpetas `backend/` y `frontend/`
3. Archivos SQL en `scripts/database/`

---

**Última actualización**: 27/04/2026
**Desarrollado para**: SENA Centro Atención Sector Agropecuario
