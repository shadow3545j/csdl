
"use strict";

// ==========================================
// 1. CHUYỂN ĐỔI HTML AN TOÀN
// ==========================================

function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


// ==========================================
// 2. ĐỊNH DẠNG NGÀY GIỜ
// ==========================================

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("vi-VN");
}

function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleString("vi-VN");
}


// ==========================================
// 3. NHÃN TRẠNG THÁI
// ==========================================

function getStatusBadge(status) {

    const statusMap = {
        "Scheduled": ["Chờ khám", "status-scheduled"],
        "In-Consultation": ["Đang khám", "status-processing"],
        "Completed": ["Hoàn thành", "status-success"],
        "Cancelled": ["Đã hủy", "status-danger"],
        "No-Show": ["Không đến", "status-warning"],
        "Referred": ["Đã chuyển tuyến", "status-info"],

        "Draft": ["Bản nháp", "status-warning"],
        "Finalized": ["Đã hoàn tất", "status-success"],

        "Active": ["Đang hoạt động", "status-info"],
        "Dispensed": ["Đã cấp phát", "status-success"]
    };

    const item = statusMap[status] || [
        status || "Không xác định",
        "status-default"
    ];

    return `
        <span class="status-badge ${item[1]}">
            ${escapeHTML(item[0])}
        </span>
    `;
}


// ==========================================
// 4. THÔNG BÁO
// ==========================================

function showMessage(message, type = "success") {

    let container = document.getElementById("message-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "message-container";
        document.body.appendChild(container);
    }

    const notification = document.createElement("div");

    notification.className = `message message-${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("message-hide");

        setTimeout(() => notification.remove(), 300);

    }, 3500);
}


// ==========================================
// 5. TẢI COMPONENT
// ==========================================

async function loadComponent(elementId, filePath) {

    const element = document.getElementById(elementId);

    if (!element) return;

    try {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Không tải được ${filePath}`);
        }

        element.innerHTML = await response.text();

    } catch (error) {
        console.error(error);

        element.innerHTML = `
            <div class="component-error">
                Không thể tải thành phần giao diện.
            </div>
        `;
    }
}


// ==========================================
// 6. KHỞI TẠO LAYOUT
// ==========================================


// ==========================================
// 6. KHỞI TẠO LAYOUT
// ==========================================

async function initializeLayout(pageName = "", pageTitle = "") {

    // Tải Sidebar, Navbar và Footer trước
    await Promise.all([
        loadComponent(
            "sidebar-container",
            "/components/sidebar.html"
        ),

        loadComponent(
            "navbar-container",
            "/components/navbar.html"
        ),

        loadComponent(
            "footer-container",
            "/components/footer.html"
        )
    ]);

    // Lấy tài khoản và áp dụng phân quyền sau khi Sidebar đã tải
    if (typeof window.getCurrentAccount === "function") {
        await window.getCurrentAccount(true);
    }

    if (typeof window.applyRolePermissions === "function") {
        window.applyRolePermissions();
    }

    let currentPage = pageName;

    if (!currentPage) {
        currentPage = window.location.pathname
            .split("/")
            .pop()
            .replace(".html", "");
    }

    if (!currentPage || currentPage === "dashboard") {
        currentPage = "index";
    }

    // Đánh dấu trang đang mở
    document.querySelectorAll(".sidebar-link").forEach(link => {

        const href = link.getAttribute("href");

        if (!href) return;

        const linkPage = href
            .split("/")
            .pop()
            .replace(".html", "");

        const isActive =
            linkPage === currentPage ||
            (currentPage === "index" && linkPage === "dashboard");

        link.classList.toggle("active", isActive);
    });

    // Hiển thị ngày hiện tại
    const dateElement = document.getElementById("current-date");

    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString(
            "vi-VN",
            {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );
    }

    // Tiêu đề trang
    if (pageTitle) {
        document.title = `${pageTitle} | Healthcare Clinic`;
    }
}



// ==========================================
// 7. EXPORT
// ==========================================

window.escapeHTML = escapeHTML;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.getStatusBadge = getStatusBadge;
window.showMessage = showMessage;
window.loadComponent = loadComponent;
window.initializeLayout = initializeLayout;
