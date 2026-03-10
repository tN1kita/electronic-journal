from pydantic import BaseModel, EmailStr


class StudentCreate(BaseModel):
    student_number: int = 0
    surname: str
    name: str
    patronymic: str = ""
    email: EmailStr | None = None
    phone: str | None = None


class StudentInJournalOut(BaseModel):
    id: int
    student_number: int
    full_name: str
    email: str | None = None
    phone: str | None = None