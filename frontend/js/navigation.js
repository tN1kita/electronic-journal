// navigation.js

const buttons = document.querySelectorAll(".btn[data-page]");
const pages   = document.querySelectorAll(".page");

buttons.forEach(button => {
    button.addEventListener("click", () => {
        if (button.hasAttribute("disabled")) return;

        document.querySelector(".btn.active")?.classList.remove("active");
        button.classList.add("active");

        const page = button.dataset.page;
        pages.forEach(p => p.classList.remove("active"));
        document.getElementById(page)?.classList.add("active");

        document.dispatchEvent(new CustomEvent("pagechange", { detail: { page } }));
    });
});