from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.journal import Journal
from app.models.lesson import Lesson
from app.models.student import Student
from app.models.journal_student import JournalStudent
from app.models.entry import Entry
from app.schemas.journal import JournalCreate
from app.schemas.student import StudentCreate
from app.schemas.entry import EntryUpsert


def _ensure_owner(journal: Journal, teacher_id: int):
    if journal.teacher_id != teacher_id:
        raise HTTPException(status_code=403, detail="You cannot edit this journal")


def create_journal(db: Session, teacher_id: int, payload: JournalCreate) -> Journal:
    # проверка типа
    if payload.journal_type not in ("lecture", "practice"):
        raise HTTPException(status_code=400, detail="Invalid journal_type")

    # семестр формат — просто строка, но не пустая
    if not payload.semester.strip():
        raise HTTPException(status_code=400, detail="Semester is required")

    # grading для practice
    if payload.journal_type == "practice":
        if payload.grading_scheme not in ("1_5", "0_100"):
            raise HTTPException(status_code=400, detail="grading_scheme must be 1_5 or 0_100")
    else:
        if payload.grading_scheme is not None:
            raise HTTPException(status_code=400, detail="grading_scheme must be null for lecture")

    if payload.lessons_count <= 0:
        raise HTTPException(status_code=400, detail="lessons_count must be > 0")

    journal = Journal(
        department=payload.department.strip(),
        group_name=payload.group_name.strip(),
        subject=payload.subject.strip(),
        semester=payload.semester.strip(),
        journal_type=payload.journal_type,
        grading_scheme=payload.grading_scheme,
        teacher_id=teacher_id,
    )
    db.add(journal)
    db.flush()

    # создаём колонки (уроки) без дат — преподаватель выставит даты позже
    for i in range(1, payload.lessons_count + 1):
        db.add(Lesson(journal_id=journal.id, lesson_index=i, lesson_date=None))

    db.commit()
    db.refresh(journal)
    return journal


def set_lessons_count(db: Session, journal: Journal, teacher_id: int, new_count: int):
    """Меняем количество колонок (добавляем/удаляем последние)."""
    _ensure_owner(journal, teacher_id)
    if new_count <= 0:
        raise HTTPException(status_code=400, detail="count must be > 0")

    lessons = (
        db.query(Lesson)
        .filter(Lesson.journal_id == journal.id)
        .order_by(Lesson.lesson_index)
        .all()
    )
    cur = len(lessons)

    if new_count == cur:
        return

    if new_count > cur:
        for i in range(cur + 1, new_count + 1):
            db.add(Lesson(journal_id=journal.id, lesson_index=i, lesson_date=None))
        db.commit()
        return

    # уменьшение: удаляем последние уроки, вместе с entries каскадом по lesson_id
    to_delete = [l for l in lessons if l.lesson_index > new_count]
    for l in to_delete:
        db.delete(l)
    db.commit()


def set_lesson_date(db: Session, journal: Journal, teacher_id: int, lesson_id: int, d: date | None):
    _ensure_owner(journal, teacher_id)

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id, Lesson.journal_id == journal.id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # запрет дубликатов дат внутри журнала (если дата задана)
    if d is not None:
        dup = (
            db.query(Lesson)
            .filter(Lesson.journal_id == journal.id, Lesson.lesson_date == d, Lesson.id != lesson.id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="This date already exists in journal")

    lesson.lesson_date = d
    db.commit()


def add_student_manual(db: Session, journal: Journal, teacher_id: int, payload: StudentCreate) -> int:
    _ensure_owner(journal, teacher_id)

    student = None
    if payload.email:
        student = db.query(Student).filter(Student.email == str(payload.email)).first()

    if not student:
        student = Student(
            surname=payload.surname.strip(),
            name=payload.name.strip(),
            patronymic=payload.patronymic.strip() if payload.patronymic else "",
            email=str(payload.email) if payload.email else None,
            phone=payload.phone,
        )
        db.add(student)
        db.flush()

    if (
        db.query(JournalStudent)
        .filter(JournalStudent.journal_id == journal.id, JournalStudent.student_id == student.id)
        .first()
    ):
        raise HTTPException(status_code=400, detail="Student already in journal")

    db.add(JournalStudent(journal_id=journal.id, student_id=student.id, student_number=payload.student_number))
    db.commit()
    return student.id


def remove_student_from_journal(db: Session, journal: Journal, teacher_id: int, student_id: int):
    """Удаляем только из журнала (не из базы), плюс очищаем клетки."""
    _ensure_owner(journal, teacher_id)

    link = (
        db.query(JournalStudent)
        .filter(JournalStudent.journal_id == journal.id, JournalStudent.student_id == student_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Student not in journal")

    # удаляем entries этого студента по всем урокам данного журнала
    lesson_ids = [l.id for l in db.query(Lesson).filter(Lesson.journal_id == journal.id).all()]
    if lesson_ids:
        db.query(Entry).filter(Entry.lesson_id.in_(lesson_ids), Entry.student_id == student_id).delete(synchronize_session=False)

    db.delete(link)
    db.commit()


def upsert_entry(db: Session, journal: Journal, teacher_id: int, payload: EntryUpsert):
    _ensure_owner(journal, teacher_id)

    lesson = db.query(Lesson).filter(Lesson.id == payload.lesson_id, Lesson.journal_id == journal.id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not db.query(JournalStudent).filter(JournalStudent.journal_id == journal.id, JournalStudent.student_id == payload.student_id).first():
        raise HTTPException(status_code=400, detail="Student not in journal")

    entry = db.query(Entry).filter(Entry.lesson_id == lesson.id, Entry.student_id == payload.student_id).first()
    if not entry:
        entry = Entry(lesson_id=lesson.id, student_id=payload.student_id)
        db.add(entry)

    if journal.journal_type == "practice":
        if payload.grade is None:
            raise HTTPException(status_code=400, detail="grade is required")
        grade = int(payload.grade)
        if journal.grading_scheme == "1_5" and not (1 <= grade <= 5):
            raise HTTPException(status_code=400, detail="grade must be 1..5")
        if journal.grading_scheme == "0_100" and not (0 <= grade <= 100):
            raise HTTPException(status_code=400, detail="grade must be 0..100")
        entry.grade_int = grade
        entry.attendance = None
    else:
        if payload.attendance not in ("П", "Н", "Б"):
            raise HTTPException(status_code=400, detail="attendance must be П/Н/Б")
        entry.attendance = payload.attendance
        entry.grade_int = None

    db.commit()


def clear_entry(db: Session, journal: Journal, teacher_id: int, lesson_id: int, student_id: int):
    _ensure_owner(journal, teacher_id)

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id, Lesson.journal_id == journal.id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    entry = db.query(Entry).filter(Entry.lesson_id == lesson.id, Entry.student_id == student_id).first()
    if entry:
        db.delete(entry)
        db.commit()