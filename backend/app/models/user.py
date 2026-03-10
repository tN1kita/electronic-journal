from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))

    # Только 2 роли: admin, teacher
    role: Mapped[str] = mapped_column(String(20), default="teacher")

    # ФИО преподавателя (обязательно для титульника)
    surname: Mapped[str] = mapped_column(String(100), default="")
    name: Mapped[str] = mapped_column(String(100), default="")
    patronymic: Mapped[str] = mapped_column(String(100), default="")

    def fio_short(self) -> str:
        """Фамилия И.О."""
        n = (self.name[:1] + ".") if self.name else ""
        p = (self.patronymic[:1] + ".") if self.patronymic else ""
        return f"{self.surname} {n}{p}".strip()