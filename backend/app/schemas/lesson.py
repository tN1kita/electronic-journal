from datetime import date
from pydantic import BaseModel


class LessonOut(BaseModel):
    id: int
    lesson_index: int
    lesson_date: date | None

    model_config = {"from_attributes": True}


class LessonSetDate(BaseModel):
    lesson_date: date | None  # можно снять дату