from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.models.registration_log import RegistrationLog
from app.schemas.auth import RegisterTeacher


def register_teacher(db: Session, payload: RegisterTeacher) -> User:
    # email уникальный
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    # ФИО обязательно
    if not payload.surname.strip() or not payload.name.strip():
        raise HTTPException(status_code=400, detail="FIO is required")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="teacher",
        surname=payload.surname.strip(),
        name=payload.name.strip(),
        patronymic=payload.patronymic.strip() if payload.patronymic else "",
    )
    db.add(user)
    db.flush()  # получаем user.id

    # лог регистрации для админа
    db.add(RegistrationLog(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user