from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Entry(Base):
    """
    Одна клетка: (lesson_id, student_id)
    practice: grade_int (1..5 или 0..100)
    lecture: attendance ("П"|"Н"|"Б")
    """
    __tablename__ = "entries"
    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id", name="uq_lesson_student"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))

    grade_int: Mapped[int | None] = mapped_column(nullable=True)
    attendance: Mapped[str | None] = mapped_column(nullable=True)