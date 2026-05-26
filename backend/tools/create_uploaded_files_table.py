from sqlalchemy import text
from app.database import engine, Base
from app.models import UploadedFile
import sys

def create_table():
    """Crea la tabla UploadedFile en la base de datos."""
    try:
        # Opción 1: Crear usando SQLAlchemy (más seguro)
        Base.metadata.create_all(bind=engine, tables=[UploadedFile.__table__])
        print("✅ Tabla 'uploaded_files' creada exitosamente")
        return True
    except Exception as e:
        print(f"❌ Error al crear la tabla: {e}")
        return False

if __name__ == "__main__":
    success = create_table()
    sys.exit(0 if success else 1)
