from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_teacher
from app.db.session import get_db
from app.models.journal import Journal
from app.models.lesson import Lesson
from app.models.import_session import ImportSession
from app.models.student import Student
from app.models.journal_student import JournalStudent
from app.schemas.journal import JournalCreate, JournalOut
from app.schemas.lesson import LessonOut, LessonSetDate
from app.schemas.student import StudentCreate, StudentInJournalOut
from app.schemas.entry import EntryUpsert
from app.schemas.import_ import ImportMapping, ImportPreviewResponse
from app.models.user import User

from app.services.journals import (
    create_journal,
    set_lessons_count,
    set_lesson_date,
    add_student_manual,
    remove_student_from_journal,
    upsert_entry,
    clear_entry,
)
from app.services.excel_import import preview_import, confirm_import
from app.services.exports import export_excel, export_pdf
from urllib.parse import quote

router = APIRouter()


def _get_journal_or_404(db: Session, journal_id: int) -> Journal:
    j = db.query(Journal).filter(Journal.id == journal_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")
    return j


@router.post("", response_model=JournalOut, dependencies=[Depends(require_teacher)])
def create(payload: JournalCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return create_journal(db, teacher_id=user.id, payload=payload)


@router.get("", response_model=list[JournalOut])
def list_journals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    search: str | None = None,
    semester: str | None = None,
    group_name: str | None = None,
    subject: str | None = None,
    journal_type: str | None = None,
):
    """
    Фильтры для преподавателя (и админ тоже может смотреть).
    """
    q = db.query(Journal)

    if user.role == "teacher":
        q = q.filter(Journal.teacher_id == user.id)

    if semester:
        q = q.filter(Journal.semester == semester)
    if group_name:
        q = q.filter(Journal.group_name.ilike(f"%{group_name}%"))
    if subject:
        q = q.filter(Journal.subject.ilike(f"%{subject}%"))
    if journal_type:
        q = q.filter(Journal.journal_type == journal_type)

    if search:
        s = f"%{search}%"
        q = q.filter(
            (Journal.subject.ilike(s)) | (Journal.group_name.ilike(s)) | (Journal.department.ilike(s))
        )

    return q.order_by(Journal.id.desc()).all()


@router.get("/{journal_id}", response_model=JournalOut)
def get_one(journal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = _get_journal_or_404(db, journal_id)
    if user.role == "teacher" and j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return j


@router.get("/{journal_id}/lessons", response_model=list[LessonOut])
def get_lessons(journal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = _get_journal_or_404(db, journal_id)
    if user.role == "teacher" and j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return (
        db.query(Lesson)
        .filter(Lesson.journal_id == j.id)
        .order_by(Lesson.lesson_index)
        .all()
    )


@router.post("/{journal_id}/lessons/count", dependencies=[Depends(require_teacher)])
def change_lessons_count(
    journal_id: int,
    count: int = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    set_lessons_count(db, j, teacher_id=user.id, new_count=int(count))
    return {"status": "ok"}


@router.patch("/{journal_id}/lessons/{lesson_id}", dependencies=[Depends(require_teacher)])
def patch_lesson_date(
    journal_id: int,
    lesson_id: int,
    payload: LessonSetDate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    set_lesson_date(db, j, teacher_id=user.id, lesson_id=lesson_id, d=payload.lesson_date)
    return {"status": "ok"}


@router.get("/{journal_id}/students", response_model=list[StudentInJournalOut])
def list_students(journal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = _get_journal_or_404(db, journal_id)
    if user.role == "teacher" and j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    rows = (
        db.query(JournalStudent, Student)
        .join(Student, Student.id == JournalStudent.student_id)
        .filter(JournalStudent.journal_id == j.id)
        .order_by(JournalStudent.student_number, Student.surname)
        .all()
    )
    return [
        StudentInJournalOut(
            id=st.id,
            student_number=link.student_number,
            full_name=st.short_name(),
            email=st.email,
            phone=st.phone,
        )
        for link, st in rows
    ]


@router.post("/{journal_id}/students", dependencies=[Depends(require_teacher)])
def add_student(
    journal_id: int,
    payload: StudentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    student_id = add_student_manual(db, j, teacher_id=user.id, payload=payload)
    return {"student_id": student_id}


@router.delete("/{journal_id}/students/{student_id}", dependencies=[Depends(require_teacher)])
def delete_student(
    journal_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    remove_student_from_journal(db, j, teacher_id=user.id, student_id=student_id)
    return {"status": "ok"}


@router.put("/{journal_id}/entries", dependencies=[Depends(require_teacher)])
def put_entry(
    journal_id: int,
    payload: EntryUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    upsert_entry(db, j, teacher_id=user.id, payload=payload)
    return {"status": "ok"}


@router.delete("/{journal_id}/entries", dependencies=[Depends(require_teacher)])
def del_entry(
    journal_id: int,
    lesson_id: int = Form(...),
    student_id: int = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    clear_entry(db, j, teacher_id=user.id, lesson_id=int(lesson_id), student_id=int(student_id))
    return {"status": "ok"}


# --------- IMPORT (preview -> confirm) ----------

@router.post("/{journal_id}/import/preview", response_model=ImportPreviewResponse, dependencies=[Depends(require_teacher)])
def import_preview(
    journal_id: int,
    mapping_json: str = Form(...),  # JSON ImportMapping
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    if j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # mapping из фронта
    import json
    try:
        mapping = ImportMapping(**json.loads(mapping_json))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mapping_json")

    content = file.file.read()
    session_id, total, preview = preview_import(db, journal_id=j.id, teacher_id=user.id, file_bytes=content, mapping=mapping)
    return {"import_session_id": session_id, "total_rows": total, "preview": preview}


@router.post("/{journal_id}/import/confirm", dependencies=[Depends(require_teacher)])
def import_confirm(
    journal_id: int,
    import_session_id: int = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    j = _get_journal_or_404(db, journal_id)
    if j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    sess = db.query(ImportSession).filter(ImportSession.id == int(import_session_id), ImportSession.journal_id == j.id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Import session not found")
    if sess.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    imported = confirm_import(db, sess)

    # Можно удалить сессию после применения (чтобы не копить мусор)
    db.delete(sess)
    db.commit()

    return {"imported": imported}


# --------- EXPORT ----------

@router.get("/{journal_id}/export.xlsx")
def export_xlsx(journal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = _get_journal_or_404(db, journal_id)
    if user.role == "teacher" and j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    filename, content = export_excel(db, j)
    safe_name = f"journal_{j.id}.xlsx"
    utf8_name = quote(filename)

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{safe_name}\"; filename*=UTF-8''{utf8_name}"
        },
    )


@router.get("/{journal_id}/export.pdf")
def export_pdf_(journal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    j = _get_journal_or_404(db, journal_id)
    if user.role == "teacher" and j.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    filename, content = export_pdf(db, j)
    utf8_name = quote(filename)

    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="journal_{j.id}.pdf"; filename*=UTF-8\'\'{utf8_name}'
        },
    )