# 🛠️ Scripts de Utilidad

Conjunto de herramientas y scripts para desarrollo, pruebas y optimización.

---

## 📁 Estructura

```
scripts/
├── database/                    # Scripts SQL y optimizaciones
│   ├── optimize_dashboard.sql   # Optimizaciones MySQL
│   ├── database_optimization.sql # Más optimizaciones
│   └── optimize_db.py           # Script Python para optimizar
│
└── testing/                     # Pruebas y mediciones
    ├── measure_dashboard.py     # Medir performance
    ├── measure_dashboard_optimized.py # Medición post-optimización
    └── test_pdf.js              # Pruebas de PDF
```

---

## 📊 Scripts de Base de Datos

### `optimize_dashboard.sql`

**Propósito**: Crear índices y optimizar queries del dashboard

**Contenido**:
- Índices en columnas frecuentemente buscadas
- Análisis de tablas
- Optimización de estadísticas

**Usar**:
```bash
mysql -u root -p railway < database/optimize_dashboard.sql
```

### `database_optimization.sql`

**Propósito**: Optimizaciones adicionales de performance

**Contenido**:
- Mejora de consultas frecuentes
- Análisis de índices existentes
- Recomendaciones de performance

**Usar**:
```bash
mysql -u root -p railway < database/database_optimization.sql
```

### `optimize_db.py`

**Propósito**: Script Python para analizar y reportar estado de BD

**Usar**:
```bash
python scripts/database/optimize_db.py
```

---

## 📈 Scripts de Testing

### `measure_dashboard.py`

**Propósito**: Medir performance del dashboard antes de optimizaciones

**Métricas**:
- Tiempo de respuesta de endpoints
- Número de requests
- Tamaño de respuestas

**Usar**:
```bash
python scripts/testing/measure_dashboard.py
```

**Ejemplo de output**:
```
Dashboard Performance Metrics
============================
Total Requests: 57
Total Size: 8.1 MB
Total Time: 4.92s
Average Response: 86.3ms
```

### `measure_dashboard_optimized.py`

**Propósito**: Medir performance DESPUÉS de optimizaciones

**Comparación**:
- Diferencia de tiempos
- Mejora de porcentaje
- Reducción de requests

**Usar**:
```bash
python scripts/testing/measure_dashboard_optimized.py
```

### `test_pdf.js`

**Propósito**: Pruebas de validación de archivos PDF

**Funcionalidades**:
- Validar estructura de PDF
- Detectar PDFs corruptos
- Verificar permisos de PDF

**Usar**:
```bash
node scripts/testing/test_pdf.js
```

---

## 🚀 Flujo de Optimización

### Paso 1: Baseline (Antes de optimizar)

```bash
# 1. Medir performance actual
python scripts/testing/measure_dashboard.py

# 2. Guardar resultados
# Output: baseline_metrics.json
```

### Paso 2: Aplicar Optimizaciones

```bash
# 1. Ejecutar scripts SQL
mysql -u root -p railway < scripts/database/optimize_dashboard.sql
mysql -u root -p railway < scripts/database/database_optimization.sql

# 2. Ejecutar script Python de análisis
python scripts/database/optimize_db.py
```

### Paso 3: Verificar Mejoras

```bash
# 1. Medir performance POST-optimización
python scripts/testing/measure_dashboard_optimized.py

# 2. Comparar resultados
# Output mostrará % de mejora
```

---

## 📋 Resultados Esperados

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Requests** | 57 | 42 | -26% |
| **Tamaño** | 8.1 MB | 5.2 MB | -36% |
| **Tiempo Total** | 4.92s | 2.15s | -56% |
| **Avg Response** | 86.3ms | 51.2ms | -41% |

---

## 🔍 Interpretar Resultados

### Si ves mejora > 30%

✅ Excelente. Las optimizaciones fueron efectivas.

```bash
# Considerar mantener todos los cambios
git add .
git commit -m "Performance optimizations: 40% improvement"
```

### Si ves mejora 10-30%

✅ Bueno. Algunas optimizaciones efectivas.

```bash
# Revisar qué cambios fueron más efectivos
# Considerar optimizaciones adicionales
```

### Si ves mejora < 10%

⚠️ Cambios menores.

```bash
# Revisar si los cambios valen la complejidad
# Considerar revertir algunos
```

---

## 🛠️ Mantenimiento Periódico

### Semanal

```bash
# Limpiar archivos temporales
rm -rf backend/__pycache__
rm -rf frontend/dist

# Verificar BD
python scripts/database/optimize_db.py
```

### Mensual

```bash
# Backup completo
mysqldump -u root -p railway > backup_$(date +%Y%m%d).sql

# Análisis de performance
python scripts/testing/measure_dashboard.py > metrics_$(date +%Y%m%d).json
```

### Trimestral

```bash
# Ejecutar optimizaciones preventivas
mysql -u root -p railway < scripts/database/optimize_dashboard.sql

# Medir nuevamente
python scripts/testing/measure_dashboard.py
```

---

## 📝 Agregar Nuevos Scripts

### Estructura

```bash
# Scripts Python
scripts/testing/mi_script.py

# Scripts SQL
scripts/database/mi_script.sql

# Scripts Node
scripts/testing/mi_script.js
```

### Ejemplo: Nuevo Script Python

```python
# scripts/testing/mi_script.py
#!/usr/bin/env python3

import json
from datetime import datetime

def main():
    """Descripción del script"""
    print("🚀 Ejecutando mi script...")
    
    # Lógica aquí
    resultado = {"estado": "ok", "timestamp": datetime.now().isoformat()}
    
    print(json.dumps(resultado, indent=2))
    
if __name__ == "__main__":
    main()
```

**Usar**:
```bash
python scripts/testing/mi_script.py
```

---

## 🔗 Referencias

- [MySQL Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Python Performance](https://docs.python.org/3/library/profile.html)
- [Frontend Performance](https://web.dev/performance/)

---

**Última actualización**: 27/04/2026
**Mantenedor**: Equipo de Desarrollo
