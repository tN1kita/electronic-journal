from datetime import date

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Lesson(Base):
    """
    Колонка журнала.
    lesson_index: порядок колонки
    lesson_date: дата занятия (может быть NULL, пока преподаватель не поставил)
    """
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("journal_id", "lesson_index", name="uq_journal_lesson_index"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    journal_id: Mapped[int] = mapped_column(ForeignKey("journals.id", ondelete="CASCADE"))

    lesson_index: Mapped[int] = mapped_column()
    lesson_date: Mapped[date | None] = mapped_column(nullable=True)