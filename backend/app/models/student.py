from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)

    surname: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    patronymic: Mapped[str] = mapped_column(String(100), default="")

    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    def short_name(self) -> str:
        """Фамилия И.О."""
        n = (self.name[:1] + ".") if self.name else ""
        p = (self.patronymic[:1] + ".") if self.patronymic else ""
        return f"{self.surname} {n}{p}".strip()