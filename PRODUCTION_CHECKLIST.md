# Checklist de producción

Este documento enumera los cambios y controles necesarios antes de pasar el sistema a producción.
Incluye ajustes de backend, frontend, variables de entorno y recomendaciones de despliegue.

---

## 1. Backend

### 1.1 Configuración de CORS
Archivo: `backend/main.py`

- Actualmente se permite solo:
  - `http://localhost:5173`
  - `http://localhost:3000`
  - `http://127.0.0.1:5173`

**Qué cambiar**:
- Reemplazar `allow_origins` por el dominio real de la app frontend en producción.
- No dejar `allow_origins=["*"]` si el backend es público.

**Por qué**:
- Restringe quién puede hacer peticiones desde el navegador.
- Evita que cualquier sitio externo use tu API con credenciales del usuario.

**Cómo**:
- Usar variables de entorno o configuración concreta.
- Ejemplo:
  ```python
  allow_origins=["https://app.miempresa.com"]
  ```

---

### 1.2 Variables secretas y environment
Archivo: `backend/core/config.py`

- `JWT_SECRET` tiene valor por defecto `clave_temporal_desarrollo`.
- `DATABASE_URL`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` usan valores locales por defecto.
- `BASE_URL` y `FRONTEND_URL` apuntan a `localhost`.
- `UPLOAD_DIR` está en `uploads/documentos`.

**Qué cambiar**:
- No usar valores por defecto en producción.
- Definir en `.env` o en variables de entorno del servidor:
  - `JWT_SECRET`
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `BASE_URL`
  - `FRONTEND_URL`
  - `UPLOAD_DIR`
  - `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SERVER`, `MAIL_PORT`, `MAIL_FROM`

**Por qué**:
- Evita secretos expuestos y creo una configuración reproducible.
- Asegura que el backend se conecte a la base de datos correcta en producción.
- Permite a los correos y links usar la URL real.

**Cómo**:
- Crear un archivo `backend/.env.production` o configurar variables de entorno en el host.
- No versionar secretos en Git.

---

### 1.3 JWT y seguridad
Archivo: `backend/core/security.py` + `backend/core/config.py`

- Usar `JWT_SECRET` fuerte y único.
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` debe ser razonable (ej. 60 o 120), no demasiado alto.

**Qué cambiar**:
- Generar un valor seguro para `JWT_SECRET`.
- Evitar usar el valor por defecto.

**Por qué**:
- Un secreto débil permite volver a cifrar y falsificar tokens.

---

### 1.4 Servir archivos estáticos en producción
Archivo: `backend/main.py`

- Hoy el backend sirve uploads con `@app.get('/uploads/{file_path:path}')`.

**Qué revisar**:
- En producción es preferible usar un servidor estático especializado o CDN.
- Si se mantiene en FastAPI, debe asegurarse de que los archivos sean accesibles solo con los permisos adecuados.

**Por qué**:
- Los servidores web (NGINX, Apache) manejan mejor archivos estáticos y reducen carga de FastAPI.
- Mejora rendimiento y seguridad.

---

### 1.5 Documentación / OpenAPI
Archivo: `backend/main.py`

- FastAPI genera `/docs` y `/openapi.json`.

**Qué considerar**:
- En producción, evalúa si quieres mantener estas rutas públicas.
- Si no, desactiva `docs_url`, `redoc_url` o protégelas.

**Por qué**:
- Minimiza exposición de API pública a usuarios no autorizados.

---

### 1.6 Base de datos y pool de conexiones
Archivo: `backend/core/database.py`

- Ya hay configuración de pool y `echo=False`.

**Qué revisar**:
- Ajustar `pool_size`, `max_overflow`, `pool_timeout` según la carga de producción.
- Verificar que `DATABASE_URL` use credenciales seguras.

**Por qué**:
- Una configuración de pool adecuada evita conexiones insuficientes o saturación.

---

### 1.7 Correo electrónico y links de frontend
Archivo: `backend/app/utils/email_service.py` y `backend/app/utils/email_templates.py`

- Usa `settings.FRONTEND_URL` para generar enlaces de corrección y login.

**Qué cambiar**:
- En producción, `FRONTEND_URL` debe ser la URL pública real.
- Verificar que los correos lleguen correctamente y que los enlaces apunten al frontend correcto.

**Por qué**:
- Los emails deben abrir en el sitio real y no en `localhost`.

---

## 2. Frontend

### 2.1 URL de la API
Archivo: `frontend/src/api/axios.js`

- Actualmente usa:
  ```js
  export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  ```

**Qué cambiar**:
- En producción establecer `VITE_API_URL=https://api.miempresa.com`.
- No dejar `localhost` como fallback en el build final.

**Por qué**:
- El frontend debe apuntar al backend de producción.
- Evita errores al desplegar y confusiones en el entorno.

---

### 2.2 Construcción para producción
Archivo: `frontend/package.json` y `frontend/vite.config.js`

**Qué revisar**:
- Usar `npm run build` para generar los archivos finales.
- Si el frontend se despliega en una subruta, configurar `base` en `vite.config.js`.

**Por qué**:
- Asegura que los assets se construyen correctamente.
- Evita rutas rotas en producción.

---

### 2.3 React StrictMode
Archivo: `frontend/src/main.jsx`

- `StrictMode` está habilitado.

**Qué saber**:
- En desarrollo causa doble ejecución de hooks `useEffect` para encontrar efectos secundarios.
- En producción no duplica.

**Acción**:
- No es obligatorio quitarlo, pero puedes removerlo si quieres evitar confusiones en desarrollo.

---

### 2.4 Variables de entorno del frontend

**Qué cambiar**:
- Usar `.env.production` o definir variables durante el build.
- Ejemplo:
  ```env
  VITE_API_URL=https://api.miempresa.com
  ```

**Por qué**:
- Las variables Vite se inyectan en build.
- Evita que la app de producción use configuraciones de desarrollo.

---

## 3. Seguridad adicional

### 3.1 HTTPS

- El backend y el frontend deben exponerse solo sobre HTTPS.
- Si existe un proxy inverso, configurar TLS ahí.

**Por qué**:
- Protege tokens, credenciales y datos sensibles en tránsito.

---

### 3.2 Uploads y almacenamiento

- `UPLOAD_DIR` es local.
- En producción considera usar almacenamiento conectado/gestión externa o volumen persistente.

**Por qué**:
- Si el servidor se reinicia, los archivos deben persistir.
- Almacenamiento dedicado ofrece mayor seguridad y escalabilidad.

---

## 4. Entorno y despliegue

### 4.1 No versionar secretos

- No guardar `.env` con credenciales en Git.
- Usar secretos del proveedor de hosting o contenedores.

### 4.2 Monitoreo y salud

- El backend ya tiene `/health`.
- Comprueba que funciona con el entorno real.

### 4.3 Logs

- El backend imprime info en consola.
- En producción maneja logs con rotación o un sistema centralizado.

---

## 5. Puntos específicos a revisar antes del deploy

### Backend
- `backend/main.py`: `allow_origins`.
- `backend/core/config.py`: valores de DB, JWT, `BASE_URL`, `FRONTEND_URL`, email, uploads.
- `backend/core/database.py`: pool y `DATABASE_URL` seguro.
- `backend/main.py`: posible control de docs OpenAPI.
- `backend/app/router`: verificar rutas de archivos subidos y permisos.

### Frontend
- `frontend/src/api/axios.js`: `VITE_API_URL` debe usar la URL real.
- `frontend/vite.config.js`: configurar `base` si se usa subruta.
- `frontend/package.json`: usar `npm run build`.
- `frontend/src/main.jsx`: `StrictMode` es opcional, no imprescindible.

### Build / deploy
- Generar build de frontend con `npm run build`.
- Asegurarse de que `backend` use variables de entorno correctas.
- Validar que `JWT_SECRET` y SMTP no usen valores de desarrollo.

---

## 6. Recomendación final

Antes de producción, crea un archivo de entorno de producción seguro y revisa los dominios de CORS y API. Así tendrás un control claro y reducirás riesgos de seguridad y errores de configuración.
