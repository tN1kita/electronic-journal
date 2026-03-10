from pydantic import BaseModel


class EntryUpsert(BaseModel):
    lesson_id: int
    student_id: int

    # practice
    grade: int | None = None

    # lecture: "П" | "Н" | "Б"
    attendance: str | None = None