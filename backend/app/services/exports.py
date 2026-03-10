from datetime import datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font as XLFont, Alignment as XLAlignment
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.orm import Session
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle

from app.core.config import settings
from app.models.journal import Journal
from app.models.lesson import Lesson
from app.models.student import Student
from app.models.journal_student import JournalStudent
from app.models.entry import Entry
from app.models.user import User


def _safe_filename(s: str) -> str:
    s = s.strip().replace(" ", "_")
    return s.replace("/", "_").replace("\\", "_")


def _lesson_header(lesson: Lesson) -> str:
    if lesson.lesson_date:
        return lesson.lesson_date.strftime("%d.%m.%Y")
    return f"Занятие {lesson.lesson_index}"


def _student_final_practice(grades: list[int]) -> str:
    if not grades:
        return ""
    return f"{sum(grades) / len(grades):.2f}"


def _student_final_lecture(statuses: list[str]) -> str:
    filled = [s for s in statuses if s in ("П", "Н", "Б")]
    if not filled:
        return ""
    present = sum(1 for s in filled if s == "П")
    return f"{(present / len(filled)) * 100:.0f}%"


def _register_times_new_roman() -> tuple[str, str]:
    candidates = [
        Path("app/assets/fonts/times.ttf"),
        Path("C:/Windows/Fonts/times.ttf"),
    ]
    bold_candidates = [
        Path("app/assets/fonts/timesbd.ttf"),
        Path("C:/Windows/Fonts/timesbd.ttf"),
    ]

    regular = next((p for p in candidates if p.exists()), None)
    bold = next((p for p in bold_candidates if p.exists()), None)

    if not regular or not bold:
        raise RuntimeError(
            "Не найдены шрифты Times New Roman. "
            "Положи times.ttf и timesbd.ttf в app/assets/fonts/ "
            "или используй системные шрифты Windows."
        )

    pdfmetrics.registerFont(TTFont("TimesNewRoman", str(regular)))
    pdfmetrics.registerFont(TTFont("TimesNewRoman-Bold", str(bold)))
    return "TimesNewRoman", "TimesNewRoman-Bold"


def _draw_title_page(canvas, doc, journal: Journal, teacher_fio: str, font_regular: str, font_bold: str):
    w, h = A4

    canvas.saveState()

    def center(text: str, y_mm: float, size: int):
        canvas.setFont(font_regular, size)
        canvas.drawCentredString(w / 2, h - y_mm * mm, text)

    center("МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РОССИЙСКОЙ ФЕДЕРАЦИИ", 28, 11)
    center("Федеральное государственное бюджетное образовательное учреждение высшего образования", 36, 11)
    center(f"«{settings.university.upper()}»", 46, 14)

    center(f'КАФЕДРА «{journal.department.upper()}»', 68, 14)

    center("ОТЧЕТ", 112, 14)

    journal_line = "Журнал посещаемости" if journal.journal_type == "lecture" else "Журнал успеваемости"
    center(journal_line, 122, 14)

    center(f"по предмету {journal.subject}", 130, 14)

    canvas.setFont(font_regular, 14)
    label_x = 103 * mm
    label_y = h - 196 * mm
    canvas.drawString(label_x, label_y, "Преподаватель:")

    line_x1 = 139 * mm
    line_x2 = 177 * mm
    canvas.line(line_x1, label_y - 1.5, line_x2, label_y - 1.5)
    canvas.drawString(line_x1 + 2 * mm, label_y, teacher_fio)

    center(f"{settings.city} - {datetime.now().year}", 275, 14)

    canvas.restoreState()


def export_excel(db: Session, journal: Journal) -> tuple[str, bytes]:
    lessons = db.query(Lesson).filter(Lesson.journal_id == journal.id).order_by(Lesson.lesson_index).all()
    links = (
        db.query(JournalStudent, Student)
        .join(Student, Student.id == JournalStudent.student_id)
        .filter(JournalStudent.journal_id == journal.id)
        .order_by(JournalStudent.student_number, Student.surname)
        .all()
    )

    lesson_ids = [l.id for l in lessons]
    student_ids = [st.id for _, st in links]
    entries = db.query(Entry).filter(Entry.lesson_id.in_(lesson_ids), Entry.student_id.in_(student_ids)).all()
    entry_map = {(e.lesson_id, e.student_id): e for e in entries}

    wb = Workbook()
    ws = wb.active
    ws.title = "Journal"

    header_font = XLFont(name="Times New Roman", size=12, bold=True)
    body_font = XLFont(name="Times New Roman", size=12)
    center = XLAlignment(vertical="center", horizontal="center")
    left = XLAlignment(vertical="center", horizontal="left")

    last_col_name = "Средний балл" if journal.journal_type == "practice" else "Посещаемость %"
    ws.append(["Номер ученика", "Фамилия И.О."] + [_lesson_header(l) for l in lessons] + [last_col_name])

    for link, st in links:
        row = [link.student_number, st.short_name()]

        grades: list[int] = []
        statuses: list[str] = []

        for l in lessons:
            e = entry_map.get((l.id, st.id))
            if journal.journal_type == "practice":
                val = "" if not e or e.grade_int is None else e.grade_int
                if isinstance(val, int):
                    grades.append(val)
                row.append(val)
            else:
                val = "" if not e or not e.attendance else e.attendance
                if val in ("П", "Н", "Б"):
                    statuses.append(val)
                row.append(val)

        row.append(
            _student_final_practice(grades)
            if journal.journal_type == "practice"
            else _student_final_lecture(statuses)
        )
        ws.append(row)

    for row in ws.iter_rows():
        for cell in row:
            if cell.row == 1:
                cell.font = header_font
                cell.alignment = center
            else:
                cell.font = body_font
                cell.alignment = left if cell.column == 2 else center

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    kind = "лекция" if journal.journal_type == "lecture" else "практика"
    filename = f"{_safe_filename(journal.subject)}_{_safe_filename(journal.group_name)}_{kind}.xlsx"
    return filename, buf.read()


def export_pdf(db: Session, journal: Journal) -> tuple[str, bytes]:
    font_regular, font_bold = _register_times_new_roman()

    normal = ParagraphStyle(
        "NormalTNR",
        fontName=font_regular,
        fontSize=12,
        leading=14,
    )
    small = ParagraphStyle(
        "SmallTNR",
        fontName=font_regular,
        fontSize=11,
        leading=13,
    )

    teacher = db.query(User).filter(User.id == journal.teacher_id).first()

    lessons = db.query(Lesson).filter(Lesson.journal_id == journal.id).order_by(Lesson.lesson_index).all()
    links = (
        db.query(JournalStudent, Student)
        .join(Student, Student.id == JournalStudent.student_id)
        .filter(JournalStudent.journal_id == journal.id)
        .order_by(JournalStudent.student_number, Student.surname)
        .all()
    )

    lesson_ids = [l.id for l in lessons]
    student_ids = [st.id for _, st in links]
    entries = db.query(Entry).filter(Entry.lesson_id.in_(lesson_ids), Entry.student_id.in_(student_ids)).all()
    entry_map = {(e.lesson_id, e.student_id): e for e in entries}

    buf = BytesIO()
    pagesize = landscape(A4) if len(lessons) > 10 else A4

    doc = SimpleDocTemplate(
        buf,
        pagesize=pagesize,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    story = [PageBreak()]

    last_col_name = "Средний балл" if journal.journal_type == "practice" else "Посещаемость %"
    header = ["№", "Фамилия И.О."] + [_lesson_header(l) for l in lessons] + [last_col_name]
    data = [header]

    finals: list[float] = []

    for link, st in links:
        row = [link.student_number, st.short_name()]
        grades: list[int] = []
        statuses: list[str] = []

        for l in lessons:
            e = entry_map.get((l.id, st.id))
            if journal.journal_type == "practice":
                val = "" if not e or e.grade_int is None else str(e.grade_int)
                if val.isdigit():
                    grades.append(int(val))
                row.append(val)
            else:
                val = "" if not e or not e.attendance else e.attendance
                if val in ("П", "Н", "Б"):
                    statuses.append(val)
                row.append(val)

        final_str = _student_final_practice(grades) if journal.journal_type == "practice" else _student_final_lecture(statuses)
        row.append(final_str)

        if final_str:
            try:
                finals.append(float(final_str.replace("%", "")))
            except Exception:
                pass

        data.append(row)

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("FONTNAME", (0, 0), (-1, 0), font_bold),
        ("FONTNAME", (0, 1), (-1, -1), font_regular),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    story.append(table)
    story.append(Spacer(1, 6 * mm))

    if finals:
        group_avg = sum(finals) / len(finals)
        if journal.journal_type == "practice":
            story.append(Paragraph(f"Средний балл группы: {group_avg:.2f}", normal))
        else:
            story.append(Paragraph(f"Средняя посещаемость группы: {group_avg:.0f}%", normal))
    else:
        story.append(Paragraph("Среднее по группе: нет данных", small))

    teacher_fio = teacher.fio_short() if teacher else "________________"

    doc.build(
        story,
        onFirstPage=lambda c, d: _draw_title_page(c, d, journal, teacher_fio, font_regular, font_bold),
    )

    buf.seek(0)
    filename = f"journal_{journal.id}.pdf"
    return filename, buf.read()