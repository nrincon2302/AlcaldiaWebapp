from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict
import os
import shutil
import uuid
import pathlib
from app.database import get_db
from app.models import UploadedFile, User
from app.dependencies import get_current_user

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "5"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

ALLOWED_MIMES = {
    # Imágenes
    "image/jpeg", "image/png", "image/gif",
    # PDF
    "application/pdf",
    # Excel / CSV
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    # Comprimidos
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
}

# Local filesystem
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
EVIDENCE_SUBDIR = os.getenv("EVIDENCE_SUBDIR", "evidence")
BASE_DIR = pathlib.Path(UPLOAD_DIR) / EVIDENCE_SUBDIR
BASE_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload/", status_code=status.HTTP_201_CREATED)
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    file: UploadFile = File(...),
    description: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, str | int]:
    """
    Sube un archivo al servidor. Almacena el archivo en el filesystem 
    y registra metadatos en PostgreSQL.
    """
    
    # 1) Validación de tipo MIME
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formatos permitidos: imágenes (JPG, PNG, GIF), PDF, Excel (XLS/XLSX/CSV) y comprimidos (ZIP, RAR, 7Z)",
        )
    
    # 2) Validar tamaño
    try:
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)
    except Exception:
        size = 0
        
    if size and size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo supera el límite de {MAX_UPLOAD_MB} MB."
        )    

    # 3) Sanitizar nombre y generar nombre único
    original_name = pathlib.Path(file.filename or "evidence").name.replace("..", ".")
    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    file_id = str(uuid.uuid4())  # ID único para la BD
    dest_path = BASE_DIR / unique_name
    
    # 4) Guardar archivo en filesystem
    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar el archivo: {str(e)}"
        )
    finally:
        await file.close()

    # 5) Registrar en PostgreSQL
    try:
        relative_path = f"{EVIDENCE_SUBDIR}/{unique_name}"
        
        db_file = UploadedFile(
            file_id=file_id,
            original_filename=original_name,
            stored_filename=unique_name,
            file_path=relative_path,
            content_type=file.content_type,
            file_size=size,
            uploaded_by_id=current_user.id,
            description=description,
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
    except Exception as e:
        # Si hay error en BD, eliminar el archivo que acabamos de guardar
        try:
            dest_path.unlink()
        except:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Error al registrar el archivo en la base de datos: {str(e)}"
        )

    return {
        "file_id": file_id,
        "filename": original_name,
        "stored_filename": unique_name,
        "content_type": file.content_type,
        "file_size": size,
        "download_url": f"/files/download/{file_id}",
    }


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Descarga un archivo previamente subido usando su file_id.
    """
    
    # 1) Buscar en BD
    db_file = db.query(UploadedFile).filter(UploadedFile.file_id == file_id).first()
    if not db_file:
        raise HTTPException(
            status_code=404,
            detail="Archivo no encontrado"
        )
    
    # 2) Construir ruta completa
    file_path = BASE_DIR / db_file.stored_filename
    
    # 3) Verificar que el archivo existe
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="El archivo no existe en el servidor"
        )
    
    # 4) Servir el archivo
    return FileResponse(
        path=file_path,
        media_type=db_file.content_type,
        filename=db_file.original_filename,
    )


@router.delete("/delete/{file_id}")
async def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """
    Elimina un archivo y su registro en la BD.
    Solo el usuario que lo subió o un admin puede eliminarlo.
    """
    
    # 1) Buscar en BD
    db_file = db.query(UploadedFile).filter(UploadedFile.file_id == file_id).first()
    if not db_file:
        raise HTTPException(
            status_code=404,
            detail="Archivo no encontrado"
        )
    
    # 2) Validar permisos (propietario o admin)
    if db_file.uploaded_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para eliminar este archivo"
        )
    
    # 3) Eliminar archivo del filesystem
    file_path = BASE_DIR / db_file.stored_filename
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        # Log pero no fallar si el archivo ya no existe en disco
        print(f"Advertencia: No se pudo eliminar archivo en disco: {e}")
    
    # 4) Eliminar registro de BD
    try:
        db.delete(db_file)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar de la base de datos: {str(e)}"
        )
    
    return {"message": "Archivo eliminado exitosamente"}
