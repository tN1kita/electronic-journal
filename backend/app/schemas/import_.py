from pydantic import BaseModel


class ImportMapping(BaseModel):
    """
    Сопоставление колонок.
    Нумерация колонок: 1..N (как в Excel).
    """
    number_col: int
    surname_col: int
    name_col: int
    patronymic_col: int
    email_col: int
    phone_col: int


class ImportPreviewRow(BaseModel):
    student_number: int
    surname: str
    name: str
    patronymic: str
    email: str | None
    phone: str | None
    fio_short: str


class ImportPreviewResponse(BaseModel):
    import_session_id: int
    total_rows: int
    preview: list[ImportPreviewRow]