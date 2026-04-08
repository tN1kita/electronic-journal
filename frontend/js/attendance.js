// attendance.js — навигация по таблице посещаемости (без изменений)
// Сохранение клеток теперь в journalBuilder.js через API

const attendanceTable = document.getElementById("attendanceTable");

function navigateTable(table, cell, key) {
    const row = cell.parentElement;
    const allRows = Array.from(table.querySelectorAll("tbody tr"));
    const allCells = Array.from(row.querySelectorAll("td"));
    const rowIndex = allRows.indexOf(row);
    const colIndex = allCells.indexOf(cell);
    let targetCell = null;

    if (key === "ARROWRIGHT" || key === "TAB") {
        targetCell = allCells[colIndex + 1];
        if (!targetCell && allRows[rowIndex + 1]) {
            targetCell = allRows[rowIndex + 1].querySelectorAll("td")[1];
        }
    } else if (key === "ARROWLEFT") {
        if (colIndex > 1) targetCell = allCells[colIndex - 1];
    } else if (key === "ARROWDOWN" || key === "ENTER") {
        if (allRows[rowIndex + 1]) {
            targetCell = allRows[rowIndex + 1].querySelectorAll("td")[colIndex];
        }
    } else if (key === "ARROWUP") {
        if (allRows[rowIndex - 1]) {
            targetCell = allRows[rowIndex - 1].querySelectorAll("td")[colIndex];
        }
    }

    if (targetCell && targetCell.isContentEditable) {
        targetCell.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(targetCell);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

attendanceTable?.addEventListener("keydown", (e) => {
    const cell = e.target;
    if (!cell.isContentEditable) return;
    const key = e.key.toUpperCase();

    if (["ARROWUP", "ARROWDOWN", "ARROWLEFT", "ARROWRIGHT", "TAB", "ENTER"].includes(key)) {
        e.preventDefault();
        if (key === "ENTER" && cell.innerText.trim() === "") {
            cell.innerText = "П";
            cell.dispatchEvent(new Event("input", { bubbles: true }));
        }
        navigateTable(attendanceTable, cell, key);
        return;
    }

    // Разрешаем только П, Н, Б, Backspace, Delete
    // (По ТЗ бэкенд принимает П/Н/Б, не П/Н/С)
    if (!["П", "Н", "Б", "BACKSPACE", "DELETE"].includes(key)) {
        e.preventDefault();
    }
});