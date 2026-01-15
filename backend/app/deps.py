from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.models import User, UserRole

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users(db: Session):
    # admin
    if not db.query(User).filter_by(email="admin@demo.com").first():
        db.add(User(email="admin@demo.com", hashed_password=pwd.hash("admin123"), role=UserRole.admin))
    # usuario
    if not db.query(User).filter_by(email="usuario@demo.com").first():
        db.add(User(email="usuario@demo.com", hashed_password=pwd.hash("usuario123"), role=UserRole.entidad))
    db.commit()
