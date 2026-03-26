// account.js — профиль и список журналов, подключён к бэкенду

const AVATARS_COUNT = 5;
const AVATARS_PATH = "assets/avatars/";

document.addEventListener("DOMContentLoaded", () => {
    // Проверяем токен — если нет, редиректим на логин
    if (!API.getToken()) {
        window.location.href = "login.html";
        return;
    }

    renderAccountPage();
});

async function renderAccountPage() {
    console.log("renderAccountPage called");
    const page = document.getElementById("account");
    if (!page) return;

    // Показываем скелетон пока грузим
    page.innerHTML = `<div style="padding:40px;color:var(--text-muted,rgba(255,255,255,.45))">Загрузка профиля…</div>`;

    let user, journals;
    try {
        user = await API.getMe();
        journals = await API.getJournals();
    } catch (err) {
        page.innerHTML = `<div style="padding:40px;color:#fc8181">${err.message}</div>`;
        return;
    }

    // Сохраняем пользователя глобально (нужен другим модулям)
    window.currentUser = user;

    const savedAvatar = localStorage.getItem("selectedAvatar");
    const avatarIndex = savedAvatar ? parseInt(savedAvatar) : null;

    const fullName = [user.surname, user.name, user.patronymic].filter(Boolean).join(" ");
    const initials = [(user.surname || "")[0], (user.name || "")[0]].filter(Boolean).join("");

    page.innerHTML = `
        <div class="account-layout">

            <!-- ЛЕВАЯ КОЛОНКА: профиль -->
            <div class="account-left">
                <div class="profile-card">
                    <div class="avatar-wrapper">
                        <img
                            class="avatar-img"
                            src="${avatarIndex ? `${AVATARS_PATH}avatar${avatarIndex}.png` : ""}"
                            alt="Avatar"
                            style="${avatarIndex ? "" : "display:none"}"
                        />
                        <div class="avatar-placeholder ${avatarIndex ? "hidden" : ""}">
                            ${initials || "?"}
                        </div>
                        <button type="button" class="avatar-edit-btn" id="changeAvatarBtn" title="Сменить аватар">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="profile-info">
                        <h2 class="profile-name">${fullName || "Преподаватель"}</h2>
                        <span class="profile-role">${user.role || "Преподаватель"}</span>
                        <div class="profile-details">
                            ${user.department ? `
                            <div class="detail-row">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                <span>${user.department}</span>
                            </div>` : ""}
                            ${user.email ? `
                            <div class="detail-row">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                <span>${user.email}</span>
                            </div>` : ""}
                        </div>
                    </div>
                </div>

                <button type="button" class="logout-btn" id="logoutBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Выйти
                </button>
            </div>

            <!-- ПРАВАЯ КОЛОНКА: журналы -->
            <div class="account-right">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
                    <h3 class="card-title" style="margin:0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                        Мои журналы
                    </h3>
                    <!-- Фильтры -->
                    <input class="journal-filter-input" id="filterSearch" type="text" placeholder="Поиск…">
                    <select class="journal-filter-input" id="filterType">
                        <option value="">Все типы</option>
                        <option value="lecture">Лекция</option>
                        <option value="practice">Практика</option>
                    </select>
                    <select class="journal-filter-input" id="filterSemester">
                        <option value="">Все семестры</option>
                    </select>
                </div>

                <div class="journals-grid" id="journalsGrid">
                    ${renderJournalCards(journals)}
                </div>
            </div>
        </div>

        <!-- МОДАЛКА ВЫБОРА АВАТАРА -->
        <div class="avatar-modal" id="avatarModal">
            <div class="avatar-modal-content">
                <h3>Выберите аватар</h3>
                <div class="avatar-grid">
                    ${Array.from({length: AVATARS_COUNT}, (_, i) => i + 1).map(i => `
                        <div class="avatar-option ${avatarIndex === i ? "selected" : ""}" data-index="${i}">
                            <img src="${AVATARS_PATH}avatar${i}.png" alt="Avatar ${i}" />
                        </div>
                    `).join("")}
                </div>
                <button type="button" class="avatar-cancel-btn" id="cancelAvatarBtn">Отмена</button>
            </div>
        </div>
    `;

    // Заполняем семестры
    const semesters = [...new Set((journals || []).map(j => j.semester).filter(Boolean))];
    const semesterSelect = document.getElementById("filterSemester");
    semesters.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        semesterSelect.appendChild(opt);
    });

    // Фильтрация
    let filterTimeout;
    const applyFilters = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(async () => {
            const filters = {
                search: document.getElementById("filterSearch").value.trim(),
                journal_type: document.getElementById("filterType").value,
                semester: document.getElementById("filterSemester").value
            };
            try {
                const filtered = await API.getJournals(filters);
                document.getElementById("journalsGrid").innerHTML = renderJournalCards(filtered);
                attachJournalCardListeners();
            } catch {}
        }, 350);
    };

    ["filterSearch", "filterType", "filterSemester"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", applyFilters);
        document.getElementById(id)?.addEventListener("change", applyFilters);
    });

    // Смена аватара
    document.getElementById("changeAvatarBtn").addEventListener("click", () => {
        document.getElementById("avatarModal").classList.add("active");
    });
    document.getElementById("cancelAvatarBtn").addEventListener("click", () => {
        document.getElementById("avatarModal").classList.remove("active");
    });
    document.querySelectorAll(".avatar-option").forEach(opt => {
        opt.addEventListener("click", () => {
            const idx = parseInt(opt.dataset.index);
            localStorage.setItem("selectedAvatar", idx);
            const img = page.querySelector(".avatar-img");
            const placeholder = page.querySelector(".avatar-placeholder");
            img.src = `${AVATARS_PATH}avatar${idx}.png`;
            img.style.display = "block";
            placeholder.classList.add("hidden");
            document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            document.getElementById("avatarModal").classList.remove("active");
        });
    });

    // Выход
    document.getElementById("logoutBtn").addEventListener("click", () => {
        API.clearToken();
        window.location.href = "login.html";
    });

    attachJournalCardListeners();
}

function renderJournalCards(journals) {

    if (!journals || journals.length === 0) {
        return `<div style="color:var(--text-muted,rgba(255,255,255,.45));padding:20px;">Журналы не найдены</div>`;
    }
    return journals.map(j => `
        <div class="journal-card" data-id="${j.id}">
            <div class="journal-card-header">
                <span class="journal-group">${j.group_name || ""}</span>
                <span class="journal-updated">${j.journal_type === "lecture" ? "Лекция" : "Практика"}</span>
            </div>
            <div class="journal-subject">${j.subject || ""}</div>
            <div class="journal-stats">
                <div class="stat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    <span>${j.semester || ""}</span>
                </div>
            </div>
            <button type="button" class="open-journal-btn" data-id="${j.id}">Открыть журнал →</button>
        </div>
    `).join("");
}

function attachJournalCardListeners() {
    document.querySelectorAll(".open-journal-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            openJournal(id);
        });
    });
}

async function openJournal(journalId) {
    console.log("openJournal called for journal:", journalId);
    try {
        const [journal, lessons, students] = await Promise.all([
            API.getJournal(journalId),
            API.getLessons(journalId),
            API.getStudents(journalId)
        ]);

        // Загружаем записи отдельно, чтобы видеть ошибку
        let entries = [];
        try {
            entries = await API.getEntries(journalId);
            console.log(`[openJournal] entries loaded: ${entries.length}`, entries);
        } catch (err) {
            console.error("[openJournal] getEntries failed:", err);
            showToast(`Не удалось загрузить данные журнала: ${err.message}`, "error");
        }

        window.currentJournalId       = journalId;
        window.currentJournalData     = journal;
        window.currentJournalLessons  = lessons;
        window.currentJournalStudents = students;
        window.currentJournalType     = journal.journal_type;

        // Строим cellMap: { "studentId_lessonId": entry }
        window.currentCellMap = {};
        (entries || []).forEach(e => {
            const key = `${e.student_id}_${e.lesson_id}`;
            window.currentCellMap[key] = e;
            console.log(`[cellMap] key=${key}`, e);
        });
        console.log("[openJournal] cellMap built:", window.currentCellMap);

        buildJournalTables(journal, lessons, students);

        // Переходим на вкладку посещаемости
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById("attendance")?.classList.add("active");
        document.querySelectorAll(".btn[data-page]").forEach(b => b.classList.remove("active"));
        document.querySelector(".btn[data-page='attendance']")?.classList.add("active");

    } catch (err) {
        showToast(err.message, "error");
    }
}