document.addEventListener("DOMContentLoaded", () => {

const attendanceTable = document.getElementById("attendanceTable");
const gradesTable = document.getElementById("gradesTable");

function updateAttendanceCell(cell){

if(!cell) return;

const val = cell.innerText.trim().toUpperCase();

cell.classList.remove("status-P","status-H","status-S");

if(val === "П") cell.classList.add("status-P");
else if(val === "Н") cell.classList.add("status-H");
else if(val === "С") cell.classList.add("status-S");

}


function updateGradeCell(cell){

if(!cell) return;

const val = cell.innerText.trim();

cell.classList.remove("grade-1","grade-2","grade-3","grade-4","grade-5");

if(["1","2","3","4","5"].includes(val)){
cell.classList.add("grade-" + val);
}

}

/* Реакция на ввод */
if(attendanceTable){
attendanceTable.addEventListener("input", e=>{
updateAttendanceCell(e.target);
});
}

if(gradesTable){
gradesTable.addEventListener("input", e=>{
updateGradeCell(e.target);
});
}

/* Цвета при загрузке */
document.querySelectorAll("#attendanceTable td").forEach(updateAttendanceCell);
document.querySelectorAll("#gradesTable td").forEach(updateGradeCell);

});