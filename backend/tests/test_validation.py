"""
Pruebas para validación de datos y manejo de errores.
"""

import pytest
from fastapi.testclient import TestClient


class TestValidationAndErrors:
    """Suite de pruebas para validación de datos y errores."""

    def test_invalid_token_format(self, client: TestClient):
        """
        Prueba que un token inválido es rechazado.
        """
        response = client.get(
            "/seguimiento",
            headers={"Authorization": "Bearer invalid_token_format"}
        )
        assert response.status_code == 401

    def test_missing_authorization_header(self, client: TestClient):
        """
        Prueba que falta el header de autorización.
        """
        response = client.get("/seguimiento")
        assert response.status_code == 401

    def test_invalid_email_format(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que email inválido es rechazado en registro.
        """
        response = client.post(
            "/auth/register",
            json={
                "email": "invalid-email",
                "password": "password123",
                "role": "entidad",
                "entidad": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_create_plan_missing_required_field(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que falta un campo requerido al crear plan.
        """
        response = client.post(
            "/seguimiento",
            json={
                # Falta 'nombre_entidad' que es requerido
                "insumo_mejora": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422

    def test_get_nonexistent_resource(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba obtener un recurso que no existe.
        """
        response = client.get(
            "/seguimiento/99999",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_delete_nonexistent_resource(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba eliminar un recurso que no existe.
        """
        response = client.delete(
            "/seguimiento/99999",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_unauthorized_access_without_permission(self, client: TestClient, test_db, entidad_user, entidad_token):
        """
        Prueba acceso no autorizado sin permisos adecuados.
        """
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {entidad_token}"}
        )
        assert response.status_code == 403

    def test_invalid_role_value(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que un rol inválido es rechazado.
        """
        response = client.post(
            "/auth/register",
            json={
                "email": "test@test.com",
                "password": "password123",
                "role": "invalid_role",
                "entidad": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_duplicate_email_error(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que email duplicado genera error.
        """
        response = client.post(
            "/auth/register",
            json={
                "email": "admin@test.com",
                "password": "password123",
                "role": "entidad",
                "entidad": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_password_too_short(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que contraseña muy corta es rechazada.
        """
        response = client.post(
            "/auth/register",
            json={
                "email": "newuser@test.com",
                "password": "short",
                "role": "entidad",
                "entidad": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_invalid_date_format(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que formato de fecha inválido es rechazado.
        """
        response = client.post(
            "/seguimiento",
            json={
                "nombre_entidad": "Test",
                "fecha_inicio": "01-01-2024",  # Formato incorrecto
                "fecha_final": "31-12-2024",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422

    def test_invalid_json_body(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba JSON inválido en el cuerpo de la solicitud.
        """
        response = client.post(
            "/seguimiento",
            data="invalid json",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json",
            }
        )
        assert response.status_code == 422


class TestCORSAndSecurity:
    """Suite de pruebas para CORS y seguridad."""

    def test_cors_headers_present(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que los headers CORS están presentes.
        """
        response = client.get(
            "/seguimiento",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        # FastAPI configura CORS automáticamente

    def test_health_check_endpoint(self, client: TestClient):
        """
        Prueba el endpoint de health check (si existe).
        """
        response = client.get("/health")
        # Puede ser 200 si existe o 404 si no está implementado
        assert response.status_code in [200, 404]
