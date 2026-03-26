document.addEventListener("DOMContentLoaded", ()=>{
  
const createBtn = document.getElementById("createTableBtn");
const numInput = document.getElementById("numStudents");
const namesInput = document.getElementById("studentNames");

createBtn.addEventListener("click", ()=>{

  // Получаем данные
  let numStudents = parseInt(numInput.value) || 0;
  let names = namesInput.value.split(",").map(n=>n.trim()).filter(n=>n!=="");

  // Если не ввели имена, создаём авто
  if(names.length===0){
    names = Array.from({length:numStudents}, (_,i)=>`Студент ${i+1}`);
  }

  // Очищаем старые таблицы
  ["attendanceTable","gradesTable"].forEach(id=>{
    const table = document.getElementById(id);
    const tbody = table.querySelector("tbody");
    const thead = table.querySelector("thead tr");
    
    tbody.innerHTML = "";

    // Удаляем колонки занятий, оставляем только ФИО
    while(thead.children.length>1){
      thead.removeChild(thead.lastChild);
    }
  });

  // Добавляем студентов
  names.forEach(name=>{
    addStudentRow("attendanceTable", name);
    addStudentRow("gradesTable", name);
  });

  // Автоматически перейти на вкладку посещаемости
document.querySelector(".btn[data-page='attendance']")?.click();
});
});