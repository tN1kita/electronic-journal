// export.js — экспорт XLSX/PDF + импорт студентов из Excel

document.addEventListener("DOMContentLoaded", () => {

    // ── Экспорт XLSX ──
    const exportXlsxBtn = document.getElementById("exportXlsxBtn");
    exportXlsxBtn?.addEventListener("click", async () => {
        const id = window.currentJournalId;
        if (!id) { showToast("Откройте журнал перед экспортом", "error"); return; }
        exportXlsxBtn.disabled = true;
        try {
            const { blob, filename } = await API.exportXlsx(id);
            API.downloadBlob(blob, filename || `journal_${id}.xlsx`);
            showToast("Файл загружен", "success");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            exportXlsxBtn.disabled = false;
        }
    });

    // ── Экспорт PDF ──
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    exportPdfBtn?.addEventListener("click", async () => {
        const id = window.currentJournalId;
        if (!id) { showToast("Откройте журнал перед экспортом", "error"); return; }
        exportPdfBtn.disabled = true;
        try {
            const { blob, filename } = await API.exportPdf(id);
            API.downloadBlob(blob, filename || `journal_${id}.pdf`);
            showToast("Файл загружен", "success");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            exportPdfBtn.disabled = false;
        }
    });

    // ── Импорт студентов (2 шага) ──
    const importBtn   = document.getElementById("importBtn");
    const importModal = document.getElementById("importModal");

    importBtn?.addEventListener("click", () => {
        if (!window.currentJournalId) {
            showToast("Откройте журнал перед импортом", "error");
            return;
        }
        importModal?.classList.add("active");
        resetImportModal();
    });

    // Закрытие модалки
    document.getElementById("importCancelBtn")?.addEventListener("click", () => {
        importModal?.classList.remove("active");
    });

    // ── Шаг 1: Preview ──
    document.getElementById("importPreviewBtn")?.addEventListener("click", async () => {
        const fileInput = document.getElementById("importFileInput");
        const file = fileInput?.files[0];
        if (!file) { showToast("Выберите файл", "error"); return; }

        const mapping = {
            number_col:     parseInt(document.getElementById("mapNumber")?.value)     || 1,
            surname_col:    parseInt(document.getElementById("mapSurname")?.value)    || 2,
            name_col:       parseInt(document.getElementById("mapName")?.value)       || 3,
            patronymic_col: parseInt(document.getElementById("mapPatronymic")?.value) || 4,
            email_col:      parseInt(document.getElementById("mapEmail")?.value)      || 5,
            phone_col:      parseInt(document.getElementById("mapPhone")?.value)      || 6
        };

        const btn = document.getElementById("importPreviewBtn");
        btn.disabled = true;
        btn.textContent = "Загрузка…";

        try {
            const result = await API.importPreview(window.currentJournalId, file, mapping);
            window._importSessionId = result.import_session_id;
            renderImportPreview(result);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Предпросмотр";
        }
    });

    // ── Шаг 2: Confirm ──
    document.getElementById("importConfirmBtn")?.addEventListener("click", async () => {
        const sessionId = window._importSessionId;
        if (!sessionId) { showToast("Сначала выполните предпросмотр", "error"); return; }

        const btn = document.getElementById("importConfirmBtn");
        btn.disabled = true;
        btn.textContent = "Импортируем…";

        try {
            const result = await API.importConfirm(window.currentJournalId, sessionId);
            showToast(`Импортировано: ${result.imported} студентов`, "success");
            importModal?.classList.remove("active");

            // Обновляем таблицы
            const [journal, lessons, students] = await Promise.all([
                API.getJournal(window.currentJournalId),
                API.getLessons(window.currentJournalId),
                API.getStudents(window.currentJournalId)
            ]);
            window.currentJournalLessons  = lessons;
            window.currentJournalStudents = students;
            buildJournalTables(journal, lessons, students);

        } catch (err) {
            showToast(err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Подтвердить импорт";
        }
    });
});

function renderImportPreview(data) {
    const container = document.getElementById("importPreviewContainer");
    if (!container) return;

    const rows = data.preview_rows || [];
    const total = data.total_rows || rows.length;

    let html = `<p style="font-size:13px;color:var(--text-muted,rgba(255,255,255,.5))">
        Предпросмотр: первые ${rows.length} из ${total} строк
    </p>`;

    if (rows.length > 0) {
        html += `<div style="overflow-x:auto;"><table style="width:100%;font-size:13px;border-collapse:collapse;">
            <thead><tr>`;
        Object.keys(rows[0]).forEach(col => {
            html += `<th style="padding:6px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.1);white-space:nowrap;">${col}</th>`;
        });
        html += `</tr></thead><tbody>`;
        rows.forEach(row => {
            html += "<tr>";
            Object.values(row).forEach(val => {
                html += `<td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.06);">${val ?? ""}</td>`;
            });
            html += "</tr>";
        });
        html += `</tbody></table></div>`;
    } else {
        html += `<p style="color:#fc8181">Данные не найдены</p>`;
    }

    container.innerHTML = html;
    document.getElementById("importConfirmBtn").style.display = "inline-block";
}

function resetImportModal() {
    document.getElementById("importFileInput").value = "";
    document.getElementById("importPreviewContainer").innerHTML = "";
    document.getElementById("importConfirmBtn").style.display = "none";
    window._importSessionId = null;
}