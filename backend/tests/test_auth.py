"""
Pruebas para los endpoints de autenticación.
"""

import pytest
from fastapi.testclient import TestClient


class TestAuth:
    """Suite de pruebas para autenticación."""

    def test_login_success_admin(self, client: TestClient, test_db, admin_user):
        """
        Prueba que el login con credenciales válidas retorna un token.
        """
        response = client.post(
            "/auth/token",
            data={
                "username": "admin@test.com",
                "password": "admin123",
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_success_entidad(self, client: TestClient, test_db, entidad_user):
        """
        Prueba que el login de un usuario de entidad funciona.
        """
        response = client.post(
            "/auth/token",
            data={
                "username": "entidad@test.com",
                "password": "entidad123",
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_login_invalid_email(self, client: TestClient):
        """
        Prueba que el login con email inválido falla.
        """
        response = client.post(
            "/auth/token",
            data={
                "username": "nonexistent@test.com",
                "password": "password123",
            }
        )
        assert response.status_code == 400
        assert "inválidas" in response.json()["detail"].lower()

    def test_login_invalid_password(self, client: TestClient, test_db, admin_user):
        """
        Prueba que el login con contraseña incorrecta falla.
        """
        response = client.post(
            "/auth/token",
            data={
                "username": "admin@test.com",
                "password": "wrongpassword",
            }
        )
        assert response.status_code == 400
        assert "inválidas" in response.json()["detail"].lower()

    def test_me_endpoint(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que el endpoint /auth/me retorna los datos del usuario.
        """
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "admin"

    def test_me_endpoint_invalid_token(self, client: TestClient):
        """
        Prueba que el endpoint /auth/me falla sin un token válido.
        """
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_me_endpoint_no_token(self, client: TestClient):
        """
        Prueba que el endpoint /auth/me falla sin token.
        """
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_create_user_as_admin(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que un admin puede crear un nuevo usuario (endpoint /users).
        """
        response = client.post(
            "/users",
            json={
                "email": "newuser@test.com",
                "password": "newpassword123",
                "role": "entidad",
                "entidad": "Nueva Entidad",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newuser@test.com"
        assert data["role"] == "entidad"

    def test_create_user_duplicate_email(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que no se puede registrar un email duplicado.
        """
        response = client.post(
            "/users",
            json={
                "email": "admin@test.com",
                "password": "password123",
                "role": "entidad",
                "entidad": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400

    def test_create_user_weak_password(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que no se puede registrar con contraseña débil.
        """
        response = client.post(
            "/users",
            json={
                "email": "weakpass@test.com",
                "password": "weak",
                "role": "entidad",
                "entidad": "Test",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422
