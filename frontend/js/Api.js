// api.js — централизованный API-слой для EJour
// Base URL: все пути относительные (/api/...)
const BASE_URL = "http://localhost:8000";
const API = (() => {

    // ── Токен ──────────────────────────────────────────────
    function getToken() {
        return localStorage.getItem("access_token");
    }

    function setToken(token) {
        localStorage.setItem("access_token", token);
    }

    function clearToken() {
        localStorage.removeItem("access_token");
    }

    // ── Базовый запрос ─────────────────────────────────────
    async function request(method, url, body = null, isFormData = false) {
        const token = getToken();

        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (body && !isFormData) headers["Content-Type"] = "application/json";

        const options = { method, headers };
        if (body) {
            options.body = isFormData ? body : JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(BASE_URL + url, options);
        } catch (err) {
            throw new Error("Сетевая ошибка: не удалось подключиться к серверу");
        }

        // 401 → сброс токена и редирект на логин
        if (res.status === 401) {
            clearToken();
            showLogin();
            throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
        }

        // 403 → показываем сообщение, не повторяем запрос
        if (res.status === 403) {
            let msg = "Доступ запрещён";
            try {
                const data = await res.json();
                msg = data.detail || msg;
            } catch {}
            showToast(msg, "error");
            throw new Error(msg);
        }

        // 404
        if (res.status === 404) {
            let msg = "Не найдено";
            try {
                const data = await res.json();
                msg = data.detail || msg;
            } catch {}
            throw new Error(msg);
        }

        // 400 / 422 — возвращаем текст ошибки для обработки в форме
        if (res.status === 400 || res.status === 422) {
            let msg = "Ошибка запроса";
            try {
                const data = await res.json();
                msg = data.detail || JSON.stringify(data);
            } catch {}
            throw new Error(msg);
        }

        // Прочие ошибки
        if (!res.ok) {
            throw new Error(`Ошибка сервера: ${res.status}`);
        }

        // Пустой ответ (204)
        if (res.status === 204) return null;

        // Возвращаем JSON
        return res.json();
    }

    // ── Blob-запрос для экспорта ───────────────────────────
    async function requestBlob(url) {
        const token = getToken();
        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(BASE_URL + url, { headers });
        if (!res.ok) throw new Error(`Ошибка экспорта: ${res.status}`);

        // Получаем имя файла из Content-Disposition
        const cd = res.headers.get("Content-Disposition") || "";
        let filename = "export";
        const match = cd.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/);
        if (match) filename = match[2];

        const blob = await res.blob();
        return { blob, filename };
    }

    // ── Auth ───────────────────────────────────────────────
    async function login(email, password) {
        // Backend ожидает OAuth2 form-data: username + password
        const form = new FormData();
        form.append("username", email);
        form.append("password", password);

        const res = await fetch(BASE_URL + "/api/auth/login", {
            method: "POST",
            body: form
        });

        if (!res.ok) {
            let msg = "Неверный логин или пароль";
            try {
                const data = await res.json();
                msg = data.detail || msg;
            } catch {}
            throw new Error(msg);
        }

        const data = await res.json();
        setToken(data.access_token);
        return data;
    }

    async function register(body) {
        return request("POST", "/api/auth/register", body);
    }

    async function getMe() {
        return request("GET", "/api/users/me");
    }

    // ── Журналы ────────────────────────────────────────────
    async function getJournals(filters = {}) {
        const params = new URLSearchParams();
        if (filters.search)       params.append("search", filters.search);
        if (filters.semester)     params.append("semester", filters.semester);
        if (filters.group_name)   params.append("group_name", filters.group_name);
        if (filters.subject)      params.append("subject", filters.subject);
        if (filters.journal_type) params.append("journal_type", filters.journal_type);
        const qs = params.toString() ? `?${params}` : "";
        return request("GET", `/api/journals${qs}`);
    }

    async function getJournal(journalId) {
        return request("GET", `/api/journals/${journalId}`);
    }

    async function createJournal(body) {
        return request("POST", "/api/journals", body);
    }

    // ── Занятия ────────────────────────────────────────────
    async function getLessons(journalId) {
        return request("GET", `/api/journals/${journalId}/lessons`);
    }

    async function setLessonsCount(journalId, count) {
        const form = new FormData();
        form.append("count", count);
        return request("POST", `/api/journals/${journalId}/lessons/count`, form, true);
    }

    async function updateLessonDate(journalId, lessonId, lessonDate) {
    // lessonDate уже в формате YYYY-MM-DD из date picker
    // Отправляем как JSON, бэкенд ожидает date
    return request("PATCH", `/api/journals/${journalId}/lessons/${lessonId}`, { lesson_date: lessonDate });
    }

    // ── Студенты ───────────────────────────────────────────
    async function getStudents(journalId) {
        return request("GET", `/api/journals/${journalId}/students`);
    }

    async function addStudent(journalId, body) {
        return request("POST", `/api/journals/${journalId}/students`, body);
    }

    async function removeStudent(journalId, studentId) {
        return request("DELETE", `/api/journals/${journalId}/students/${studentId}`);
    }

    // ── Клетки (entries) ───────────────────────────────────
    async function getEntries(journalId) {
        return request("GET", `/api/journals/${journalId}/entries`);
    }

    async function upsertEntry(journalId, body) {
        // body: { lesson_id, student_id, grade, attendance }
        return request("PUT", `/api/journals/${journalId}/entries`, body);
    }

    async function deleteEntry(journalId, lessonId, studentId) {
        const form = new FormData();
        form.append("lesson_id", lessonId);
        form.append("student_id", studentId);
        return request("DELETE", `/api/journals/${journalId}/entries`, form, true);
    }

    // ── Импорт ─────────────────────────────────────────────
    async function importPreview(journalId, file, mappingJson) {
        const form = new FormData();
        form.append("file", file);
        form.append("mapping_json", JSON.stringify(mappingJson));
        return request("POST", `/api/journals/${journalId}/import/preview`, form, true);
    }

    async function importConfirm(journalId, importSessionId) {
        const form = new FormData();
        form.append("import_session_id", importSessionId);
        return request("POST", `/api/journals/${journalId}/import/confirm`, form, true);
    }

    // ── Экспорт ────────────────────────────────────────────
    async function exportXlsx(journalId) {
        return requestBlob(`/api/journals/${journalId}/export.xlsx`);
    }

    async function exportPdf(journalId) {
        return requestBlob(`/api/journals/${journalId}/export.pdf`);
    }

    // ── Утилиты ────────────────────────────────────────────
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return {
        getToken, setToken, clearToken,
        login, register, getMe,
        getJournals, getJournal, createJournal,
        getLessons, setLessonsCount, updateLessonDate,
        getStudents, addStudent, removeStudent,
        getEntries, upsertEntry, deleteEntry,
        importPreview, importConfirm,
        exportXlsx, exportPdf,
        downloadBlob
    };
})();