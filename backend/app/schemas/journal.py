from pydantic import BaseModel


class JournalCreate(BaseModel):
    department: str
    group_name: str
    subject: str
    semester: str  # "1 семестр 2025/26"

    journal_type: str  # "lecture" | "practice"
    grading_scheme: str | None = None  # "1_5" | "0_100" только для practice

    # сколько колонок создать сразу
    lessons_count: int


class JournalOut(BaseModel):
    id: int
    department: str
    group_name: str
    subject: str
    semester: str
    journal_type: str
    grading_scheme: str | None
    teacher_id: int

    model_config = {"from_attributes": True}