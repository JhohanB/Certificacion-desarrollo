# Preparación para despliegue en Render

## 1. Diferencias entre las opciones de despliegue

### Opción A: Frontend como Static Site + Backend como Web Service

- Frontend se despliega como un sitio estático en Render.
- Backend se despliega como un servicio web en Render.
- El frontend hace solicitudes a la URL del backend.
- Necesitas configurar CORS correctamente en el backend.

Ventajas:
- Fácil de configurar con el repo actual.
- El frontend es rápido y estático.
- El backend queda separado y puede escalar independientemente.

Desventajas:
- Requiere CORS en producción.
- Requiere dos servicios diferentes en Render.

### Opción B: Backend solo como Web Service que también sirve el frontend

- Construyes el frontend en `frontend/dist`.
- El backend FastAPI sirve los archivos estáticos de `dist`.
- Todo queda bajo un mismo origen.

Ventajas:
- Evita problemas de CORS en producción.
- Solo necesitas un servicio en Render.

Desventajas:
- Requiere adaptar el backend para servir el frontend estático.
- Es un poco más complejo de preparar si no está hecho ya.

### ¿Cuál es la mejor opción?

Para este proyecto y para una solución definitiva en Render, yo recomiendo:

- **Mejor opción: Opción A para inicializar rápido.**
  - Usa un **Static Site** para el frontend.
  - Usa un **Web Service** para el backend.
  - Configura CORS sólo para el dominio del frontend.

- **Mejor opción si quieres evitar CORS por completo:** Opción B.
  - Sirve el frontend desde el backend.
  - Esto es ideal si quieres un sólo dominio en producción.

> Nota: la solución más sólida en producción es usar un mismo dominio o un reverse proxy.
> En Render, la Opción A es más fácil; la Opción B es la más limpia para evitar CORS.

---

## 2. Almacenamiento de archivos (uploads folder)

### Problema con la carpeta uploads en Render

- **Render no proporciona almacenamiento persistente gratuito**: Los archivos subidos a la carpeta `uploads/` en el contenedor de Render se pierden cuando el servicio se reinicia o redeploya.
- **Tu aplicación actual guarda archivos localmente**: En `backend/uploads/documentos/` y subcarpetas.
- **En producción necesitas almacenamiento externo**: Para que los archivos persistan y sean accesibles desde cualquier instancia.

### Opciones gratuitas para almacenar archivos

Aquí te detallo opciones gratuitas o con tier gratuito que puedes usar para almacenar los PDFs y otros archivos:

#### 1. **Cloudinary (Recomendado para PDFs e imágenes)**
   - **Tier gratuito**: 25GB almacenamiento, 25GB mensual de transferencia.
   - **Ventajas**: Especializado en media, fácil integración con FastAPI, soporta PDFs.
   - **Desventajas**: Limitado a 25GB, pero suficiente para empezar.
   - **Cómo integrarlo**:
     - Crea cuenta en cloudinary.com
     - Instala `cloudinary` en Python: `pip install cloudinary`
     - Configura en `backend/core/config.py` con variables de entorno.
     - Modifica `backend/app/crud/documentos.py` para subir a Cloudinary en lugar de disco local.

#### 2. **AWS S3 (Amazon Simple Storage Service)**
   - **Tier gratuito**: 5GB almacenamiento, 20,000 GET requests, 2,000 PUT requests por mes (12 meses gratis).
   - **Ventajas**: Muy confiable, escalable, usado en producción.
   - **Desventajas**: Un poco más complejo de configurar inicialmente.
   - **Cómo integrarlo**:
     - Crea cuenta AWS (gratuita), habilita S3.
     - Instala `boto3` en Python: `pip install boto3`
     - Configura credenciales en variables de entorno.
     - Modifica el código de subida para usar S3.

#### 3. **Google Cloud Storage**
   - **Tier gratuito**: 5GB almacenamiento, 1GB descarga mensual (siempre gratis).
   - **Ventajas**: Integración con Google Cloud, confiable.
   - **Desventajas**: Requiere cuenta Google Cloud.
   - **Cómo integrarlo**: Similar a S3, usa la librería `google-cloud-storage`.

#### 4. **Firebase Storage (de Google)**
   - **Tier gratuito**: 5GB almacenamiento, 1GB descarga mensual.
   - **Ventajas**: Fácil si ya usas Firebase, buena documentación.
   - **Desventajas**: Parte de Firebase ecosystem.
   - **Cómo integrarlo**: Usa Firebase Admin SDK en Python.

#### 5. **Backblaze B2**
   - **Tier gratuito**: 10GB almacenamiento (siempre gratis).
   - **Ventajas**: Muy barato, API simple.
   - **Desventajas**: Menos conocido, pero confiable.
   - **Cómo integrarlo**: Similar a S3, librería `b2sdk`.

### Recomendación para tu proyecto

- **Empieza con Cloudinary**: Es el más fácil para PDFs y tiene buena documentación para FastAPI.
- **Si quieres algo más robusto**: AWS S3, pero requiere más setup.
- **Para producción definitiva**: Cualquier opción de cloud storage es mejor que disco local.

### Cambios necesarios en el código

Para implementar cualquiera de estas opciones:

1. **Instala la librería correspondiente** en `backend/requirements.txt`.
2. **Agrega variables de entorno** para credenciales (API keys, secrets).
3. **Modifica `backend/app/crud/documentos.py`**:
   - Cambia la lógica de subida para usar el servicio de storage.
   - Actualiza las URLs de descarga para apuntar al storage externo.
4. **Actualiza `backend/main.py`**:
   - Si sirves archivos desde storage, cambia el endpoint `/uploads` para redirigir o proxy a las URLs externas.

> **Nota importante**: No cambies el código aún. Solo prepara los cambios comentados como indiqué antes.

---

## 3. Qué cambiar en los archivos para preparar producción

No vas a cambiar permanentemente ahora, pero puedes preparar cambios comentados.

### Backend (`backend/main.py`)

1. **CORS**
   - Si usas frontend estático separado, debes permitir el origen del frontend Render.
   - Ejemplo:
     - `allow_origins=["https://<tu-frontend>.onrender.com"]`
     - `allow_credentials=False`
   - En producción no es buena idea usar `"*"` si el frontend envía cabeceras autorizadas.

2. **`UPLOAD_DIR`**
   - El backend actual usa `uploads/` en disco local.
   - En Render el filesystem no es persistente para cambios entre deploys.
   - Opciones:
     - Usar un servicio de almacenamiento (S3, Backblaze B2, Google Cloud Storage).
     - Si usas Render, preferiblemente no dependas sólo de archivos locales.

3. **Variables de entorno**
   - Debes usar variables de entorno para configuraciones sensibles:
     - base de datos
     - secretos JWT
     - credenciales de email
     - `UPLOAD_DIR`
   - No dejar valores hardcodeados en el código.

4. **Servidor de producción**
   - En Render debes iniciar con:
     - `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - No uses `localhost:8000` en producción para el start.

### Frontend (`frontend/vite.config.js`, `frontend/src/api/axios.js`, `.env`)

1. **`VITE_API_URL`**
   - En producción debes apuntar a la URL del backend Render.
   - Ejemplo:
     - `VITE_API_URL=https://<tu-backend>.onrender.com`
   - No dejes `http://localhost:8000` en el código final.

2. **Proxy de desarrollo**
   - El proxy de Vite es sólo para desarrollo local.
   - No hace falta en producción.
   - Mantenlo comentado o en `vite.config.js` sólo en dev.

3. **Llamadas a la API**
   - Asegúrate de usar `import.meta.env.VITE_API_URL` o `API_URL` en `frontend/src/api/axios.js`.
   - Que el frontend use la configuración correcta según el entorno.

4. **Archivos estáticos**
   - El `dist/` se genera en producción.
   - No debes subir `dist/` al repo si despliegas con Render Static Site.

---

## 4. Revisión de archivos y carpetas vacíos / generados

### Carpetas vacías reales

- No se encontraron carpetas vacías importantes en `backend/app` o `frontend/src`.
- Todo lo importante ya tiene contenido.

### Carpetas que deberías limpiar/no subir al repo

- `backend/venv/`
  - No debe subirse al repo.
  - Es tu entorno local.

- `frontend/node_modules/`
  - No debe subirse al repo.
  - Es generado por `npm install`.

- `frontend/dist/`
  - Se genera con `npm run build`.
  - No es necesario subirlo si usas Render Static Site, pero puedes ignorarlo en `.gitignore`.

- `__pycache__/`
  - No subas esto al repo.

- `uploads/`
  - Actualmente está en el repo local.
  - En producción no es buen lugar para almacenar archivos definitivos.
  - Si decides mantenerlo, al menos indica que es solo para desarrollo local.

### Archivos que conviene revisar o limpiar

- `backend/.env` y `backend/.env.example`
  - Asegúrate de no subir tus credenciales reales.
  - Usa `.env.example` con variables de ejemplo.

- `frontend/.env` o `.env.local`
  - Debe contener `VITE_API_URL` para producción o dev local.
  - No subas tus claves sensibles.

---

## 5. Qué debes hacer en Render para una solución definitiva

### Si eliges Opción A (preferido para este repo)

1. Despliega el backend en Render como **Web Service**.
   - Root Directory: `backend`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Build Command: `pip install -r requirements.txt`

2. Despliega el frontend en Render como **Static Site**.
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

3. Configura la variable de entorno en frontend:
   - `VITE_API_URL=https://<tu-backend>.onrender.com`

4. Configura CORS en backend para el dominio del frontend:
   - `allow_origins=["https://<tu-frontend>.onrender.com"]`

5. Revisa los endpoints `/uploads/...` desde el frontend.
   - Debe cargar en Network sin error CORS.

### Si eliges Opción B (evita CORS en producción)

1. Genera el build del frontend con `npm run build`.
2. Copia `frontend/dist` dentro del backend o configura FastAPI para servirlo.
3. Ajusta el backend para servir los archivos estáticos y la página `index.html`.
4. En Render levanta solo el backend.

> Esta opción evita CORS porque todo queda en el mismo origen.
> Pero requiere más cambios en el backend y es menos directo que desplegar un static site separado.

---

## 5. Qué deberías cambiar o comentar en el código para preparar producción

### Backend

- Comenta o ajusta cualquier `allow_origins` de desarrollo.
- Comenta la línea que usa `localhost:8000` en configuraciones de API internas si existe.
- Marca `UPLOAD_DIR` como variable de entorno.
- Si quieres guardar los archivos de forma persistente, agrega una nota en el código:
  - `# TODO: migrar almacenamiento de uploads a S3 / almacenamiento persistente`.

### Frontend

- Comenta la URL fija `http://localhost:8000` y reemplázala por `import.meta.env.VITE_API_URL`.
- Si existe proxy en `vite.config.js`, déjalo comentado o condicional para desarrollo.
- Asegúrate de que el cliente use `API_URL` dinámicamente.
- Añade un comentario en `.env.example` con la URL del backend de producción.

### Archivos útiles a preparar

- `backend/.env.example`
  - `DATABASE_URL=...`
  - `SECRET_KEY=...`
  - `UPLOAD_DIR=uploads`

- `frontend/.env.example`
  - `VITE_API_URL=https://<tu-backend>.onrender.com`

---

## 6. Recomendaciones finales para producción

1. **No confíes en `uploads/` como almacenamiento persistente** en Render.
2. **Usa variables de entorno** para backend y frontend.
3. **Configura CORS al origen exacto del frontend** si usas servicios separados.
4. **Usa `uvicorn main:app --host 0.0.0.0 --port $PORT`** en Render.
5. **No subas `venv/`, `node_modules/`, `dist/` ni `__pycache__/`** al repositorio.
6. **Haz pruebas en producción con DevTools** y revisa que la petición `/uploads/...` aparece en Network.

---

## 7. Resumen de la estructura actual relevante

- `backend/main.py` → servidor FastAPI.
- `backend/requirements.txt` → dependencias Python.
- `backend/app/` → lógica de rutas, CRUD, esquemas y utilidades.
- `backend/uploads/` → actualmente almacenamiento local de archivos.
- `frontend/package.json` → scripts y dependencias React.
- `frontend/vite.config.js` → configuración Vite.
- `frontend/src/api/axios.js` → cliente API.

---

## 8. Siguiente paso sugerido

1. Elige si quieres desplegar con:
   - `Static Site + Web Service` (recomendado), o
   - `solo Web Service` con backend que sirve frontend.
2. Cuando lo elijas, te doy el plan exacto para Render.
3. Luego creamos los comentarios en los archivos y los marcamos como preparación.

---

### Nota final
Este archivo no modifica nada en el proyecto. Es una guía completa para que sepas exactamente qué cambiar y cómo preparar el despliegue en Render.
