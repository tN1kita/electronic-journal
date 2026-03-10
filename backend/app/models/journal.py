from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Journal(Base):
    __tablename__ = "journals"

    id: Mapped[int] = mapped_column(primary_key=True)

    department: Mapped[str] = mapped_column(String(200))   # кафедра
    group_name: Mapped[str] = mapped_column(String(100))   # группа
    subject: Mapped[str] = mapped_column(String(200))      # предмет

    # формат: "1 семестр 2025/26"
    semester: Mapped[str] = mapped_column(String(50))

    # lecture | practice
    journal_type: Mapped[str] = mapped_column(String(20))

    # practice grading: "1_5" | "0_100"
    grading_scheme: Mapped[str | None] = mapped_column(String(20), nullable=True)

    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))