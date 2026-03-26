// journalBuilder.js — строит таблицы посещаемости/оценок из данных API

function buildJournalTables(journal, lessons, students) {
    const isLecture = journal.journal_type === "lecture";
    const group     = journal.group_name   || "";
    const subject   = journal.subject      || "";
    const typeLabel = isLecture ? "Лекция" : "Практика";

    // Обновляем заголовки
    ["attendance", "grades"].forEach(pageId => {
        const page = document.getElementById(pageId);
        if (!page) return;
        const h1 = page.querySelector("h1");
        if (h1) {
            const label = pageId === "attendance" ? "Посещаемость" : "Оценки";
            h1.textContent = `${label} — ${group} — ${subject} (${typeLabel})`;
        }
    });

    // Строим таблицу посещаемости
    buildTable("attendanceTable", journal, lessons, students, "attendance");

    // Строим таблицу оценок (только для практики)
    if (!isLecture) {
        buildTable("gradesTable", journal, lessons, students, "grades");
        enableGradesTab();
    } else {
        disableGradesTab();
    }
}

function buildTable(tableId, journal, lessons, students, mode) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const thead = table.querySelector("thead tr");
    const tbody = table.querySelector("tbody");

    // Очищаем
    while (thead.children.length > 1) thead.removeChild(thead.lastChild);
    tbody.innerHTML = "";

    // Колонки занятий
    lessons.forEach(lesson => {
        const th = document.createElement("th");
        th.style.minWidth = "110px";
        th.style.cursor   = "pointer";
        th.textContent    = lesson.lesson_date ? formatDate(lesson.lesson_date) : `Занятие`;
        th.title          = "Нажмите, чтобы изменить дату";
        th.dataset.lessonId = lesson.id;
        th.dataset.date     = lesson.lesson_date || "";

        th.addEventListener("click", (e) => {
            e.stopPropagation();
            onLessonHeaderClick(th, journal.id, lesson.id);
        });
        thead.appendChild(th);
    });

    // Строки студентов
    const cellMap = window.currentCellMap || {};

    students.forEach(student => {
        const row = document.createElement("tr");

        // ФИО
        const nameTd = document.createElement("td");
        nameTd.className = "name";
        const fullName = student.full_name || [student.surname, student.name, student.patronymic].filter(Boolean).join(" ") || "—";
        nameTd.textContent = fullName;

        // Кнопка удалить студента
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "delete-student-btn";
        delBtn.title = "Удалить студента из журнала";
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
        delBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm(`Удалить ${fullName} из журнала?`)) return;
            try {
                await API.removeStudent(journal.id, student.id);
                row.remove();
                window.currentJournalStudents = window.currentJournalStudents.filter(s => s.id !== student.id);
                showToast("Студент удалён", "success");
            } catch (err) {
                showToast(err.message, "error");
            }
        });
        nameTd.appendChild(delBtn);
        row.appendChild(nameTd);

        // Клетки занятий
        lessons.forEach(lesson => {
            const td = document.createElement("td");
            td.contentEditable = "true";
            td.dataset.studentId = student.id;
            td.dataset.lessonId  = lesson.id;
            td.dataset.mode      = mode;

            // Заполняем текущее значение из cellMap
            const key = `${student.id}_${lesson.id}`;
            const entry = cellMap[key];
            if (entry) {
                td.textContent = mode === "grades"
                    ? (entry.grade   != null ? String(entry.grade) : "")
                    : (entry.attendance != null ? entry.attendance : "");
            }

            // Применяем цвет сразу
            if (mode === "grades") {
                applyGradeStyle(td);
            } else {
                applyAttendanceStyle(td);
            }

            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    // Навешиваем обработчик ввода с дебаунсом
    table.removeEventListener("input", onTableInput);
    table.addEventListener("input", onTableInput);
}

// ── Обработка ввода в клетку ─────────────────────────────────

const saveDebounce = {};

function onTableInput(e) {
    const cell = e.target;
    if (!cell.isContentEditable) return;

    const mode      = cell.dataset.mode;
    if (!mode || mode === "null" || mode === "undefined") return;
    const studentId = parseInt(cell.dataset.studentId);
    const lessonId  = parseInt(cell.dataset.lessonId);
    if (!studentId || !lessonId) return;

    const journalId = window.currentJournalId;
    if (!journalId) return;

    const val = cell.innerText.trim();

    // Применяем стиль сразу
    if (mode === "grades") applyGradeStyle(cell);
    else applyAttendanceStyle(cell);

    // Дебаунс сохранения 600ms
    const key = `${studentId}_${lessonId}`;
    clearTimeout(saveDebounce[key]);
    saveDebounce[key] = setTimeout(async () => {
        try {
            if (val === "") {
                await API.deleteEntry(journalId, lessonId, studentId);
            } else {
                let body;
                if (mode === "grades") {
                    const grade = parseInt(val);
                    if (isNaN(grade)) return;
                    body = { lesson_id: lessonId, student_id: studentId, grade, attendance: null };
                } else {
                    const att = val.toUpperCase();
                    if (!["П", "Н", "Б"].includes(att)) return;
                    body = { lesson_id: lessonId, student_id: studentId, grade: null, attendance: att };
                }
                await API.upsertEntry(journalId, body);
            }
        } catch (err) {
            showToast(`Ошибка сохранения: ${err.message}`, "error");
        }
    }, 600);
}

// ── Клик по заголовку занятия (смена даты) ───────────────────

function onLessonHeaderClick(th, journalId, lessonId) {
    // Запоминаем текущую активную страницу и кнопку до открытия пикера
    const savedPageId  = document.querySelector(".page.active")?.id || null;
    const savedBtnPage = document.querySelector(".btn.active")?.dataset.page || null;

    // Создаём скрытый date input
    const datePicker = document.createElement("input");
    datePicker.type = "date";
    datePicker.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 1px; height: 1px;
        opacity: 0;
        pointer-events: none;
    `;
    document.body.appendChild(datePicker);

    // Устанавливаем текущую дату заголовка
    if (th.dataset.date) {
        const parts = th.dataset.date.split(".");
        if (parts.length === 3) {
            datePicker.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    } else {
        datePicker.value = new Date().toISOString().split("T")[0];
    }

    // Восстанавливаем страницу после закрытия пикера
    function restorePage() {
        datePicker.remove();

        if (!savedPageId) return;

        // Убираем все активные страницы и восстанавливаем нужную
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(savedPageId)?.classList.add("active");

        // Восстанавливаем активную кнопку
        document.querySelectorAll(".btn[data-page]").forEach(b => b.classList.remove("active"));
        if (savedBtnPage) {
            document.querySelector(`.btn[data-page='${savedBtnPage}']`)?.classList.add("active");
        }
    }

    let handled = false;

    const onChange = async () => {
        if (handled) return;
        handled = true;

        cleanup();
        const selectedDate = datePicker.value;

        if (selectedDate) {
            try {
                await API.updateLessonDate(journalId, lessonId, selectedDate);
                const [year, month, day] = selectedDate.split("-");
                th.textContent  = `${day}.${month}.${year}`;
                th.dataset.date = `${day}.${month}.${year}`;
                showToast("Дата обновлена", "success");
            } catch (err) {
                showToast(`Ошибка: ${err.message}`, "error");
            }
        }

        restorePage();
    };

    const onBlur = () => {
        // Небольшая задержка: blur срабатывает до change
        setTimeout(() => {
            if (!handled) {
                handled = true;
                cleanup();
                restorePage();
            }
        }, 150);
    };

    function cleanup() {
        datePicker.removeEventListener("change", onChange);
        datePicker.removeEventListener("blur", onBlur);
    }

    datePicker.addEventListener("change", onChange);
    datePicker.addEventListener("blur", onBlur);

    // Открываем пикер
    setTimeout(() => {
        try { datePicker.showPicker(); } catch { datePicker.click(); }
    }, 10);
}

// ── Вспомогательные ──────────────────────────────────────────

function formatDate(str) {
    if (!str) return "";
    const [y, m, d] = str.split("-");
    return `${d}.${m}.${y}`;
}

function applyAttendanceStyle(cell) {
    cell.classList.remove("status-P", "status-H", "status-S");
    const v = cell.innerText.trim().toUpperCase();
    if (v === "П") cell.classList.add("status-P");
    else if (v === "Н") cell.classList.add("status-H");
    else if (v === "Б") cell.classList.add("status-S");
}

function applyGradeStyle(cell) {
    cell.classList.remove("grade-1","grade-2","grade-3","grade-4","grade-5");
    const v = cell.innerText.trim();
    if (["1","2","3","4","5"].includes(v)) cell.classList.add(`grade-${v}`);
}

function enableGradesTab() {
    const btn = document.querySelector(".btn[data-page='grades']");
    btn?.classList.remove("disabled");
    btn?.removeAttribute("disabled");
    const page = document.getElementById("grades");
    if (!page) return;
    page.querySelector(".grades-unavailable")?.remove();
    const wrapper = page.querySelector(".table-wrapper");
    const addBtn  = page.querySelector(".addLessonBtn");
    if (wrapper) wrapper.style.display = "";
    if (addBtn)  addBtn.style.display  = "";
}

function disableGradesTab() {
    const btn = document.querySelector(".btn[data-page='grades']");
    btn?.classList.add("disabled");
    btn?.setAttribute("disabled", true);

    const page = document.getElementById("grades");
    if (!page) return;

    let notice = page.querySelector(".grades-unavailable");
    if (!notice) {
        notice = document.createElement("div");
        notice.className = "grades-unavailable";
        notice.innerHTML = `
            <div class="grades-unavailable-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Оценки недоступны</h3>
                <p>Журнал создан как <strong>Лекционный</strong>.<br>Вкладка оценок доступна только для практических журналов.</p>
            </div>`;
        page.appendChild(notice);
    }
    const wrapper = page.querySelector(".table-wrapper");
    const addBtn  = page.querySelector(".addLessonBtn");
    if (wrapper) wrapper.style.display = "none";
    if (addBtn)  addBtn.style.display  = "none";
}
// ── Кнопки сохранения журнала ────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("saveAttendanceBtn")?.addEventListener("click", () => {
        showToast("Все изменения сохраняются автоматически", "success");
    });
    document.getElementById("saveGradesBtn")?.addEventListener("click", () => {
        showToast("Все изменения сохраняются автоматически", "success");
    });
});