# 🧩 Plan de Acción — Backend (FastAPI + JWT + SQLAlchemy + Docker + Cloud Run)

API REST para **Planes**, **Seguimientos** y **Usuarios** con **roles** y **permisos por entidad**.  
**Docs PROD**: https://fastapi-back-600959037813.us-east1.run.app/docs

---

## 🧭 Flujo real del sistema (para nuevos devs)

### Captura (Encuestas)
- **NO pasa por este backend**
- La captura se hace en encuestas externas (el frontend solo muestra links)

### Reportes (Shiny)
- **NO pasa por este backend**
- Los reportes se muestran en Shiny (embebido desde el frontend)

### Seguimiento (Planes + Seguimientos)
- **SÍ es responsabilidad de este backend**
- Todo el CRUD y reglas de acceso viven en `/seguimiento`

---

## 🧠 Stack
- FastAPI (Uvicorn)
- SQLAlchemy ORM + Pydantic
- OAuth2 Password + JWT (HS256)
- SQLite (dev) / PostgreSQL (prod)
- Docker / Google Cloud Run
- **Neon (Serverless Postgres) — recomendado para prod**

---

## 👥 Roles y permisos

### Roles
- **admin**: acceso total a usuarios, planes y seguimientos.
- **auditor**: puede **ver** planes/seguimientos de sus entidades asignadas y **editar** `observacion_calidad` cuando tenga el permiso correspondiente.
- **usuario**: crea/edita **sus** planes y seguimientos; **no** puede editar `observacion_calidad`.

### Permisos por entidad (dos permisos diferentes)
Cada **entidad** puede asignar a un usuario **dos permisos** independientes:
- `perm_seguimiento` — puede **crear/editar** registros de seguimiento en esa entidad.
- `perm_calidad` — puede **editar** el campo **`observacion_calidad`** (rol auditor típicamente).

> Un mismo usuario puede tener distintos permisos **por entidad**.  
> Ej.: En *Entidad A* sólo `perm_calidad=true`; en *Entidad B* `perm_seguimiento=true` y `perm_calidad=false`.

---

## 📂 Estructura del repositorio
```
.
├─ app/
│  ├─ main.py            # Inicializa FastAPI, CORS y routers
│  ├─ auth.py            # JWT y dependencias de autenticación
│  ├─ database.py        # Engine, Session y Base
│  ├─ models.py          # Modelos SQLAlchemy
│  ├─ schemas.py         # Esquemas Pydantic
│  └─ routers/
│     ├─ plans.py        # /seguimiento (planes + seguimientos)
│     ├─ users.py        # Usuarios, roles y permisos
│     └─ files.py
├─ tools/
│  ├─ seed.py            # seed SQLite (crea tablas helper si faltan)
│  └─ seed_neon.py       # seed Neon (psycopg3) + crea tablas helper si faltan
├─ Dockerfile
├─ docker-compose.yml    # (opcional) API + Postgres
├─ requirements.txt
└─ .env
```

---

## ✅ Requisitos
- Python 3.11+
- (Opcional) Docker 24+
- (Prod) gcloud CLI

---

## 🚀 Instalación local

1) Clonar e instalar
```bash
git clone https://github.com/nedo8680/plan-accion-backend.git
cd plan-accion-backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2) Variables de entorno (`.env`)
```env
JWT_SECRET=tu-secreto-ultra
JWT_EXPIRE_HOURS=8
DATABASE_URL=sqlite:///./app.db
CORS_ORIGINS=http://localhost:5173,https://<tu-front-netlify>.netlify.app
LOG_LEVEL=info
```

3) Levantar API
```bash
uvicorn app.main:app --reload
```
- Swagger: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`

---

## 🧩 Modelo de datos

### users
- `id` (PK)
- `email` (UNIQUE)
- `hashed_password`
- `role` (`admin` | `auditor` | `usuario`)
- `created_at`, `updated_at`

### entidad
- `id` (PK)
- `nombre` (UNIQUE)
- `created_at`, `updated_at`

### user_entidad_perm (permisos por entidad)
- `id` (PK)
- `user_id` (FK → users.id)
- `entidad_id` (FK → entidad.id)
- `perm_seguimiento` (BOOL, default false)
- `perm_calidad` (BOOL, default false)
- `created_at`, `updated_at`
> Índice único sugerido: `(user_id, entidad_id)`.

### plans
- `id` (PK)
- `entidad_id` (FK → entidad.id)
- `nombre_entidad`
- `objetivo`
- `responsable`
- `estado` (`Borrador` | `En progreso` | `Cerrado`, …)
- `owner_id` (FK → users.id)
- `created_at`, `updated_at`

### seguimiento
- `id` (PK)
- `plan_id` (FK → plans.id)
- `evidencia_cumplimiento`
- `fecha_inicio`, `fecha_final`
- `seguimiento` (texto)
- `enlace_entidad`
- `observacion_calidad`
- `created_at`, `updated_at`

**Relaciones**
- User (1)—(N) Plans (owner)
- Plan (1)—(N) Seguimientos
- **User (N)—(N) Entidad** vía `user_entidad_perm` (con dos permisos por entidad)

---

## 🔐 Reglas de autorización (resumen)
- **usuario**
  - CRUD de **sus** planes y seguimientos.
  - **No** puede editar `observacion_calidad`.
- **auditor**
  - **Read** sobre planes/seguimientos de **entidades** en las que tenga asignación.
  - Puede **editar `observacion_calidad`** cuando `perm_calidad=true`.
  - Opcional: si `perm_seguimiento=true`, puede crear/editar seguimiento en esa entidad.
- **admin**
  - Full access.

> Al crear/editar un seguimiento o la `observacion_calidad`, validar:  
> `exists user_entidad_perm where user_id = me and entidad_id = plan.entidad_id and (perm_seguimiento or perm_calidad según el caso)`

---

## 🔗 Endpoints (Swagger PROD)

### auth
- **POST** `/auth/token` — Login  
- **GET** `/auth/me` — Me

### users
- **GET** `/users` — Listar usuarios  
- **POST** `/users` — Crear usuario  
- **PATCH** `/users/{user_id}/password` — Resetear contraseña  
- **DELETE** `/users/{user_id}` — Eliminar usuario  
- **POST** `/users/{user_id}/role` — Cambiar rol (`admin`/`auditor`/`usuario`)  
- **PATCH** `/users/{user_id}/perm` — Permisos globales (si existieran flags globales)  
- **PATCH** `/users/{user_id}/entidad_perm` — **Asignar permisos por entidad**  

### seguimiento (Planes + Seguimientos)
- **GET** `/seguimiento` — Listar planes  
- **POST** `/seguimiento` — Crear plan  
- **GET** `/seguimiento/{plan_id}` — Obtener plan  
- **PUT** `/seguimiento/{plan_id}` — Actualizar plan  
- **DELETE** `/seguimiento/{plan_id}` — Eliminar plan  
- **POST** `/seguimiento/{plan_id}/enviar_revision` — Enviar revisión  
- **POST** `/seguimiento/{plan_id}/observacion` — **Editar `observacion_calidad`** *(requiere `auditor` con `perm_calidad=true`)*  
- **POST** `/seguimiento/{plan_id}/estado` — Cambiar estado  
- **GET** `/seguimiento/{plan_id}/seguimiento` — Listar seguimientos  
- **POST** `/seguimiento/{plan_id}/seguimiento` — Crear seguimiento *(según permisos)*  
- **PUT** `/seguimiento/{plan_id}/seguimiento/{seg_id}` — Actualizar seguimiento  
- **DELETE** `/seguimiento/{plan_id}/seguimiento/{seg_id}` — Eliminar seguimiento

---

## 🌱 Seeds (pollute)
- **SQLite**: `python tools/seed.py`
- **Neon (psycopg3)**:
  ```bash
  pip install psycopg[binary]
  DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require" python tools/seed_neon.py
  ```

---

## 🐳 Docker (local)
```bash
docker build -t plan-backend .
docker run -d --name plan-backend -p 8000:8000 --env-file .env plan-backend
# http://localhost:8000/docs
```

---

## ☁️ Cloud Run — **Deploy con `--source` y servicio `fastapi-back` (recomendado)**

> Este flujo NO requiere construir/pushear imagen manualmente. Cloud Build crea la imagen desde el código fuente.

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>

gcloud run deploy fastapi-back   --source .   --region=us-east1   --allow-unauthenticated   --set-env-vars=JWT_SECRET=<SECRET>,JWT_EXPIRE_HOURS=8,DATABASE_URL=postgresql+psycopg://<USER>:<PASS>@<HOST>/<DB>?sslmode=require,CORS_ORIGINS=https://<tu-front-netlify>.netlify.app
```

- Cloud Build detecta **Python** (buildpacks) y genera el contenedor automáticamente.
- La app debe escuchar en el puerto `$PORT` que Cloud Run inyecta (los buildpacks lo configuran).
- URL típica tras deploy: **https://fastapi-back-<PROJECT_NUMBER>.us-east1.run.app**

### Alternativa (opcional) — Deploy por imagen
```bash
gcloud builds submit --tag us-east1-docker.pkg.dev/<PROJECT_ID>/backend-repo/fastapi-back:latest
gcloud run deploy fastapi-back   --image=us-east1-docker.pkg.dev/<PROJECT_ID>/backend-repo/fastapi-back:latest   --region=us-east1   --allow-unauthenticated   --set-env-vars=JWT_SECRET=<SECRET>,JWT_EXPIRE_HOURS=8,DATABASE_URL=postgresql+psycopg://<USER>:<PASS>@<HOST>/<DB>?sslmode=require,CORS_ORIGINS=https://<tu-front-netlify>.netlify.app
```

---

## 🟢 Usar **Neon** (Serverless Postgres) en producción

**Por qué Neon**  
- Escala a cero y pool de conexiones vía **PgBouncer**.  
- SSL/TLS obligatorio — usa `?sslmode=require`.  
- Ideal para **Cloud Run**.

**Pasos**  
1. Crea proyecto y DB en https://console.neon.tech/  
2. Usa la cadena **pooled** para Cloud Run:  
   `postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require`  
3. Configura `DATABASE_URL` en Cloud Run (Variables & Secrets).

**SQLAlchemy (recomendado con PgBouncer)**  
```python
from sqlalchemy import create_engine

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=0,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args={
        "sslmode": "require",
        "prepare_threshold": None  # PgBouncer (transaction pooling)
    },
)
```

---

## 🔒 Buenas prácticas
- No commitear `.env`
- CORS sólo con orígenes esperados
- Rotar `JWT_SECRET`; expiración corta
- HTTPS (Cloud Run)
- `--min-instances=1` si evitas cold start

---

## 🧪 cURL
```bash
# Login
curl -X POST https://fastapi-back-600959037813.us-east1.run.app/auth/token   -H "Content-Type: application/x-www-form-urlencoded"   -d "username=admin@demo.com&password=admin123"

# Asignar permisos por entidad (ejemplo)
curl -X PATCH https://fastapi-back-600959037813.us-east1.run.app/users/3/entidad_perm   -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json"   -d '{"entidad_id":1,"perm_seguimiento":false,"perm_calidad":true}'
```

---
