from fastapi import APIRouter, UploadFile, File, HTTPException, status
from typing import Dict
import os
import shutil
import uuid
import pathlib

try:
    from google.cloud import storage  # requirements.txt: google-cloud-storage
except Exception:  
    storage = None

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

# Local filesystem (fallback)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
EVIDENCE_SUBDIR = os.getenv("EVIDENCE_SUBDIR", "evidence")
BASE_DIR = pathlib.Path(UPLOAD_DIR) / EVIDENCE_SUBDIR
BASE_DIR.mkdir(parents=True, exist_ok=True)

# GCS 
GCS_BUCKET = os.getenv("GCS_BUCKET", "").strip()
GCS_PREFIX = os.getenv("GCS_PREFIX", "evidence/").lstrip("/")

router = APIRouter(prefix="/files", tags=["files"])

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_evidence(file: UploadFile = File(...)) -> Dict[str, str]:
    # 1) Validación de tipo MIME
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formatos permitidos: imágenes (JPG, PNG, GIF), PDF, Excel (XLS/XLSX/CSV) y comprimidos (ZIP, RAR, 7Z)",
        )
    
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

    original_name = pathlib.Path(file.filename or "evidence").name.replace("..", ".")
    unique_name = f"{uuid.uuid4().hex}_{original_name}"

    
    if GCS_BUCKET:
        if storage is None:
            raise HTTPException(
                status_code=500,
                detail="google-cloud-storage no instalado en el servidor",
            )
        try:
            object_name = f"{GCS_PREFIX.rstrip('/')}/{unique_name}"
            client = storage.Client()
            bucket = client.bucket(GCS_BUCKET)
            blob = bucket.blob(object_name)
            blob.upload_from_file(file.file, content_type=file.content_type)
        finally:
            await file.close()

        public_url = f"https://storage.googleapis.com/{GCS_BUCKET}/{object_name}"
        return {
            "public_url": public_url,       
            "object_name": object_name,    
            "filename": original_name,
            "content_type": file.content_type,
        }

    dest_path = BASE_DIR / unique_name
    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    public_path = f"/uploads/{EVIDENCE_SUBDIR}/{unique_name}"  # relativo al backend
    return {
        "url": public_path,           
        "filename": original_name,
        "content_type": file.content_type,
    }
