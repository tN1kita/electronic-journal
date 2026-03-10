from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import Token, RegisterTeacher
from app.services.users import register_teacher

router = APIRouter()


@router.post("/register")
def register(payload: RegisterTeacher, db: Session = Depends(get_db)):
    """Саморегистрация преподавателя."""
    user = register_teacher(db, payload)
    return {"id": user.id}


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 форма: username=email, password=password."""
    email = form_data.username
    password = form_data.password

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")

    token = create_access_token(subject=str(user.id))
    return {"access_token": token, "token_type": "bearer"}