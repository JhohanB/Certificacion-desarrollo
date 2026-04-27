# 🎨 Frontend - Interfaz React + Vite

Aplicación web moderna construida con React 19, Vite y Ant Design.

---

## 📋 Contenidos

- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecutar](#ejecutar)
- [Estructura](#estructura)
- [Componentes](#componentes)
- [Optimizaciones](#optimizaciones)

---

## 💾 Instalación

### Requisitos Previos

- Node.js 18+
- npm o yarn

### Pasos

```bash
# 1. Navegar a carpeta frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env
cp .env.example .env

# 4. Editar .env con URL del backend
# VITE_API_URL=http://localhost:8000

# 5. Ejecutar
npm run dev
```

---

## ⚙️ Configuración

### Variables de Entorno (`.env`)

```env
# URL del Backend
VITE_API_URL=http://localhost:8000

# En producción:
# VITE_API_URL=https://api.tudominio.com
```

**Importante**: El prefijo `VITE_` es obligatorio para variables públicas en Vite.

---

## 🚀 Ejecutar

### Desarrollo

```bash
npm run dev

# Salida esperada:
# VITE v7.3.1  ready in 245 ms
# ➜  Local:   http://127.0.0.1:5173/
```

**Frontend disponible en**: `http://localhost:5173`

### Build Producción

```bash
npm run build

# Genera carpeta 'dist/' lista para deploy
# Tamaño: ~800KB gzip (optimizado)
```

### Vista Previa Build

```bash
npm run preview
# Simula la app compilada en http://localhost:4173
```

### Linting

```bash
npm run lint
# Verifica código con ESLint
```

---

## 📁 Estructura

```
frontend/
├── src/
│   ├── api/
│   │   └── axios.js             # Configuración HTTP
│   │
│   ├── components/              # Componentes reutilizables
│   │   └── Layout.jsx           # Layout general
│   │
│   ├── context/
│   │   └── AuthContext.jsx      # Estado autenticación (Context API)
│   │
│   ├── pages/                   # Componentes de página
│   │   ├── Inicio.jsx
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Solicitudes.jsx
│   │   ├── DetalleSolicitud.jsx
│   │   └── ...
│   │
│   ├── App.jsx                  # Componente principal
│   └── main.jsx                 # Punto entrada
│
├── package.json                 # Dependencias
├── vite.config.js              # Configuración Vite
└── .env.example                # Plantilla variables
```

---

## 📦 Dependencias Principales

```
react@19              # Framework UI
react-router@7.13.1   # Routing
vite@7.3.1            # Build tool
antd@6.3.2            # Componentes UI
axios                 # HTTP client
```

---

## 🌐 Despliegue

### Build para Producción

```bash
npm run build
```

### Servir Static Files (Nginx)

```nginx
server {
  listen 80;
  server_name tudominio.com;
  
  root /var/www/frontend/dist;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 🐛 Troubleshooting

### "Cannot find module 'vite'"

```bash
npm install
```

### "VITE_API_URL is undefined"

Verificar que `.env` existe y contiene la URL del backend.

---

**Versión**: 1.0.0
**Node**: 18+
**Última actualización**: 27/04/2026
