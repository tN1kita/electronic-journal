from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Стабильно на Windows/Python 3.14 (без bcrypt)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    """Хешируем пароль перед сохранением в БД."""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Сверяем введённый пароль и хеш из БД."""
    return pwd_context.verify(password, hashed)


def create_access_token(subject: str) -> str:
    """
    Создаём JWT-токен.
    subject = кто вошёл (будем класть user.id как строку).
    """
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    """Декодируем токен и проверяем подпись/срок."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])