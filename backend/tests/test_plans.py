"""
Pruebas para los endpoints de planes de acción y seguimientos.
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from app import models


class TestPlansEndpoints:
    """Suite de pruebas para planes de acción."""

    def test_list_plans_empty(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba listar planes cuando la BD está vacía.
        """
        response = client.get(
            "/seguimiento",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_plans_with_data(self, client: TestClient, test_db, admin_user, admin_token, plan_action):
        """
        Prueba listar planes cuando hay datos.
        """
        response = client.get(
            "/seguimiento",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["nombre_entidad"] == "Secretaría de Educación"

    def test_list_plans_entidad_user_sees_own_plans(self, client: TestClient, test_db, entidad_user, entidad_token, plan_action):
        """
        Prueba que un usuario de entidad solo ve sus propios planes.
        """
        # Modificar el plan para que pertenezca a la entidad del usuario
        plan_action.nombre_entidad = entidad_user.entidad
        test_db.commit()
        
        response = client.get(
            "/seguimiento",
            headers={"Authorization": f"Bearer {entidad_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["nombre_entidad"] == entidad_user.entidad

    def test_create_plan_admin(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que un admin puede crear un plan.
        """
        response = client.post(
            "/seguimiento",
            json={
                "nombre_entidad": "Secretaría de Salud",
                "insumo_mejora": "Equipos médicos",
                "tipo_accion_mejora": "Preventiva",
                "accion_mejora_planteada": "Adquisición de equipos",
                "observacion_informe_calidad": "Se necesitan equipos",
                "descripcion_actividades": "Compra e instalación",
                "evidencia_cumplimiento": "Facturas y fotos",
                "fecha_inicio": "2024-01-01",
                "fecha_final": "2024-12-31",
                "estado": "Pendiente",
                "indicador": "Salud",
                "criterio": "Calidad",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nombre_entidad"] == "Secretaría de Salud"
        assert data["estado"] == "Pendiente"

    def test_create_plan_entidad_user(self, client: TestClient, test_db, entidad_user, entidad_token):
        """
        Prueba que un usuario de entidad puede crear un plan.
        """
        response = client.post(
            "/seguimiento",
            json={
                "nombre_entidad": entidad_user.entidad,
                "insumo_mejora": "Infraestructura",
                "tipo_accion_mejora": "Preventiva",
            },
            headers={"Authorization": f"Bearer {entidad_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["nombre_entidad"] == entidad_user.entidad

    def test_create_plan_non_authorized(self, client: TestClient, test_db, auditor_user, auditor_token):
        """
        Prueba que un auditor no puede crear un plan.
        """
        response = client.post(
            "/seguimiento",
            json={
                "nombre_entidad": "Test",
                "insumo_mejora": "Test",
            },
            headers={"Authorization": f"Bearer {auditor_token}"}
        )
        assert response.status_code == 403

    def test_get_plan_by_id(self, client: TestClient, test_db, admin_user, admin_token, plan_action):
        """
        Prueba obtener un plan por ID.
        """
        response = client.get(
            f"/seguimiento/{plan_action.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == plan_action.id
        assert data["nombre_entidad"] == "Secretaría de Educación"

    def test_get_plan_not_found(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba obtener un plan inexistente.
        """
        response = client.get(
            "/seguimiento/99999",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_delete_plan(self, client: TestClient, test_db, admin_user, admin_token, plan_action):
        """
        Prueba eliminar un plan.
        """
        plan_id = plan_action.id
        response = client.delete(
            f"/seguimiento/{plan_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200

    def test_search_plans_by_query(self, client: TestClient, test_db, admin_user, admin_token, plan_action):
        """
        Prueba buscar planes por nombre de entidad.
        """
        response = client.get(
            "/seguimiento?q=Secretaría",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert "Secretaría" in data[0]["nombre_entidad"]

    def test_list_plans_pagination(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba la paginación en la lista de planes.
        """
        # Crear varios planes
        for i in range(5):
            plan = models.PlanAccion(
                nombre_entidad=f"Entidad {i}",
                created_by=admin_user.id,
            )
            test_db.add(plan)
        test_db.commit()
        
        # Pedir con limit
        response = client.get(
            "/seguimiento?skip=0&limit=2",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_indicadores_usados(self, client: TestClient, test_db, admin_user, admin_token, plan_action, seguimiento):
        """
        Prueba obtener los indicadores ya usados.
        """
        response = client.get(
            "/seguimiento/indicadores_usados",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()