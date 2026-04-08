// students.js — исправленная версия

document.addEventListener("DOMContentLoaded", () => {
    const addStudentBtn = document.getElementById("addStudent");
    const studentInput = document.getElementById("studentName");
    
    // Проверяем, существуют ли элементы
    if (!addStudentBtn || !studentInput) {
        console.log("Students module: elements not found, skipping");
        return;
    }
    
    addStudentBtn.addEventListener("click", () => {
        const name = studentInput.value.trim();
        if (name === "") return;
        
        addStudentRow("attendanceTable", name);
        addStudentRow("gradesTable", name);
        
        studentInput.value = "";
    });
});

function addStudentRow(tableId, name) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    
    const columnCount = table.querySelectorAll("thead th").length;
    if (columnCount === 0) return;
    
    const row = document.createElement("tr");
    let html = `<td class="name">${name}</td>`;
    
    for (let i = 1; i < columnCount; i++) {
        html += `<td contenteditable="true"></td>`;
    }
    
    row.innerHTML = html;
    tbody.appendChild(row);
}