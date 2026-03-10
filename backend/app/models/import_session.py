from datetime import datetime

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ImportSession(Base):
    """
    Храним "предпросмотр" импорта:
    - rows_json: нормализованные строки студентов (json)
    - создано преподавателем для конкретного журнала
    """
    __tablename__ = "import_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    journal_id: Mapped[int] = mapped_column(ForeignKey("journals.id", ondelete="CASCADE"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    rows_json: Mapped[str] = mapped_column(Text)  # JSON string