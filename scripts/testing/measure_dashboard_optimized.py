import time
import sys
import os
sys.path.append(os.path.dirname(__file__))

from backend.app.router.reportes import reporte_dashboard
from backend.core.database import get_db

def medir_dashboard():
    print("Midiendo rendimiento del dashboard optimizado...")

    # Simular diferentes roles para probar
    roles_prueba = [
        {'id': 1, 'roles': [{'es_admin': True}]},
        {'id': 2, 'roles': [{'es_funcionario_revision': True}]},
        {'id': 3, 'roles': [{'es_coordinador': True}]},
        {'id': 4, 'roles': [{'requiere_firma': True, 'es_coordinador': False, 'nombre': 'INSTRUCTOR_SEGUIMIENTO'}]},
    ]

    for i, user in enumerate(roles_prueba, 1):
        print(f"\n--- Prueba {i}: {user['roles'][0]} ---")

        start = time.time()
        db = next(get_db())
        try:
            result = reporte_dashboard(rol_forzado=None, db=db, current_user=user)
            end = time.time()
            tiempo = end - start
            print(f"Tiempo: {tiempo:.2f}s")
            print(f"Rol resultante: {result.get('rol', 'ERROR')}")
        except Exception as e:
            end = time.time()
            tiempo = end - start
            print(f"Tiempo: {tiempo:.2f}s - ERROR")
            print(f"Error: {e}")
        finally:
            db.close()

if __name__ == "__main__":
    medir_dashboard()