
/* ==========================================
   APPOINTMENTS - GLOBAL DATA
========================================== */

let appointments = [];
let patients = [];
let doctors = [];

let selectedDeleteAppointmentId = null;
let currentAppointmentRole = "";

function normalizeAppointmentRole(role) {
    return String(role || "").trim().toLowerCase();
}

function canAppointmentAction(action) {
    const role = currentAppointmentRole;

    const permissions = {
        create: ["admin", "receptionist", "patient"],
        status: ["admin", "doctor"],
        delete: ["admin", "receptionist"]
    };

    return (permissions[action] || []).includes(role);
}

function applyAppointmentPagePermissions() {
    const addButton = $("#btn-add-appointment");
    if (addButton) addButton.hidden = !canAppointmentAction("create");

    // Bệnh nhân tự đặt lịch cho chính mình; không cần chọn bệnh nhân.
    const patientSelect = $("#ma_benh_nhan");
    if (patientSelect) {
        const isPatient = currentAppointmentRole === "patient";
        const patientGroup = patientSelect.closest(".form-group");
        if (patientGroup) patientGroup.hidden = isPatient;
        // Backend tự lấy mã bệnh nhân từ session đối với Patient.
        patientSelect.required = !isPatient;
        patientSelect.disabled = isPatient;
    }
}


/* ==========================================
   DOM HELPERS
========================================== */

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatAppointmentDate(value) {
    if (!value) return "--";

    // API trả DATETIME của MySQL dưới dạng chuỗi GMT.
    // Lấy trực tiếp giờ trong chuỗi để tránh cộng thêm 7 tiếng.
    const match = String(value).match(
        /(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
    );

    if (!match) return "--";

    const months = {
        Jan: "01", Feb: "02", Mar: "03",
        Apr: "04", May: "05", Jun: "06",
        Jul: "07", Aug: "08", Sep: "09",
        Oct: "10", Nov: "11", Dec: "12"
    };

    const [, day, month, year, hour, minute] = match;

    return `${hour}:${minute} ${day.padStart(2, "0")}/${months[month]}/${year}`;
}

function formatDateForInput(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateForAPI(value) {
    if (!value) return "";

    // datetime-local có định dạng YYYY-MM-DDTHH:mm.
    // Chuyển thành định dạng DATETIME của MySQL.
    return value.replace("T", " ") + ":00";
}

function showPageMessage(message, type = "success") {
    const container = $("#message");

    if (!container) return;

    const colors = {
        success: "#16a783",
        error: "#e34b4b",
        warning: "#e99a32"
    };

    container.innerHTML = `
        <div style="
            padding: 13px 16px;
            margin-bottom: 15px;
            border-radius: 8px;
            background: #ffffff;
            border-left: 4px solid ${colors[type] || colors.success};
            color: #18334a;
            font-size: 13px;
        ">
            ${escapeHTML(message)}
        </div>
    `;

    container.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function showFormMessage(message, type = "error") {
    const container = $("#appointment-form-message");

    if (!container) return;

    const color = type === "success" ? "#16a783" : "#e34b4b";

    container.innerHTML = `
        <div style="
            padding: 12px;
            margin-bottom: 15px;
            border-radius: 8px;
            background: #fff;
            border-left: 4px solid ${color};
            color: #18334a;
            font-size: 13px;
        ">
            ${escapeHTML(message)}
        </div>
    `;
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal) {
        modal.classList.add("show");
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);

    if (modal) {
        modal.classList.remove("show");
    }
}


/* ==========================================
   STATUS HELPERS
========================================== */

const STATUS_LABELS = {
    "Scheduled": "Đang chờ",
    "In-Consultation": "Đang khám",
    "Referred": "Đã chuyển tuyến",
    "Completed": "Đã hoàn thành",
    "Cancelled": "Đã hủy",
    "No-Show": "Không đến"
};

const STATUS_CLASSES = {
    "Scheduled": "scheduled",
    "In-Consultation": "in-consultation",
    "Referred": "referred",
    "Completed": "completed",
    "Cancelled": "cancelled",
    "No-Show": "no-show"
};

function getStatusBadge(status) {
    const label = STATUS_LABELS[status] || status;
    const className = STATUS_CLASSES[status] || "";

    return `
        <span class="appointment-status ${className}">
            ${escapeHTML(label)}
        </span>
    `;
}

function getTypeBadge(type) {
    if (type === "Telemedicine") {
        return `
            <span class="appointment-type telemedicine">
                Khám từ xa
            </span>
        `;
    }

    return `
        <span class="appointment-type in-clinic">
            Khám trực tiếp
        </span>
    `;
}

/*
    Chỉ hiển thị các trạng thái hợp lệ theo trigger MySQL.
*/

function getNextStatuses(currentStatus) {
    const transitions = {
        "Scheduled": [
            "In-Consultation",
            "Cancelled",
            "No-Show"
        ],

        "In-Consultation": [
            "Referred",
            "Completed"
        ]
    };

    return transitions[currentStatus] || [];
}


/* ==========================================
   INITIALIZE PAGE
========================================== */

document.addEventListener("DOMContentLoaded", async function () {

    if (typeof initializeLayout === "function") {
        await initializeLayout(
            "appointments",
            "Quản lý lịch hẹn"
        );
    }

    if (typeof window.getCurrentAccount === "function") {
        const account = await window.getCurrentAccount();
        currentAppointmentRole = normalizeAppointmentRole(
            account?.vai_tro || account?.role
        );
    }

    applyAppointmentPagePermissions();
    initializeAppointmentEvents();

    await loadAppointments();
});


/* ==========================================
   LOAD APPOINTMENTS
========================================== */

async function loadAppointments() {
    const table = $("#appointments-table");

    table.innerHTML = `
        <tr>
            <td colspan="8" style="text-align:center;">
                Đang tải dữ liệu...
            </td>
        </tr>
    `;

    try {
        appointments = await window.api.get("/appointments");

        if (!Array.isArray(appointments)) {
            appointments = [];
        }

        renderAppointmentStats();
        renderAppointments();

    } catch (error) {
        table.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;color:#e34b4b;">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        showPageMessage(
            error.message || "Không thể tải danh sách lịch hẹn.",
            "error"
        );
    }
}


/* ==========================================
   RENDER STATISTICS
========================================== */

function renderAppointmentStats() {
    const total = appointments.length;

    const completed = appointments.filter(
        item => item.trang_thai === "Completed"
    ).length;

    const scheduled = appointments.filter(
        item => item.trang_thai === "Scheduled"
    ).length;

    const cancelled = appointments.filter(
        item => item.trang_thai === "Cancelled"
    ).length;

    $("#total-appointments").textContent = total;
    $("#completed-appointments").textContent = completed;
    $("#scheduled-appointments").textContent = scheduled;
    $("#cancelled-appointments").textContent = cancelled;
}


/* ==========================================
   RENDER APPOINTMENT TABLE
========================================== */

function renderAppointments() {
    const table = $("#appointments-table");

    const keyword = $("#search-appointment").value
        .trim()
        .toLowerCase();

    const statusFilter = $("#filter-status").value;
    const typeFilter = $("#filter-type").value;

    const filteredAppointments = appointments.filter(item => {

        const searchableText = [
            item.ma_lich_hen,
            item.ma_benh_nhan,
            item.ten_benh_nhan,
            item.ma_bac_si,
            item.ten_bac_si
        ].join(" ").toLowerCase();

        const matchesKeyword = searchableText.includes(keyword);

        const matchesStatus = !statusFilter ||
            item.trang_thai === statusFilter;

        const matchesType = !typeFilter ||
            item.loai_hinh_kham === typeFilter;

        return matchesKeyword &&
            matchesStatus &&
            matchesType;
    });

    $("#appointment-result-count").textContent =
        `${filteredAppointments.length} / ${appointments.length} lịch hẹn`;

    if (filteredAppointments.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;padding:30px;">
                    Không tìm thấy lịch hẹn phù hợp.
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML = filteredAppointments.map((item, index) => {

        const nextStatuses = getNextStatuses(item.trang_thai);

        const statusButton = canAppointmentAction("status") && nextStatuses.length > 0
            ? `
                <button
                    type="button"
                    class="action-status"
                    data-action="status"
                    data-id="${escapeHTML(item.ma_lich_hen)}"
                    title="Cập nhật trạng thái"
                >
                    ↻
                </button>
            `
            : "";

        const deleteButton = canAppointmentAction("delete")
            ? `
                <button
                    type="button"
                    class="action-delete"
                    data-action="delete"
                    data-id="${escapeHTML(item.ma_lich_hen)}"
                    title="Xóa lịch hẹn"
                >
                    ✕
                </button>
            `
            : "";

        return `
            <tr>

                <td>${index + 1}</td>

                <td>
                    <span class="appointment-code">
                        ${escapeHTML(item.ma_lich_hen)}
                    </span>
                </td>

                <td>
                    <span class="appointment-person">
                        ${escapeHTML(item.ten_benh_nhan)}
                    </span>

                    <span class="appointment-subtext">
                        ${escapeHTML(item.ma_benh_nhan)}
                    </span>
                </td>

                <td>
                    <span class="appointment-person">
                        ${escapeHTML(item.ten_bac_si)}
                    </span>

                    <span class="appointment-subtext">
                        ${escapeHTML(item.ma_bac_si)}
                    </span>
                </td>

                <td>
                    <span class="appointment-date">
                        ${escapeHTML(formatAppointmentDate(item.thoi_gian_hen))}
                    </span>
                </td>

                <td>
                    ${getTypeBadge(item.loai_hinh_kham)}
                </td>

                <td>
                    ${getStatusBadge(item.trang_thai)}
                </td>

                <td>
                    <div class="appointment-actions">

                        <button
                            type="button"
                            class="action-view"
                            data-action="view"
                            data-id="${escapeHTML(item.ma_lich_hen)}"
                            title="Xem chi tiết"
                        >
                            👁
                        </button>

                        ${statusButton}

                        ${deleteButton}

                    </div>
                </td>

            </tr>
        `;

    }).join("");
}

/* ==========================================
   LOAD FORM OPTIONS
========================================== */

async function loadAppointmentOptions() {

    try {
        const result = await window.api.get("/appointments/options");

        patients = result.patients || [];
        doctors = result.doctors || [];

        renderPatientOptions();
        renderDoctorOptions();

    } catch (error) {
        showFormMessage(
            "Không thể tải danh sách bệnh nhân và bác sĩ: " +
            error.message
        );

        throw error;
    }
}

function renderPatientOptions() {
    const select = $("#ma_benh_nhan");

    select.innerHTML = `
        <option value="">-- Chọn bệnh nhân --</option>
        ${patients.map(patient => `
            <option value="${escapeHTML(patient.ma_benh_nhan)}">
                ${escapeHTML(patient.ho_va_ten)}
                (${escapeHTML(patient.ma_benh_nhan)})
            </option>
        `).join("")}
    `;
}

function renderDoctorOptions() {
    const select = $("#ma_bac_si");

    select.innerHTML = `
        <option value="">-- Chọn bác sĩ --</option>
        ${doctors.map(doctor => `
            <option value="${escapeHTML(doctor.ma_bac_si)}">
                ${escapeHTML(doctor.ho_va_ten)}
                (${escapeHTML(doctor.ma_bac_si)})
                - ${doctor.loai_bac_si === "GP"
                    ? "Bác sĩ đa khoa"
                    : "Bác sĩ chuyên khoa"}
            </option>
        `).join("")}
    `;
}


/* ==========================================
   OPEN APPOINTMENT FORM
========================================== */

async function openAppointmentForm() {

    if (!canAppointmentAction("create")) return;

    $("#appointment-form").reset();

    $("#appointment-form-message").innerHTML = "";

    $("#appointment-form-title").textContent =
        "Đặt lịch khám mới";

    $("#save-appointment").textContent = "Đặt lịch";

    $("#telemedicine-fields").classList.add("hidden");

    setTelemedicineRequired(false);

    showModal("appointment-form-modal");

    try {
        await loadAppointmentOptions();
    } catch (error) {
        console.error(error);
    }
}


/* ==========================================
   TELEMEDICINE FORM
========================================== */

function setTelemedicineRequired(required) {

    $("#ma_phien_kham").required = required;
    $("#duong_dan_video").required = required;
    $("#khoa_ma_hoa").required = required;
}

function toggleTelemedicineFields() {

    const type = $("#loai_hinh_kham").value;

    const fields = $("#telemedicine-fields");

    const isTelemedicine = type === "Telemedicine";

    fields.classList.toggle(
        "hidden",
        !isTelemedicine
    );

    setTelemedicineRequired(isTelemedicine);
}


/* ==========================================
   CREATE APPOINTMENT
========================================== */

async function submitAppointment(event) {

    event.preventDefault();

    if (!canAppointmentAction("create")) {
        showFormMessage("Bạn không có quyền đặt lịch hẹn.");
        return;
    }

    const button = $("#save-appointment");

    if (!$("#appointment-form").reportValidity()) {
        return;
    }

    const appointmentType = $("#loai_hinh_kham").value;

    const appointmentData = {
        ma_lich_hen: $("#ma_lich_hen").value.trim(),

        ma_benh_nhan: $("#ma_benh_nhan").value,

        ma_bac_si: $("#ma_bac_si").value,

        thoi_gian_hen: formatDateForAPI(
            $("#thoi_gian_hen").value
        ),

        loai_hinh_kham: appointmentType,

        ma_phien_kham: null,
        duong_dan_video: null,
        khoa_ma_hoa: null
    };

    if (appointmentType === "Telemedicine") {

        appointmentData.ma_phien_kham =
            $("#ma_phien_kham").value.trim();

        appointmentData.duong_dan_video =
            $("#duong_dan_video").value.trim();

        appointmentData.khoa_ma_hoa =
            $("#khoa_ma_hoa").value.trim();
    }

    button.disabled = true;
    button.textContent = "Đang xử lý...";

    try {

        await window.api.post(
            "/appointments",
            appointmentData
        );

        hideModal("appointment-form-modal");

        showPageMessage(
            "Đặt lịch khám thành công.",
            "success"
        );

        await loadAppointments();

    } catch (error) {

        showFormMessage(
            error.message || "Không thể đặt lịch khám."
        );

    } finally {

        button.disabled = false;
        button.textContent = "Đặt lịch";
    }
}


/* ==========================================
   VIEW APPOINTMENT DETAIL
========================================== */

async function viewAppointment(appointmentId) {

    try {

        const item = await window.api.get(
            `/appointments/${encodeURIComponent(appointmentId)}`
        );

        $("#appointment-detail").innerHTML = `

            <div class="appointment-detail-grid">

                <div class="appointment-detail-item">
                    <span>Mã lịch hẹn</span>
                    <strong>${escapeHTML(item.ma_lich_hen)}</strong>
                </div>

                <div class="appointment-detail-item">
                    <span>Thời gian khám</span>
                    <strong>
                        ${escapeHTML(formatAppointmentDate(item.thoi_gian_hen))}
                    </strong>
                </div>

                <div class="appointment-detail-item">
                    <span>Bệnh nhân</span>
                    <strong>
                        ${escapeHTML(item.ten_benh_nhan)}
                    </strong>
                    <span>${escapeHTML(item.ma_benh_nhan)}</span>
                </div>

                <div class="appointment-detail-item">
                    <span>Bác sĩ</span>
                    <strong>
                        ${escapeHTML(item.ten_bac_si)}
                    </strong>
                    <span>${escapeHTML(item.ma_bac_si)}</span>
                </div>

                <div class="appointment-detail-item">
                    <span>Loại hình khám</span>
                    <strong>
                        ${item.loai_hinh_kham === "Telemedicine"
                            ? "Khám từ xa"
                            : "Khám trực tiếp"}
                    </strong>
                </div>

                <div class="appointment-detail-item">
                    <span>Trạng thái</span>
                    ${getStatusBadge(item.trang_thai)}
                </div>

            </div>
        `;

        showModal("appointment-detail-modal");

    } catch (error) {

        showPageMessage(
            error.message || "Không thể lấy chi tiết lịch hẹn.",
            "error"
        );
    }
}


/* ==========================================
   OPEN STATUS MODAL
========================================== */

function openStatusModal(appointmentId) {

    if (!canAppointmentAction("status")) return;

    const appointment = appointments.find(
        item => item.ma_lich_hen === appointmentId
    );

    if (!appointment) return;

    const nextStatuses = getNextStatuses(
        appointment.trang_thai
    );

    if (nextStatuses.length === 0) {
        showPageMessage(
            "Lịch hẹn này không còn trạng thái tiếp theo hợp lệ.",
            "warning"
        );

        return;
    }

    $("#status-appointment-id").value = appointmentId;

    const select = $("#new-appointment-status");

    select.innerHTML = nextStatuses.map(status => `
        <option value="${status}">
            ${STATUS_LABELS[status]}
        </option>
    `).join("");

    showModal("appointment-status-modal");
}


/* ==========================================
   UPDATE APPOINTMENT STATUS
========================================== */

async function submitAppointmentStatus(event) {

    event.preventDefault();

    if (!canAppointmentAction("status")) {
        showPageMessage("Bạn không có quyền cập nhật trạng thái lịch hẹn.", "error");
        return;
    }

    const appointmentId = $("#status-appointment-id").value;

    const newStatus = $("#new-appointment-status").value;

    const button = $("#save-appointment-status");

    button.disabled = true;
    button.textContent = "Đang cập nhật...";

    try {

        await window.api.put(
            `/appointments/${encodeURIComponent(appointmentId)}/status`,
            {
                trang_thai: newStatus
            }
        );

        hideModal("appointment-status-modal");

        showPageMessage(
            "Cập nhật trạng thái lịch hẹn thành công."
        );

        await loadAppointments();

    } catch (error) {

        showPageMessage(
            error.message || "Không thể cập nhật trạng thái.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Cập nhật";
    }
}

/* ==========================================
   OPEN DELETE MODAL
========================================== */

function openDeleteAppointmentModal(appointmentId) {

    if (!canAppointmentAction("delete")) return;

    const appointment = appointments.find(
        item => item.ma_lich_hen === appointmentId
    );

    if (!appointment) return;

    selectedDeleteAppointmentId = appointmentId;

    $("#delete-appointment-id").value = appointmentId;

    $("#delete-appointment-name").textContent =
        appointmentId;

    showModal("delete-appointment-modal");
}


/* ==========================================
   DELETE APPOINTMENT
========================================== */

async function confirmDeleteAppointment() {

    if (!canAppointmentAction("delete")) return;
    if (!selectedDeleteAppointmentId) return;

    const button = $("#confirm-delete-appointment");

    button.disabled = true;
    button.textContent = "Đang xóa...";

    try {

        await window.api.delete(
            `/appointments/${encodeURIComponent(selectedDeleteAppointmentId)}`
        );

        hideModal("delete-appointment-modal");

        selectedDeleteAppointmentId = null;

        showPageMessage(
            "Xóa lịch hẹn thành công."
        );

        await loadAppointments();

    } catch (error) {

        hideModal("delete-appointment-modal");

        showPageMessage(
            error.message ||
            "Không thể xóa lịch hẹn. Lịch hẹn có thể đang được hồ sơ bệnh án sử dụng.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Xóa lịch hẹn";
    }
}


/* ==========================================
   CLOSE MODALS
========================================== */

function closeAppointmentModals() {

    hideModal("appointment-form-modal");
    hideModal("appointment-detail-modal");
    hideModal("appointment-status-modal");
    hideModal("delete-appointment-modal");
}


/* ==========================================
   INITIALIZE EVENTS
========================================== */

function initializeAppointmentEvents() {

    // Thêm lịch hẹn
    const addButton = $("#btn-add-appointment");
    if (addButton) {
        addButton.addEventListener("click", openAppointmentForm);
    }

    // Tìm kiếm
    $("#search-appointment").addEventListener(
        "input",
        renderAppointments
    );

    // Lọc trạng thái
    $("#filter-status").addEventListener(
        "change",
        renderAppointments
    );

    // Lọc loại hình
    $("#filter-type").addEventListener(
        "change",
        renderAppointments
    );

    // Làm mới
    $("#refresh-appointments").addEventListener(
        "click",
        loadAppointments
    );

    // Loại hình khám từ xa
    $("#loai_hinh_kham").addEventListener(
        "change",
        toggleTelemedicineFields
    );

    // Submit đặt lịch
    $("#appointment-form").addEventListener(
        "submit",
        submitAppointment
    );

    // Submit cập nhật trạng thái
    $("#appointment-status-form").addEventListener(
        "submit",
        submitAppointmentStatus
    );

    // Xác nhận xóa
    $("#confirm-delete-appointment").addEventListener(
        "click",
        confirmDeleteAppointment
    );

    // Đóng modal thêm lịch
    $("#close-appointment-form").addEventListener(
        "click",
        () => hideModal("appointment-form-modal")
    );

    $("#cancel-appointment-form").addEventListener(
        "click",
        () => hideModal("appointment-form-modal")
    );

    // Đóng modal chi tiết
    $("#close-appointment-detail").addEventListener(
        "click",
        () => hideModal("appointment-detail-modal")
    );

    // Đóng modal trạng thái
    $("#close-appointment-status").addEventListener(
        "click",
        () => hideModal("appointment-status-modal")
    );

    $("#cancel-appointment-status").addEventListener(
        "click",
        () => hideModal("appointment-status-modal")
    );

    // Đóng modal xóa
    $("#close-delete-appointment").addEventListener(
        "click",
        () => hideModal("delete-appointment-modal")
    );

    $("#cancel-delete-appointment").addEventListener(
        "click",
        () => hideModal("delete-appointment-modal")
    );

    // Đóng modal khi bấm vùng bên ngoài
    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                modal.classList.remove("show");
            }

        });

    });

    // Xử lý nút thao tác trong bảng
    $("#appointments-table").addEventListener(
        "click",
        function (event) {

            const button = event.target.closest("button[data-action]");

            if (!button) return;

            const action = button.dataset.action;
            const appointmentId = button.dataset.id;

            if (action === "view") {
                viewAppointment(appointmentId);
            }

            if (action === "status") {
                openStatusModal(appointmentId);
            }

            if (action === "delete") {
                openDeleteAppointmentModal(appointmentId);
            }

        }
    );

}
