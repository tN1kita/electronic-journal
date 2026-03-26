// toast.js — универсальные уведомления (используется всеми модулями)

function showToast(message, type = "info", duration = 3500) {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.style.cssText = `
        padding: 12px 18px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        color: #fff;
        max-width: 320px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.25s ease;
        pointer-events: auto;
        background: ${type === "error" ? "#e53e3e" : type === "success" ? "#38a169" : "#3182ce"};
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, duration);
}