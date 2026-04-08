// lessons.js — добавление занятий через API

document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll(".addLessonBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const journalId = window.currentJournalId;

            if (!journalId) {
                showToast("Сначала откройте или создайте журнал", "error");
                return;
            }

            const currentLessons = window.currentJournalLessons || [];
            const newCount       = currentLessons.length + 1;

            btn.disabled    = true;
            btn.textContent = "Добавляем…";

            try {
                await API.setLessonsCount(journalId, newCount);

                const [lessons, students] = await Promise.all([
                    API.getLessons(journalId),
                    API.getStudents(journalId)
                ]);
                const journal = window.currentJournalData;

                window.currentJournalLessons  = lessons;
                window.currentJournalStudents = students;

                // Сохраняем cellMap (не сбрасываем — данные уже есть)
                window.currentCellMap = window.currentCellMap || {};

                buildJournalTables(journal, lessons, students);
                showToast("Занятие добавлено", "success");

            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled    = false;
                btn.textContent = "+ Добавить занятие";
            }
        });
    });

});