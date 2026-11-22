
"use strict";

// ==========================================
// DASHBOARD - SỬ DỤNG API THỐNG KÊ TẬP TRUNG
// ==========================================

document.addEventListener("DOMContentLoaded", async function () {
    await initializeLayout("index", "Tổng quan hệ thống");

    const dateElement = document.getElementById("dashboard-date");

    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString("vi-VN", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    await loadDashboardData();
});


// ==========================================
// 1. TẢI DỮ LIỆU DASHBOARD
// ==========================================

async function loadDashboardData() {
    try {
        // Backend đã xử lý phân quyền và phạm vi dữ liệu.
        const statistics = await window.api.get("/dashboard");

        if (!statistics || typeof statistics !== "object") {
            throw new Error("Dữ liệu Dashboard không hợp lệ.");
        }

        renderStatistics(statistics);
        renderRecentAppointments(statistics.recent_appointments || []);
        renderPrescriptionSummary(statistics.prescription_status || []);
        applyDashboardRoleLayout(statistics.role);

    } catch (error) {
        console.error("Dashboard loading error:", error);

        renderDashboardError();

        showMessage(
            "Không thể tải dữ liệu Dashboard: " + error.message,
            "error"
        );
    }
}


// ==========================================
// 2. HIỂN THỊ CÁC THẺ THỐNG KÊ
// ==========================================

function renderStatistics(statistics) {
    const values = {
        "total-patients": statistics.total_patients,
        "total-doctors": statistics.total_doctors,
        "total-appointments": statistics.total_appointments,
        "total-prescriptions": statistics.total_prescriptions
    };

    Object.entries(values).forEach(([elementId, value]) => {
        const element = document.getElementById(elementId);

        if (element) {
            const number = Number(value);
            element.textContent = Number.isFinite(number) ? number : 0;
        }
    });
}


// ==========================================
// 3. HIỂN THỊ LỊCH HẸN GẦN ĐÂY
// ==========================================

function renderRecentAppointments(appointments) {
    const tbody = document.getElementById("recent-appointments");

    if (!tbody) return;

    if (!Array.isArray(appointments) || appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    Chưa có lịch hẹn nào
                </td>
            </tr>
        `;
        return;
    }

    // Backend đã sắp xếp mới nhất trước và giới hạn 10 lịch hẹn.
    // Dashboard chỉ hiển thị tối đa 5 dòng.
    tbody.innerHTML = appointments.slice(0, 5).map(item => `
        <tr>
            <td>${escapeHTML(item.ma_lich_hen || "—")}</td>
            <td>${escapeHTML(item.ten_benh_nhan || "—")}</td>
            <td>${escapeHTML(item.ten_bac_si || "—")}</td>
            <td>${escapeHTML(formatDateTime(item.thoi_gian_hen))}</td>
            <td>${getStatusBadge(item.trang_thai)}</td>
        </tr>
    `).join("");
}


// ==========================================
// 4. THỐNG KÊ TRẠNG THÁI ĐƠN THUỐC
// ==========================================

function renderPrescriptionSummary(statusList) {
    const container = document.getElementById("prescription-summary");

    if (!container) return;

    if (!Array.isArray(statusList) || statusList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Chưa có đơn thuốc nào</p>
            </div>
        `;
        return;
    }

    const totals = {
        Active: 0,
        Dispensed: 0,
        Cancelled: 0
    };

    statusList.forEach(item => {
        if (Object.prototype.hasOwnProperty.call(totals, item.trang_thai)) {
            const value = Number(item.total);
            totals[item.trang_thai] = Number.isFinite(value) ? value : 0;
        }
    });

    container.innerHTML = `
        <div class="stat-card" style="margin-bottom: 12px;">
            <div class="stat-top">
                <span class="stat-title">Đang hoạt động</span>
                ${getStatusBadge("Active")}
            </div>
            <div class="stat-value">${totals.Active}</div>
        </div>

        <div class="stat-card" style="margin-bottom: 12px;">
            <div class="stat-top">
                <span class="stat-title">Đã cấp phát</span>
                ${getStatusBadge("Dispensed")}
            </div>
            <div class="stat-value">${totals.Dispensed}</div>
        </div>

        <div class="stat-card">
            <div class="stat-top">
                <span class="stat-title">Đã hủy</span>
                ${getStatusBadge("Cancelled")}
            </div>
            <div class="stat-value">${totals.Cancelled}</div>
        </div>
    `;
}


// ==========================================
// 5. BỐ CỤC THEO VAI TRÒ ĐĂNG NHẬP
// ==========================================

function applyDashboardRoleLayout(role) {
    const statCards = document.querySelectorAll(".stats-grid > .stat-card");

    const appointmentPanel = document
        .getElementById("recent-appointments")
        ?.closest(".dashboard-panel");

    const prescriptionPanel = document
        .getElementById("prescription-summary")
        ?.closest(".dashboard-panel");

    const roleSettings = {
        Admin: {
            labels: [
                "Tổng bệnh nhân",
                "Tổng bác sĩ",
                "Tổng lịch hẹn",
                "Tổng đơn thuốc"
            ],
            descriptions: [
                "Toàn bộ bệnh nhân",
                "Đội ngũ bác sĩ",
                "Tất cả lịch hẹn khám",
                "Tất cả đơn thuốc"
            ],
            showPatients: true,
            showDoctors: true,
            showAppointments: true,
            showPrescriptions: true
        },

        Doctor: {
            labels: [
                "Bệnh nhân của tôi",
                "Thông tin bác sĩ",
                "Lịch hẹn của tôi",
                "Đơn thuốc của tôi"
            ],
            descriptions: [
                "Bệnh nhân đã đặt lịch với bạn",
                "Tài khoản bác sĩ hiện tại",
                "Lịch khám được phân công",
                "Đơn thuốc thuộc hồ sơ khám của bạn"
            ],
            showPatients: true,
            showDoctors: true,
            showAppointments: true,
            showPrescriptions: true
        },

        Receptionist: {
            labels: [
                "Tổng bệnh nhân",
                "Tổng bác sĩ",
                "Tổng lịch hẹn",
                "Tổng đơn thuốc"
            ],
            descriptions: [
                "Toàn bộ bệnh nhân",
                "Đội ngũ bác sĩ",
                "Tất cả lịch hẹn khám",
                "Không có quyền xem thống kê đơn thuốc"
            ],
            showPatients: true,
            showDoctors: true,
            showAppointments: true,
            showPrescriptions: false
        },

        Pharmacist: {
            labels: [
                "Tổng bệnh nhân",
                "Tổng bác sĩ",
                "Tổng lịch hẹn",
                "Tổng đơn thuốc"
            ],
            descriptions: [
                "Không áp dụng cho dược sĩ",
                "Không áp dụng cho dược sĩ",
                "Không áp dụng cho dược sĩ",
                "Toàn bộ đơn thuốc"
            ],
            showPatients: false,
            showDoctors: false,
            showAppointments: false,
            showPrescriptions: true
        },

        Patient: {
            labels: [
                "Hồ sơ bệnh nhân",
                "Bác sĩ từng khám",
                "Lịch hẹn của tôi",
                "Đơn thuốc của tôi"
            ],
            descriptions: [
                "Hồ sơ của tài khoản hiện tại",
                "Bác sĩ có lịch hẹn với bạn",
                "Lịch khám của bạn",
                "Đơn thuốc thuộc hồ sơ của bạn"
            ],
            showPatients: true,
            showDoctors: true,
            showAppointments: true,
            showPrescriptions: true
        }
    };

    const settings = roleSettings[role];

    if (!settings) return;

    const visibility = [
        settings.showPatients,
        settings.showDoctors,
        settings.showAppointments,
        settings.showPrescriptions
    ];

    statCards.forEach((card, index) => {
        if (index >= visibility.length) return;

        card.hidden = !visibility[index];

        const title = card.querySelector(".stat-title");
        const description = card.querySelector(".stat-description");

        if (title) {
            title.textContent = settings.labels[index];
        }

        if (description) {
            description.textContent = settings.descriptions[index];
        }
    });

    if (appointmentPanel) {
        appointmentPanel.hidden = !settings.showAppointments;
    }

    if (prescriptionPanel) {
        prescriptionPanel.hidden = !settings.showPrescriptions;
    }

    // Ẩn thao tác nhanh không phù hợp với vai trò.
    const quickActionRules = {
        "patients.html": ["Admin", "Doctor", "Receptionist"],
        "doctors.html": ["Admin", "Doctor", "Receptionist"],
        "appointments.html": [
            "Admin",
            "Doctor",
            "Receptionist",
            "Patient"
        ]
    };

    document.querySelectorAll(".quick-actions a.quick-action").forEach(link => {
        const href = link.getAttribute("href") || "";
        const page = href.split("/").pop();
        const allowedRoles = quickActionRules[page];

        if (allowedRoles) {
            link.hidden = !allowedRoles.includes(role);
        }
    });

    const quickActions = document.querySelector(".quick-actions");
    const quickActionsPanel = quickActions?.closest(".dashboard-panel");

    if (quickActions && quickActionsPanel) {
        const hasVisibleAction = Array.from(
            quickActions.querySelectorAll("a.quick-action")
        ).some(link => !link.hidden);

        quickActionsPanel.hidden = !hasVisibleAction;
    }
}


// ==========================================
// 6. HIỂN THỊ LỖI TẢI DỮ LIỆU
// ==========================================

function renderDashboardError() {
    const ids = [
        "total-patients",
        "total-doctors",
        "total-appointments",
        "total-prescriptions"
    ];

    ids.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = "—";
        }
    });

    const appointmentBody = document.getElementById("recent-appointments");

    if (appointmentBody) {
        appointmentBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    Không thể tải dữ liệu lịch hẹn
                </td>
            </tr>
        `;
    }

    const prescriptionSummary = document.getElementById("prescription-summary");

    if (prescriptionSummary) {
        prescriptionSummary.innerHTML = `
            <div class="empty-state">
                <p>Không thể tải dữ liệu đơn thuốc</p>
            </div>
        `;
    }
}
