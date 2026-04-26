import time
import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.router.reportes import reporte_dashboard
from core.database import get_db

start = time.time()
db = next(get_db())
# Simular current_user para admin
current_user = {'id': 1, 'roles': [{'es_admin': True}]}
result = reporte_dashboard(rol_forzado=None, db=db, current_user=current_user)
end = time.time()
print(f"Tiempo dashboard: {end - start:.2f}s")
print("Resultado:", result)