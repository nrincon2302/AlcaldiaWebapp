import os
import bcrypt
import psycopg

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL no definido.")

# Convertir dialecto de SQLAlchemy a psycopg si viene con '+psycopg'
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://","postgresql://",1)

# Valor permitido por el esquema Pydantic (evita el error)
VALID_ADMIN_PERM = os.getenv("ADMIN_ENTIDAD_PERM", "captura_reportes")

connect_kwargs = {"prepare_threshold": None}  # PgBouncer friendly

# ========== HASH PASSWORD ==========
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

# ========== CREAR TABLAS SI NO EXISTEN ==========
def create_tables_if_needed(cur):
    # Tabla USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        role TEXT NOT NULL,
        entidad_perm TEXT,
        entidad_auditor INTEGER DEFAULT 0,
        entidad TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """)

    # Tabla SEGUIMIENTO
    # cur.execute("""
    # CREATE TABLE IF NOT EXISTS seguimiento (
    #     id SERIAL PRIMARY KEY,
    #     indicador TEXT,
    #     observacion_informe_calidad TEXT,
    #     plan_id INTEGER REFERENCES plan_accion(id),
    #     updated_by_id INTEGER,
    #     observacion_calidad TEXT,
    #     insumo_mejora TEXT,
    #     tipo_accion_mejora TEXT,
    #     accion_mejora_planteada TEXT,
    #     descripcion_actividades TEXT,
    #     evidencia_cumplimiento TEXT,
    #     fecha_inicio TEXT,
    #     fecha_final TEXT,
    #     seguimiento TEXT,
    #     enlace_entidad TEXT,
    #     created_at TIMESTAMPTZ DEFAULT NOW(),
    #     updated_at TIMESTAMPTZ DEFAULT NOW()
    # );
    # """)
    # print("✅ Tablas creadas/verificadas correctamente.")

# ========== SEED DATA ==========
def seed_data(cur):
    # Admin
    cur.execute("SELECT id FROM users WHERE email = %s", ("admin@demo.com",))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO users (email, hashed_password, role, entidad_perm, entidad_auditor, entidad)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, ("admin@demo.com", hash_pw("admin123"), "admin", VALID_ADMIN_PERM, 0, "Administrador"))
        print(f"✅ Usuario admin@demo.com creado (permiso: {VALID_ADMIN_PERM})")

    # Usuario demo
    cur.execute("SELECT id FROM users WHERE email = %s", ("usuario@demo.com",))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO users (email, hashed_password, role, entidad_perm, entidad_auditor, entidad)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, ("usuario@demo.com", hash_pw("usuario123"), "entidad", "captura_reportes", bool(0), "Alcaldía Demo"))
        print("✅ Usuario usuario@demo.com creado")

# ========== RUN ==========
if __name__ == "__main__":
    with psycopg.connect(DATABASE_URL, **connect_kwargs) as conn:
        with conn.cursor() as cur:
            create_tables_if_needed(cur)
            seed_data(cur)
        conn.commit()
    print("🎉 Seed completado correctamente.")
