import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response 
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS as CORS_ORIGINS_DEFAULT
from app.database import Base, engine, SessionLocal
from sqlalchemy import text
from app.auth import router as auth_router
from app.routers.plans import router as planes_router
from app.routers.users import router as users_router
from app.routers.files import router as files_router
from app.routers.reports import router as reports_router
from app.routers.pqrds import router as pqrds_router
from app.routers.habilidades import router as habilidades_router

from app.deps import seed_users


# ──────────────────────────────────────────────────────────────────────────────
# CORS: toma de env o de config
cors_from_env = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

DEFAULT_ALLOWED = [
    "http://localhost:5173",
    "https://lively-begonia-ccf65e.netlify.app", 
]
ALLOW_ORIGINS = cors_from_env or CORS_ORIGINS_DEFAULT or DEFAULT_ALLOWED  

SEED_ON_START = os.getenv("SEED_ON_START", "false").lower() == "true"
# ──────────────────────────────────────────────────────────────────────────────

def _ensure_updated_by_column():
    """Añade updated_by_id si falta (soporta SQLite y PostgreSQL); no rompe si falla."""
    try:
        with engine.begin() as conn:
            dialect = conn.engine.dialect.name

            if dialect == "sqlite":
                # Detecta si existe 'seguimiento' o 'seguimientos'
                rows = conn.exec_driver_sql(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name IN ('seguimiento','seguimientos')"
                ).fetchall()
                if not rows:
                    return
                table = rows[0][0]
                cols = conn.exec_driver_sql(f"PRAGMA table_info({table});").fetchall()
                names = {c[1] for c in cols}
                if "updated_by_id" not in names:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN updated_by_id INTEGER;")

            elif dialect in ("postgresql", "postgres"):
                # ¿Cuál tabla existe?
                table = None
                t1 = conn.execute(text("SELECT to_regclass('public.seguimiento')")).scalar()
                t2 = conn.execute(text("SELECT to_regclass('public.seguimientos')")).scalar()
                if t1: table = "seguimiento"
                elif t2: table = "seguimientos"
                else:
                    return

                cols = conn.execute(text("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=:t
                """), {"t": table}).fetchall()
                names = {r[0] for r in cols}
                if "updated_by_id" not in names:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN updated_by_id INTEGER'))

            else:
                print(f"[WARN] _ensure_updated_by_column: motor {dialect} no soportado; omito parche")

    except Exception as e:
        # Nunca tumbes el servicio por un parche de conveniencia
        print(f"[WARN] _ensure_updated_by_column falló: {e}")

def _relax_user_fk_constraints():
    """
    Ajusta las FKs que apuntan a users para permitir ON DELETE SET NULL en PostgreSQL.
    Evita que el borrado de un usuario falle por plan_accion.created_by o seguimiento.updated_by_id.
    """
    try:
        with engine.begin() as conn:
            dialect = conn.engine.dialect.name
            if dialect not in ("postgresql", "postgres"):
                return

            # Evitar fallos si las tablas aún no existen (incluye versión plural heredada)
            plan_table = "plan_accion" if conn.execute(text("SELECT to_regclass('public.plan_accion')")).scalar() else None
            seg_table = None
            t1 = conn.execute(text("SELECT to_regclass('public.seguimiento')")).scalar()
            t2 = conn.execute(text("SELECT to_regclass('public.seguimientos')")).scalar()
            if t1:
                seg_table = "seguimiento"
            elif t2:
                seg_table = "seguimientos"

            if plan_table:
                conn.execute(text(f'ALTER TABLE "{plan_table}" ALTER COLUMN created_by DROP NOT NULL'))
                conn.execute(text(f"""
                    DO $$ DECLARE constr_name text;
                    BEGIN
                        SELECT tc.constraint_name INTO constr_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.constraint_column_usage ccu
                          ON tc.constraint_name = ccu.constraint_name
                        WHERE tc.table_schema='public'
                          AND tc.table_name='{plan_table}'
                          AND ccu.column_name='created_by'
                          AND tc.constraint_type='FOREIGN KEY'
                        LIMIT 1;
                        IF constr_name IS NOT NULL THEN
                            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '{plan_table}', constr_name);
                        END IF;
                    END$$;
                """))
                conn.execute(text(f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM information_schema.table_constraints
                            WHERE table_schema='public'
                              AND table_name='{plan_table}'
                              AND constraint_name='plan_accion_created_by_fkey'
                        ) THEN
                            ALTER TABLE "{plan_table}"
                            ADD CONSTRAINT plan_accion_created_by_fkey
                            FOREIGN KEY (created_by) REFERENCES "users"(id) ON DELETE SET NULL;
                        END IF;
                    END$$;
                """))

            if seg_table:
                conn.execute(text(f'ALTER TABLE "{seg_table}" ALTER COLUMN updated_by_id DROP NOT NULL'))
                conn.execute(text(f"""
                    DO $$ DECLARE constr_name text;
                    BEGIN
                        SELECT tc.constraint_name INTO constr_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.constraint_column_usage ccu
                          ON tc.constraint_name = ccu.constraint_name
                        WHERE tc.table_schema='public'
                          AND tc.table_name='{seg_table}'
                          AND ccu.column_name='updated_by_id'
                          AND tc.constraint_type='FOREIGN KEY'
                        LIMIT 1;
                        IF constr_name IS NOT NULL THEN
                            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '{seg_table}', constr_name);
                        END IF;
                    END$$;
                """))
                conn.execute(text(f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM information_schema.table_constraints
                            WHERE table_schema='public'
                              AND table_name='{seg_table}'
                              AND constraint_name='seguimiento_updated_by_id_fkey'
                        ) THEN
                            ALTER TABLE "{seg_table}"
                            ADD CONSTRAINT seguimiento_updated_by_id_fkey
                            FOREIGN KEY (updated_by_id) REFERENCES "users"(id) ON DELETE SET NULL;
                        END IF;
                    END$$;
                """))
    except Exception as e:
        print(f"[WARN] _relax_user_fk_constraints falló: {e}")

def _ensure_entidad_auditor_column():
    """Añade users.entidad_auditor si falta (SQLite y PostgreSQL)."""
    try:
        with engine.begin() as conn:
            dialect = conn.engine.dialect.name
            if dialect == "sqlite":
                rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
                names = {r[1] for r in rows}
                if "entidad_auditor" not in names:
                    conn.execute(text("ALTER TABLE users ADD COLUMN entidad_auditor BOOLEAN DEFAULT 0"))
                    conn.execute(text("""
                        UPDATE users
                        SET entidad_auditor = 0
                        WHERE entidad_auditor IS NULL
                    """))
            else:
                res = conn.execute(text("""
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'entidad_auditor'
                """)).first()
                if not res:
                    conn.execute(text('ALTER TABLE "users" ADD COLUMN entidad_auditor BOOLEAN DEFAULT FALSE'))
                    conn.execute(text("""
                        UPDATE "users"
                        SET entidad_auditor = FALSE
                        WHERE entidad_auditor IS NULL
                    """))
    except Exception as e:
        print(f"[WARN] _ensure_entidad_auditor_column falló: {e}")

def _normalize_legacy_roles():
    """Normaliza roles legacy en la tabla users."""
    try:
        with engine.begin() as conn:
            dialect = conn.engine.dialect.name
            if dialect == "sqlite":
                conn.execute(text("""
                    UPDATE users
                    SET role = 'entidad',
                        entidad_auditor = 1
                    WHERE role = 'entidad_evaluador'
                """))
            else:
                conn.execute(text("""
                    UPDATE "users"
                    SET role = 'entidad',
                        entidad_auditor = TRUE
                    WHERE role = 'entidad_evaluador'
                """))
    except Exception as e:
        print(f"[WARN] _normalize_legacy_roles falló: {e}")
            
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_updated_by_column() 
    _relax_user_fk_constraints()
    _ensure_entidad_auditor_column()
    _normalize_legacy_roles()
    if SEED_ON_START:
        with SessionLocal() as db:
            seed_users(db)
    yield

app = FastAPI(
    title="Plan de Seguimiento API",
    version="1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,          # si no usas cookies, puedes poner False
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")  
async def add_cors_on_redirects(request: Request, call_next):
    resp: Response = await call_next(request)
    if resp.status_code in (301, 302, 307, 308):
        origin = request.headers.get("origin")
        if origin and origin in ALLOW_ORIGINS:
            resp.headers.setdefault("Access-Control-Allow-Origin", origin)
            resp.headers.setdefault("Vary", "Origin")
            resp.headers.setdefault("Access-Control-Allow-Credentials", "true")
    return resp

@app.on_event("startup")
def patch_db_on_startup():
    with engine.begin() as conn:
        dialect = conn.engine.dialect.name

        # -------- users.entidad_perm --------
        has_col = False
        if dialect == "sqlite":
            rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            # en PRAGMA table_info: row[1] => nombre de columna
            has_col = any(r[1] == "entidad_perm" for r in rows)
            if not has_col:
                conn.execute(text("ALTER TABLE users ADD COLUMN entidad_perm VARCHAR(32)"))
                # Inicializa a 'captura_reportes' a las entidades que no tengan valor
                conn.execute(text("""
                    UPDATE users
                    SET entidad_perm = 'captura_reportes'
                    WHERE role = 'entidad' AND (entidad_perm IS NULL OR entidad_perm = '')
                """))
            _ensure_entidad_auditor_column()
            _normalize_legacy_roles()
        else:
            # Postgres / otros
            res = conn.execute(text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'entidad_perm'
            """)).first()
            has_col = bool(res)
            if not has_col:
                conn.execute(text('ALTER TABLE "users" ADD COLUMN entidad_perm VARCHAR(32)'))
                conn.execute(text("""
                    UPDATE "users"
                    SET entidad_perm = 'captura_reportes'
                    WHERE role = 'entidad' AND entidad_perm IS NULL
                """))
            _ensure_entidad_auditor_column()
            _normalize_legacy_roles()
# ──────────────────────────────────────────────────────────────────────

# Routers
app.include_router(auth_router)        # /auth/token, /auth/me
app.include_router(planes_router)      # /seguimiento/*
app.include_router(users_router)       # /users/* (admin only)
app.include_router(files_router)   # /files/*
app.include_router(reports_router)     # /reports/*
app.include_router(pqrds_router)
app.include_router(habilidades_router)


@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/healthz")
def healthz():
    return {"ok": True}

# ───────── Archivos estáticos para evidencias (PDF/DOC/DOCX) ─────────
# Sirve URLs del tipo: /uploads/evidence/<archivo>
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
