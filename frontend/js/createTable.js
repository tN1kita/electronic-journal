// createTable.js — создание журнала через API

document.addEventListener("DOMContentLoaded", () => {

    const modal         = document.getElementById("createModal");
    const confirmBtn    = document.getElementById("confirmCreateBtn");
    const table         = document.getElementById("createTable");
    const addStudentBtn = document.getElementById("addStudentRowBtn");
    const saveBtn       = document.getElementById("saveTableBtn");

    const typeButtons       = document.querySelectorAll(".journal-type-btn");
    const countInput        = document.getElementById("studentCountInput");
    const groupInput        = document.getElementById("groupNameInput");
    const subjectInput      = document.getElementById("subjectNameInput");
    const semesterInput     = document.getElementById("semesterInput");
    const departmentInput   = document.getElementById("departmentInput");
    const gradingGroup      = document.getElementById("gradingSchemeGroup");
    const gradingBtns       = document.querySelectorAll(".grading-btn");
    const lessonsCountInput = document.getElementById("lessonsCountInput");

    let journalType      = null;
    let gradingScheme    = null;
    let createdJournalId = null;

    // ── Выбор типа журнала ──
    typeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            typeButtons.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            journalType = btn.dataset.type;
            if (gradingGroup) {
                gradingGroup.style.display = journalType === "practice" ? "block" : "none";
            }
            if (journalType === "lecture") gradingScheme = null;
        });
    });

    // ── Выбор схемы оценивания ──
    gradingBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            gradingBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            gradingScheme = btn.dataset.scheme;
        });
    });

    // ── Открываем модалку при переходе на вкладку "Создать" ──
    document.addEventListener("pagechange", (e) => {
        if (e.detail.page === "create" && !createdJournalId) {
            modal.classList.add("active");
        }
    });

    // ── Кнопка "Создать журнал" ──
    // ── Кнопка "Создать журнал" ──
    confirmBtn?.addEventListener("click", async () => {
        const count        = parseInt(countInput?.value) || 0;
        const group        = groupInput?.value.trim();
        const subject      = subjectInput?.value.trim();
        const semester     = semesterInput?.value.trim();
        const department   = departmentInput?.value.trim();
        const lessonsCount = parseInt(lessonsCountInput?.value) || 1;

        if (!journalType)                                      { showModalError("Выберите тип журнала"); return; }
        if (journalType === "practice" && !gradingScheme)      { showModalError("Выберите схему оценивания"); return; }
        if (count < 1)                                         { showModalError("Введите количество студентов"); return; }
        if (!group)                                            { showModalError("Введите название группы"); return; }
        if (!subject)                                          { showModalError("Введите название предмета"); return; }
        if (!semester)                                         { showModalError("Введите семестр"); return; }
        if (lessonsCount < 1)                                  { showModalError("Занятий должно быть не менее 1"); return; }

        confirmBtn.disabled    = true;
        confirmBtn.textContent = "Создаём…";

        try {
            const body = {
                department:    department || "",
                group_name:    group,
                subject,
                semester,
                journal_type:  journalType,
                lessons_count: lessonsCount
            };
            if (journalType === "practice") body.grading_scheme = gradingScheme;

            const journal        = await API.createJournal(body);
            createdJournalId     = journal.id;

            window.currentJournalId      = journal.id;
            window.currentJournalData    = journal;
            window.currentJournalType    = journalType;
            window.currentJournalGroup   = group;
            window.currentJournalSubject = subject;

            modal.classList.remove("active");
            createRows(count);
            table.style.display         = "table";
            addStudentBtn.style.display = "inline-block";
            saveBtn.style.display       = "inline-block";

            showToast(`Журнал «${group} — ${subject}» создан`, "success");
            
            // ЯВНО ОСТАЁМСЯ НА СТРАНИЦЕ CREATE
            // Скрываем все страницы
            document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
            // Показываем страницу create
            document.getElementById("create")?.classList.add("active");
            // Активируем кнопку create
            document.querySelectorAll(".btn[data-page]").forEach(b => b.classList.remove("active"));
            document.querySelector(".btn[data-page='create']")?.classList.add("active");
            
            console.log("Stayed on create page");

        } catch (err) {
            showModalError(err.message);
        } finally {
            confirmBtn.disabled    = false;
            confirmBtn.textContent = "Создать журнал";
        }
    });

    // ── Создание строк ──
    function createRows(count) {
        const tbody = table.querySelector("tbody");
        tbody.innerHTML = "";
        for (let i = 1; i <= count; i++) tbody.appendChild(makeRow(i));
    }

    function makeRow(index) {
        const row = document.createElement("tr");
        row.innerHTML = `
              <td>${index}</td>
            <td contenteditable="true" class="cell-surname"></td>
            <td contenteditable="true" class="cell-name"></td>
            <td contenteditable="true" class="cell-patronymic"></td>
            <td contenteditable="true" class="cell-email"></td>
            <td class="delete-cell">
                <button type="button" class="delete-row-btn" title="Удалить студента">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                    </svg>
                </button>
            </td>
        `;
        row.querySelector(".delete-row-btn").addEventListener("click", () => {
            row.remove();
            reindexRows();
        });
        return row;
    }

    function reindexRows() {
        table.querySelectorAll("tbody tr").forEach((row, i) => {
            row.querySelector("td:first-child").textContent = i + 1;
        });
    }

    // ── Добавить студента вручную ──
    addStudentBtn?.addEventListener("click", () => {
        const tbody = table.querySelector("tbody");
        tbody.appendChild(makeRow(tbody.children.length + 1));
    });

    // ── Сохранить → отправить студентов в API ──
    saveBtn?.addEventListener("click", async () => {
        if (!createdJournalId) {
            showToast("Сначала создайте журнал", "error");
            return;
        }

        const rows     = table.querySelectorAll("tbody tr");
        const students = [];
        rows.forEach((row, idx) => {
            const surname    = row.querySelector(".cell-surname")?.innerText.trim();
            const name       = row.querySelector(".cell-name")?.innerText.trim();
            const patronymic = row.querySelector(".cell-patronymic")?.innerText.trim() || "";
            const email      = row.querySelector(".cell-email")?.innerText.trim() || "";
            if (surname && name) {
                students.push({ student_number: idx + 1, surname, name, patronymic, email, phone: "" });
            }
        });

        if (students.length === 0) {
            showToast("Добавьте хотя бы одного студента (фамилия и имя обязательны)", "error");
            return;
        }

        saveBtn.disabled    = true;
        saveBtn.textContent = "Сохранение…";

        let saved = 0;
        const errors = [];

        for (const student of students) {
            try {
                await API.addStudent(createdJournalId, student);
                saved++;
            } catch (err) {
                errors.push(`${student.surname} ${student.name}: ${err.message}`);
            }
        }

        saveBtn.disabled    = false;
        saveBtn.textContent = "Сохранить";

        if (errors.length > 0) {
            showToast(`Сохранено: ${saved}. Ошибки: ${errors.join("; ")}`, "error", 6000);
        } else {
            showToast(`Сохранено ${saved} студентов`, "success");
        }

        // Загружаем актуальные данные и строим таблицы
        try {
            const [journal, lessons, studList] = await Promise.all([
                API.getJournal(createdJournalId),
                API.getLessons(createdJournalId),
                API.getStudents(createdJournalId)
            ]);

            window.currentJournalLessons  = lessons;
            window.currentJournalStudents = studList;
            window.currentCellMap = {}; // новый журнал — клеток ещё нет

            buildJournalTables(journal, lessons, studList);
            
            // После сохранения студентов переходим на вкладку посещаемости
            document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
            document.getElementById("attendance")?.classList.add("active");
            document.querySelectorAll(".btn[data-page]").forEach(b => b.classList.remove("active"));
            document.querySelector(".btn[data-page='attendance']")?.classList.add("active");

        } catch (err) {
            showToast(err.message, "error");
        }
    });

    // ── Ошибка в модалке ──
    function showModalError(msg) {
        let err = modal.querySelector(".modal-error");
        if (!err) {
            err = document.createElement("p");
            err.className = "modal-error";
            confirmBtn.before(err);
        }
        err.textContent = msg;
        setTimeout(() => err?.remove(), 3000);
    }
});