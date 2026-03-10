"""
Создание admin пользователя.
Запуск:
cd backend
.\.venv\Scripts\Activate.ps1
python -m app.scripts.create_admin
"""
from getpass import getpass

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password


def main():
    db: Session = SessionLocal()
    try:
        email = input("Admin email: ").strip()
        password = getpass("Admin password: ").strip()

        surname = input("Surname: ").strip()
        name = input("Name: ").strip()
        patronymic = input("Patronymic (optional): ").strip()

        if db.query(User).filter(User.email == email).first():
            print("User already exists")
            return

        admin = User(
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            surname=surname,
            name=name,
            patronymic=patronymic,
        )
        db.add(admin)
        db.commit()
        print("Admin created")
    finally:
        db.close()


if __name__ == "__main__":
    main()