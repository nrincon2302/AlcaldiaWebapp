import os
import bcrypt
import sqlite3
from datetime import datetime

# ========== CONFIG ==========
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
DB_PATH = DB_URL.replace("sqlite:///", "")
print(f"🔗 Usando base de datos: {DB_PATH}")

# Valor permitido por el esquema Pydantic (evita el error)
VALID_ADMIN_PERM = os.getenv("ADMIN_ENTIDAD_PERM", "captura_reportes")

# ========== CREAR TABLAS SI NO EXISTEN ==========
def create_tables_if_needed():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # Tabla USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        role TEXT NOT NULL,
        entidad_perm TEXT,
        entidad_auditor INTEGER DEFAULT 0,
        entidad TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Tabla PLANS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_entidad TEXT NOT NULL,
        estado TEXT,
        owner_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_id) REFERENCES users(id)
    );
    """)

    # Tabla SEGUIMIENTO
    cur.execute("""
    CREATE TABLE IF NOT EXISTS seguimiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        indicador TEXT,
        observacion_informe_calidad TEXT,
        plan_id INTEGER,
        updated_by_id INTEGER,
        observacion_calidad TEXT,
        insumo_mejora TEXT,
        tipo_accion_mejora TEXT,
        accion_mejora_planteada TEXT,
        descripcion_actividades TEXT,
        evidencia_cumplimiento TEXT,
        fecha_inicio TEXT,
        fecha_final TEXT,
        seguimiento TEXT,
        enlace_entidad TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_id) REFERENCES plans(id)
    );
    """)

    con.commit()
    con.close()
    print("✅ Tablas creadas/verificadas correctamente.")


# ========== HASH PASSWORD ==========
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


# ========== SEED DATA ==========
def seed_data():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    now = datetime.utcnow().isoformat(sep=" ", timespec="seconds")

    # Admin
    cur.execute("SELECT id FROM users WHERE email = ?", ("admin@demo.com",))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO users (email, hashed_password, role, entidad_perm, entidad_auditor, entidad, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("admin@demo.com", hash_pw("admin123"), "admin", VALID_ADMIN_PERM, 0, "Administrador", now))
        print(f"✅ Usuario admin@demo.com creado (permiso: {VALID_ADMIN_PERM})")

    # Usuario demo
    cur.execute("SELECT id FROM users WHERE email = ?", ("usuario@demo.com",))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO users (email, hashed_password, role, entidad_perm, entidad_auditor, entidad, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("usuario@demo.com", hash_pw("usuario123"), "entidad", "captura_reportes", 0, "Alcaldía Demo", now))
        print("✅ Usuario usuario@demo.com creado")

    # Plan demo
    cur.execute("SELECT id FROM plans WHERE nombre_entidad = ?", ("Alcaldía Demo",))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO plans (nombre_entidad, estado, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, ("Alcaldía Demo", "En progreso", 2, now, now))
        print("✅ Plan de ejemplo creado")

    # Seguimiento demo
    cur.execute("SELECT id FROM seguimiento WHERE plan_id = 1")
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO seguimiento (plan_id, evidencia_cumplimiento, fecha_inicio, fecha_final, seguimiento, enlace_entidad, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (1, "Acta 001", "2025-10-01", "2025-10-05", "Inicio de actividades", "https://docs.demo/acta-001", now, now))
        print("✅ Seguimiento demo creado")

    con.commit()
    con.close()
    print("🎉 Seed completado correctamente.")


# ========== RUN ==========
if __name__ == "__main__":
    create_tables_if_needed()
    seed_data()
