from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JournalStudent(Base):
    __tablename__ = "journal_students"
    __table_args__ = (
        UniqueConstraint("journal_id", "student_id", name="uq_journal_student"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    journal_id: Mapped[int] = mapped_column(ForeignKey("journals.id", ondelete="CASCADE"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))

    student_number: Mapped[int] = mapped_column(default=0)