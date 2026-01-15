# tools/seed_neon.py — Neon (psycopg3): crea tablas helper (si faltan) + datos demo.
# Requiere: pip install psycopg[binary]
# Usa: DATABASE_URL="postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require" python tools/seed_neon.py

import os, datetime as dt, psycopg

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL no definido.")

# Convertir dialecto de SQLAlchemy a psycopg si viene con '+psycopg'
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://","postgresql://",1)

connect_kwargs = {"prepare_threshold": None}  # PgBouncer friendly

with psycopg.connect(DATABASE_URL, **connect_kwargs) as conn:
    with conn.cursor() as cur:
        # Tablas helper (idempotentes)
        cur.execute("""CREATE TABLE IF NOT EXISTS entidad (
            id SERIAL PRIMARY KEY,
            nombre TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS user_entidad_perm (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            entidad_id INTEGER NOT NULL,
            perm_seguimiento BOOLEAN DEFAULT FALSE,
            perm_calidad BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ,
            UNIQUE(user_id, entidad_id)
        )""")
        # Usuarios demo (reemplaza hashes por bcrypt reales según tu app)
        cur.execute("""INSERT INTO users (email, hashed_password, role, created_at, updated_at)
                       VALUES ('admin@demo.com', '$2b$12$REEMPLAZA_HASH_ADMIN', 'admin', now(), now())
                       ON CONFLICT (email) DO NOTHING""")
        cur.execute("""INSERT INTO users (email, hashed_password, role, created_at, updated_at)
                       VALUES ('auditor@demo.com', '$2b$12$REEMPLAZA_HASH_AUD', 'auditor', now(), now())
                       ON CONFLICT (email) DO NOTHING""")
        cur.execute("""INSERT INTO users (email, hashed_password, role, created_at, updated_at)
                       VALUES ('usuario@demo.com', '$2b$12$REEMPLAZA_HASH_USER', 'usuario', now(), now())
                       ON CONFLICT (email) DO NOTHING""")
        # Entidades
        cur.execute("""INSERT INTO entidad (id, nombre, created_at, updated_at)
                       VALUES (1,'Alcaldía Demo', now(), now())
                       ON CONFLICT DO NOTHING""")
        cur.execute("""INSERT INTO entidad (id, nombre, created_at, updated_at)
                       VALUES (2,'Secretaría Demo', now(), now())
                       ON CONFLICT DO NOTHING""")
        # Permisos por entidad: auditor con dos permisos diferentes según entidad
        cur.execute("""INSERT INTO user_entidad_perm (user_id, entidad_id, perm_seguimiento, perm_calidad, created_at, updated_at)
                       VALUES ((SELECT id FROM users WHERE email='auditor@demo.com'), 1, FALSE, TRUE, now(), now())
                       ON CONFLICT (user_id, entidad_id) DO NOTHING""")
        cur.execute("""INSERT INTO user_entidad_perm (user_id, entidad_id, perm_seguimiento, perm_calidad, created_at, updated_at)
                       VALUES ((SELECT id FROM users WHERE email='auditor@demo.com'), 2, TRUE, FALSE, now(), now())
                       ON CONFLICT (user_id, entidad_id) DO NOTHING""")
        # Plan + seguimiento demo (ligado a entidad 1)
        cur.execute("""INSERT INTO plans (entidad_id, nombre_entidad, objetivo, responsable, estado, owner_id, created_at, updated_at)
                       SELECT 1, 'Alcaldía Demo', 'Mejorar indicador X', 'María Pérez', 'En progreso',
                              (SELECT id FROM users WHERE email='usuario@demo.com' LIMIT 1),
                              now(), now()
                       WHERE NOT EXISTS (SELECT 1 FROM plans WHERE nombre_entidad='Alcaldía Demo' AND objetivo='Mejorar indicador X')""")
        cur.execute("""INSERT INTO seguimiento (plan_id, evidencia_cumplimiento, fecha_inicio, fecha_final, seguimiento, enlace_entidad, created_at, updated_at)
                       SELECT id, 'Acta 001', '2025-10-01', '2025-10-05', 'Inicio de actividades', 'https://docs.demo/acta-001', now(), now()
                       FROM plans WHERE entidad_id=1 LIMIT 1""")
    conn.commit()

print("✅ Seed Neon completado: admin, auditor, usuario, entidades, permisos por entidad y datos demo.")
