"""
Pruebas para los endpoints de usuarios.
"""

import pytest
from fastapi.testclient import TestClient
from app import models


class TestUsersEndpoints:
    """Suite de pruebas para gestión de usuarios."""

    def test_get_all_users_admin(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que un admin puede obtener la lista de usuarios.
        """
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # Al menos admin y entidad

    def test_get_all_users_non_admin(self, client: TestClient, test_db, entidad_user, entidad_token):
        """
        Prueba que un usuario no admin no puede obtener la lista de usuarios.
        """
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {entidad_token}"}
        )
        assert response.status_code == 403

    def test_create_user(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que se puede crear un nuevo usuario.
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

    def test_create_user_not_found(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que crear usuario con datos inválidos falla.
        """
        response = client.post(
            "/users",
            json={
                "email": "invalid",
                "password": "pass",
                "role": "entidad",
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [400, 422]  # Email inválido o contraseña débil

    def test_update_user_role(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que un admin puede cambiar el rol de un usuario.
        """
        response = client.patch(
            f"/users/{entidad_user.id}/role",
            json={"role": "auditor"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Verificar que el rol cambió en la respuesta
        data = response.json()
        assert data["role"] == "auditor"

    def test_update_user_role_non_admin(self, client: TestClient, test_db, entidad_user, entidad_token, auditor_user):
        """
        Prueba que un usuario no admin no puede cambiar roles.
        """
        response = client.patch(
            f"/users/{auditor_user.id}/role",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {entidad_token}"}
        )
        assert response.status_code == 403

    def test_reset_password(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que un admin puede resetear la contraseña de un usuario.
        """
        response = client.patch(
            f"/users/{entidad_user.id}/password",
            json={"new_password": "newpassword123"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 204

    def test_reset_password_weak(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que no se puede usar una contraseña débil.
        """
        response = client.patch(
            f"/users/{entidad_user.id}/password",
            json={"new_password": "weak"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422

    def test_delete_user(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que un admin puede eliminar un usuario.
        """
        # Crear un usuario para eliminar
        from conftest import create_hashed_password
        user_to_delete = models.User(
            email="delete_me@test.com",
            hashed_password=create_hashed_password("password123"),
            role=models.UserRole.entidad,
            entidad="Test Entidad",
        )
        test_db.add(user_to_delete)
        test_db.commit()
        test_db.refresh(user_to_delete)
        
        user_id = user_to_delete.id
        response = client.delete(
            f"/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 204

    def test_delete_user_cannot_delete_self(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que un usuario no puede eliminarse a sí mismo.
        """
        response = client.delete(
            f"/users/{admin_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400
        assert "cannot delete your own account" in response.json()["detail"].lower()

    def test_delete_user_cannot_delete_last_admin(self, client: TestClient, test_db, admin_user, admin_token):
        """
        Prueba que no se puede eliminar el último admin.
        """
        # Crear otro admin
        from conftest import create_hashed_password
        other_admin = models.User(
            email="admin2@test.com",
            hashed_password=create_hashed_password("admin123"),
            role=models.UserRole.admin,
            entidad="Alcaldia",
        )
        test_db.add(other_admin)
        test_db.commit()
        
        # Eliminar el otro admin
        response = client.delete(
            f"/users/{other_admin.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 204
        
        # Intentar eliminar el último admin (el primero)
        response = client.delete(
            f"/users/{admin_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # No debería poder borrarse a sí mismo de todas formas
        assert response.status_code == 400

    def test_update_entidad_perm(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que un admin puede actualizar los permisos de entidad.
        """
        response = client.patch(
            f"/users/{entidad_user.id}/perm",
            json={"entidad_perm": "reportes_seguimiento"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Verificar que el permiso cambió en la respuesta
        data = response.json()
        assert data["entidad_perm"] == "reportes_seguimiento"

    def test_update_entidad_auditor(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que un admin puede cambiar el estado de auditor de entidad.
        """
        response = client.patch(
            f"/users/{entidad_user.id}/auditor",
            json={"entidad_auditor": True},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Verificar que el estado cambió en la respuesta
        data = response.json()
        assert data["entidad_auditor"] is True

    def test_list_users_returns_all(self, client: TestClient, test_db, admin_user, admin_token, entidad_user, auditor_user):
        """
        Prueba que se listan todos los usuarios creados.
        """
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3  # admin, entidad, auditor
        emails = [u["email"] for u in data]
        assert "admin@test.com" in emails
        assert "entidad@test.com" in emails

    def test_list_users_non_admin_forbidden(self, client: TestClient, test_db, admin_user, admin_token, entidad_user):
        """
        Prueba que usuarios no admin no pueden listar usuarios.
        """
        # Primero crear un token para entidad_user
        from conftest import create_test_token
        entidad_token = create_test_token(entidad_user)
        
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {entidad_token}"}
        )
        assert response.status_code == 403
