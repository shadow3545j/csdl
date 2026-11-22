
"use strict";

// =====================================================
// 1. KHAI BÁO BIẾN
// =====================================================

let doctors = [];
let specialties = [];
let currentDoctorId = null;

const doctorApi = window.api;


// =====================================================
// 2. HÀM HỖ TRỢ
// =====================================================

function getElement(id) {
    return document.getElementById(id);
}

function canDoctorAction(permission) {
    return (
        typeof window.can === "function" &&
        window.can(permission)
    );
}

function getDoctorTypeLabel(type) {
    if (type === "GP") return "Bác sĩ đa khoa";
    if (type === "Specialist") return "Bác sĩ chuyên khoa";
    return type || "—";
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString("vi-VN") + " ₫";
}

function showDoctorMessage(message, type = "success") {
    if (typeof showMessage === "function") {
        showMessage(message, type);
    } else {
        alert(message);
    }
}

function getDoctorById(id) {
    return doctors.find(
        doctor => doctor.ma_bac_si === id
    );
}

function closeModal(modalId) {
    const modal = getElement(modalId);

    if (modal) {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
    }

    if (
        !document.querySelector(".modal.show")
    ) {
        document.body.style.overflow = "";
    }
}

function openModal(modalId) {
    const modal = getElement(modalId);

    if (modal) {
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }
}


// =====================================================
// 3. TẢI DANH SÁCH BÁC SĨ
// =====================================================

async function loadDoctors() {

    const table = getElement("doctors-table");

    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Đang tải dữ liệu...
                </td>
            </tr>
        `;
    }

    try {

        const result = await doctorApi.get("/doctors");

        doctors = Array.isArray(result) ? result : [];

        renderDoctors();
        renderStatistics();

    } catch (error) {

        console.error(
            "Lỗi tải danh sách bác sĩ:",
            error
        );

        doctors = [];

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        updateResultCount(0);
        renderStatistics();

        showDoctorMessage(error.message, "error");
    }

}


// =====================================================
// 4. TẢI DANH SÁCH CHUYÊN KHOA
// =====================================================

async function loadSpecialties() {

    try {

        const result = await doctorApi.get("/specialties");

        specialties = Array.isArray(result) ? result : [];

        renderSpecialtyOptions();

    } catch (error) {

        console.error(
            "Lỗi tải chuyên khoa:",
            error
        );

        showDoctorMessage(
            "Không thể tải danh sách chuyên khoa.",
            "error"
        );
    }

}


// =====================================================
// 5. HIỂN THỊ DANH SÁCH CHUYÊN KHOA
// =====================================================

function renderSpecialtyOptions() {

    const select = getElement("filter-specialty");
    const formSelect = getElement("ma_chuyen_khoa");

    const options = specialties.map(item => `
        <option value="${escapeHTML(item.ma_chuyen_khoa)}">
            ${escapeHTML(item.ten_chuyen_khoa)}
        </option>
    `).join("");

    if (select) {

        const previousValue = select.value;

        select.innerHTML = `
            <option value="">Tất cả chuyên khoa</option>
            ${options}
        `;

        select.value = previousValue;
    }

    if (formSelect) {

        formSelect.innerHTML = `
            <option value="">-- Chọn chuyên khoa --</option>
            ${options}
        `;
    }

}


// =====================================================
// 6. LỌC VÀ TÌM KIẾM
// =====================================================

function getFilteredDoctors() {

    const keyword = (
        getElement("search-doctor")?.value || ""
    ).trim().toLowerCase();

    const type = getElement("filter-doctor-type")?.value || "";

    const specialty = getElement("filter-specialty")?.value || "";

    return doctors.filter(doctor => {

        const searchableText = [
            doctor.ma_bac_si,
            doctor.ho_va_ten,
            doctor.thu_dien_tu,
            doctor.so_dien_thoai,
            doctor.ten_chuyen_khoa
        ]
            .map(value => String(value || "").toLowerCase())
            .join(" ");

        const matchesKeyword =
            searchableText.includes(keyword);

        const matchesType =
            !type || doctor.loai_bac_si === type;

        const matchesSpecialty =
            !specialty || doctor.ma_chuyen_khoa === specialty;

        return (
            matchesKeyword &&
            matchesType &&
            matchesSpecialty
        );
    });

}


// =====================================================
// 7. HIỂN THỊ BẢNG BÁC SĨ
// =====================================================

function renderDoctors() {

    const table = getElement("doctors-table");

    if (!table) return;

    const filteredDoctors = getFilteredDoctors();

    const canCreate = canDoctorAction("doctors.create");
    const canUpdate = canDoctorAction("doctors.update");
    const canDelete = canDoctorAction("doctors.delete");

    if (filteredDoctors.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Không tìm thấy bác sĩ phù hợp.
                </td>
            </tr>
        `;

        updateResultCount(0);

        return;
    }

    table.innerHTML = filteredDoctors.map(doctor => {

        const typeClass = doctor.loai_bac_si === "GP"
            ? "doctor-type-general"
            : "doctor-type-specialist";

        const specialtyName =
            doctor.ten_chuyen_khoa || "—";

        return `
            <tr>

                <td>
                    ${escapeHTML(doctor.ma_bac_si)}
                </td>

                <td>
                    <strong>
                        ${escapeHTML(doctor.ho_va_ten)}
                    </strong>
                </td>

                <td>
                    ${escapeHTML(doctor.thu_dien_tu)}
                </td>

                <td>
                    ${escapeHTML(doctor.so_dien_thoai)}
                </td>

                <td>
                    <span class="doctor-type-badge ${typeClass}">
                        ${escapeHTML(
                            getDoctorTypeLabel(doctor.loai_bac_si)
                        )}
                    </span>
                </td>

                <td>
                    ${escapeHTML(specialtyName)}
                </td>

                <td class="actions">

                    <button
                        type="button"
                        class="btn btn-sm btn-info"
                        data-action="detail"
                        data-id="${escapeHTML(doctor.ma_bac_si)}"
                    >
                        Chi tiết
                    </button>

                    ${
                        canUpdate
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-primary"
                                    data-action="edit"
                                    data-id="${escapeHTML(doctor.ma_bac_si)}"
                                >
                                    Sửa
                                </button>
                            `
                            : ""
                    }

                    ${
                        canDelete
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-danger"
                                    data-action="delete"
                                    data-id="${escapeHTML(doctor.ma_bac_si)}"
                                >
                                    Xóa
                                </button>
                            `
                            : ""
                    }

                </td>

            </tr>
        `;

    }).join("");

    updateResultCount(filteredDoctors.length);

    // Nút thêm bác sĩ chỉ Admin được sử dụng
    const addButton = getElement("btn-add-doctor");

    if (addButton) {
        addButton.hidden = !canCreate;
    }

}


// =====================================================
// 8. CẬP NHẬT SỐ LƯỢNG KẾT QUẢ
// =====================================================

function updateResultCount(count) {

    const element = getElement("doctor-result-count");

    if (element) {
        element.textContent = `${count} bác sĩ`;
    }

}


// =====================================================
// 9. THỐNG KÊ
// =====================================================

function renderStatistics() {

    const total = doctors.length;

    const general = doctors.filter(
        doctor => doctor.loai_bac_si === "GP"
    ).length;

    const specialist = doctors.filter(
        doctor => doctor.loai_bac_si === "Specialist"
    ).length;

    const totalElement = getElement("total-doctors");
    const generalElement = getElement("total-general-doctors");
    const specialistElement = getElement("total-specialist-doctors");

    if (totalElement) {
        totalElement.textContent = total;
    }

    if (generalElement) {
        generalElement.textContent = general;
    }

    if (specialistElement) {
        specialistElement.textContent = specialist;
    }

}


// =====================================================
// 10. ẨN / HIỆN TRƯỜNG THEO LOẠI BÁC SĨ
// =====================================================

function updateDoctorFormFields() {

    const type = getElement("loai_bac_si")?.value || "";

    const isSpecialist = type === "Specialist";
    const isGeneral = type === "GP";

    const specialtyGroup = getElement("specialty-group");
    const certificateGroup = getElement("certificate-group");
    const feeGroup = getElement("fee-group");
    const roomGroup = getElement("room-group");
    const careGroup = getElement("care-group");

    if (specialtyGroup) {
        specialtyGroup.hidden = !isSpecialist;
    }

    if (certificateGroup) {
        certificateGroup.hidden = !isSpecialist;
    }

    if (feeGroup) {
        feeGroup.hidden = !isSpecialist;
    }

    if (roomGroup) {
        roomGroup.hidden = !isGeneral;
    }

    if (careGroup) {
        careGroup.hidden = !isGeneral;
    }

    const specialty = getElement("ma_chuyen_khoa");
    const certificate = getElement("so_chung_nhan");
    const fee = getElement("phi_kham");

    if (specialty) {
        specialty.required = isSpecialist;
    }

    if (certificate) {
        certificate.required = isSpecialist;
    }

    if (fee) {
        fee.required = isSpecialist;
    }

}


// =====================================================
// 11. MỞ FORM THÊM BÁC SĨ
// =====================================================

function openAddDoctorForm() {

    if (!canDoctorAction("doctors.create")) {

        showDoctorMessage(
            "Bạn không có quyền thêm bác sĩ.",
            "error"
        );

        return;
    }

    const form = getElement("doctor-form");

    if (!form) return;

    form.reset();

    currentDoctorId = null;

    const mode = getElement("doctor-form-mode");
    const doctorIdInput = getElement("ma_bac_si");
    const title = getElement("doctor-form-title");
    const saveButton = getElement("save-doctor");

    if (mode) {
        mode.value = "create";
    }

    if (doctorIdInput) {
        doctorIdInput.disabled = false;
    }

    if (title) {
        title.textContent = "Thêm bác sĩ mới";
    }

    if (saveButton) {
        saveButton.textContent = "Lưu thông tin";
    }

    updateDoctorFormFields();

    openModal("doctor-form-modal");

}


// =====================================================
// 12. MỞ FORM SỬA BÁC SĨ
// =====================================================

async function openEditDoctorForm(doctorId) {

    if (!canDoctorAction("doctors.update")) {

        showDoctorMessage(
            "Bạn không có quyền sửa thông tin bác sĩ.",
            "error"
        );

        return;
    }

    try {

        const doctor = await doctorApi.get(
            `/doctors/${encodeURIComponent(doctorId)}`
        );

        if (!doctor) {

            showDoctorMessage(
                "Không tìm thấy bác sĩ.",
                "error"
            );

            return;
        }

        currentDoctorId = doctorId;

        const form = getElement("doctor-form");

        if (!form) return;

        form.reset();

        getElement("doctor-form-mode").value = "edit";

        getElement("ma_bac_si").value =
            doctor.ma_bac_si || "";

        getElement("ma_bac_si").disabled = true;

        getElement("ho_va_ten").value =
            doctor.ho_va_ten || "";

        getElement("thu_dien_tu").value =
            doctor.thu_dien_tu || "";

        getElement("so_dien_thoai").value =
            doctor.so_dien_thoai || "";

        getElement("loai_bac_si").value =
            doctor.loai_bac_si || "";

        getElement("ma_chuyen_khoa").value =
            doctor.ma_chuyen_khoa || "";

        getElement("so_chung_nhan").value =
            doctor.so_chung_nhan || "";

        getElement("phi_kham").value =
            doctor.phi_kham ?? "";

        getElement("so_phong_kham").value =
            doctor.so_phong_kham || "";

        getElement("cap_do_cham_soc").value =
            doctor.cap_do_cham_soc || "";

        const title = getElement("doctor-form-title");

        if (title) {
            title.textContent = "Cập nhật thông tin bác sĩ";
        }

        const saveButton = getElement("save-doctor");

        if (saveButton) {
            saveButton.textContent = "Cập nhật thông tin";
        }

        updateDoctorFormFields();

        openModal("doctor-form-modal");

    } catch (error) {

        console.error(
            "Lỗi lấy thông tin bác sĩ:",
            error
        );

        showDoctorMessage(error.message, "error");
    }

}


// =====================================================
// 13. LẤY DỮ LIỆU TỪ FORM
// =====================================================

function getDoctorFormData() {

    const type = getElement("loai_bac_si").value;

    const data = {

        ma_bac_si: getElement("ma_bac_si").value.trim(),

        ho_va_ten: getElement("ho_va_ten").value.trim(),

        thu_dien_tu: getElement("thu_dien_tu").value.trim(),

        so_dien_thoai: getElement("so_dien_thoai").value.trim(),

        loai_bac_si: type

    };

    if (type === "Specialist") {

        data.ma_chuyen_khoa =
            getElement("ma_chuyen_khoa").value;

        data.so_chung_nhan =
            getElement("so_chung_nhan").value.trim();

        data.phi_kham =
            getElement("phi_kham").value;

    }

    if (type === "GP") {

        data.so_phong_kham =
            getElement("so_phong_kham").value.trim();

        data.cap_do_cham_soc =
            getElement("cap_do_cham_soc").value.trim();

    }

    return data;

}


// =====================================================
// 14. THÊM / CẬP NHẬT BÁC SĨ
// =====================================================

async function saveDoctor(event) {

    event.preventDefault();

    const mode = getElement("doctor-form-mode")?.value;

    const permission = mode === "create"
        ? "doctors.create"
        : "doctors.update";

    if (!canDoctorAction(permission)) {

        showDoctorMessage(
            "Bạn không có quyền thực hiện thao tác này.",
            "error"
        );

        return;
    }

    const form = getElement("doctor-form");

    if (!form || !form.reportValidity()) {
        return;
    }

    const saveButton = getElement("save-doctor");

    if (saveButton?.disabled) {
        return;
    }

    const data = getDoctorFormData();

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Đang lưu...";
    }

    try {

        if (mode === "create") {

            await doctorApi.post("/doctors", data);

            showDoctorMessage(
                "Thêm bác sĩ thành công."
            );

        } else {

            await doctorApi.put(
                `/doctors/${encodeURIComponent(currentDoctorId)}`,
                data
            );

            showDoctorMessage(
                "Cập nhật bác sĩ thành công."
            );

        }

        closeModal("doctor-form-modal");

        if (getElement("ma_bac_si")) {
            getElement("ma_bac_si").disabled = false;
        }

        currentDoctorId = null;

        await loadDoctors();

    } catch (error) {

        console.error(
            "Lỗi lưu bác sĩ:",
            error
        );

        showDoctorMessage(error.message, "error");

    } finally {

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.textContent =
                mode === "create"
                    ? "Lưu thông tin"
                    : "Cập nhật thông tin";

        }

    }

}


// =====================================================
// 15. XEM CHI TIẾT BÁC SĨ
// =====================================================

async function openDoctorDetail(doctorId) {

    try {

        const doctor = await doctorApi.get(
            `/doctors/${encodeURIComponent(doctorId)}`
        );

        if (!doctor) {

            showDoctorMessage(
                "Không tìm thấy thông tin bác sĩ.",
                "error"
            );

            return;
        }

        const detail = getElement("doctor-detail");

        if (!detail) return;

        const rows = [

            ["Mã bác sĩ", doctor.ma_bac_si],

            ["Họ và tên", doctor.ho_va_ten],

            ["Email", doctor.thu_dien_tu],

            ["Số điện thoại", doctor.so_dien_thoai],

            [
                "Loại bác sĩ",
                getDoctorTypeLabel(doctor.loai_bac_si)
            ],

            ["Chuyên khoa", doctor.ten_chuyen_khoa],

            ["Số chứng nhận", doctor.so_chung_nhan],

            [
                "Phí khám",
                doctor.phi_kham !== null &&
                doctor.phi_kham !== undefined
                    ? formatCurrency(doctor.phi_kham)
                    : null
            ],

            ["Số phòng khám", doctor.so_phong_kham],

            ["Cấp độ chăm sóc", doctor.cap_do_cham_soc]

        ];

        detail.innerHTML = rows

            .filter(item =>
                item[1] !== null &&
                item[1] !== undefined &&
                item[1] !== ""
            )

            .map(item => `
                <div class="doctor-detail-row">

                    <strong>
                        ${escapeHTML(item[0])}
                    </strong>

                    <span>
                        ${escapeHTML(item[1])}
                    </span>

                </div>
            `)

            .join("");

        openModal("doctor-modal");

    } catch (error) {

        console.error(
            "Lỗi xem chi tiết bác sĩ:",
            error
        );

        showDoctorMessage(error.message, "error");
    }

}


// =====================================================
// 16. MỞ MODAL XÓA BÁC SĨ
// =====================================================

function openDeleteDoctorModal(doctorId) {

    if (!canDoctorAction("doctors.delete")) {

        showDoctorMessage(
            "Bạn không có quyền xóa bác sĩ.",
            "error"
        );

        return;
    }

    const doctor = getDoctorById(doctorId);

    if (!doctor) {

        showDoctorMessage(
            "Không tìm thấy bác sĩ.",
            "error"
        );

        return;
    }

    currentDoctorId = doctorId;

    const name = getElement("delete-doctor-name");

    if (name) {

        name.textContent =
            `${doctor.ho_va_ten} (${doctor.ma_bac_si})`;

    }

    openModal("delete-doctor-modal");

}


// =====================================================
// 17. XÁC NHẬN XÓA BÁC SĨ
// =====================================================

async function confirmDeleteDoctor() {

    if (!canDoctorAction("doctors.delete")) {

        showDoctorMessage(
            "Bạn không có quyền xóa bác sĩ.",
            "error"
        );

        return;
    }

    if (!currentDoctorId) return;

    const deleteButton = getElement("confirm-delete-doctor");

    if (deleteButton?.disabled) return;

    if (deleteButton) {
        deleteButton.disabled = true;
        deleteButton.textContent = "Đang xóa...";
    }

    try {

        await doctorApi.delete(
            `/doctors/${encodeURIComponent(currentDoctorId)}`
        );

        closeModal("delete-doctor-modal");

        currentDoctorId = null;

        showDoctorMessage(
            "Xóa bác sĩ thành công."
        );

        await loadDoctors();

    } catch (error) {

        console.error(
            "Lỗi xóa bác sĩ:",
            error
        );

        showDoctorMessage(error.message, "error");

    } finally {

        if (deleteButton) {
            deleteButton.disabled = false;
            deleteButton.textContent = "Xác nhận xóa";
        }

    }

}


// =====================================================
// 18. GẮN SỰ KIỆN
// =====================================================

function bindDoctorEvents() {

    getElement("btn-add-doctor")
        ?.addEventListener(
            "click",
            openAddDoctorForm
        );

    getElement("doctor-form")
        ?.addEventListener(
            "submit",
            saveDoctor
        );

    getElement("loai_bac_si")
        ?.addEventListener(
            "change",
            updateDoctorFormFields
        );

    getElement("search-doctor")
        ?.addEventListener(
            "input",
            renderDoctors
        );

    getElement("filter-doctor-type")
        ?.addEventListener(
            "change",
            renderDoctors
        );

    getElement("filter-specialty")
        ?.addEventListener(
            "change",
            renderDoctors
        );

    getElement("refresh-doctors")
        ?.addEventListener(
            "click",
            loadDoctors
        );

    getElement("close-doctor-form")
        ?.addEventListener("click", () => {

            closeModal("doctor-form-modal");

            if (getElement("ma_bac_si")) {
                getElement("ma_bac_si").disabled = false;
            }

            currentDoctorId = null;
        });

    getElement("cancel-doctor-form")
        ?.addEventListener("click", () => {

            closeModal("doctor-form-modal");

            if (getElement("ma_bac_si")) {
                getElement("ma_bac_si").disabled = false;
            }

            currentDoctorId = null;
        });

    getElement("close-doctor-modal")
        ?.addEventListener("click", () => {
            closeModal("doctor-modal");
        });

    getElement("cancel-delete-doctor")
        ?.addEventListener("click", () => {

            closeModal("delete-doctor-modal");

            currentDoctorId = null;
        });

    getElement("confirm-delete-doctor")
        ?.addEventListener(
            "click",
            confirmDeleteDoctor
        );

    // Xử lý các nút thao tác trong bảng
    getElement("doctors-table")
        ?.addEventListener("click", event => {

            const button = event.target.closest("[data-action]");

            if (!button) return;

            const action = button.dataset.action;
            const doctorId = button.dataset.id;

            if (!doctorId) return;

            if (action === "detail") {
                openDoctorDetail(doctorId);
            }

            if (action === "edit") {

                if (!canDoctorAction("doctors.update")) {
                    showDoctorMessage(
                        "Bạn không có quyền sửa bác sĩ.",
                        "error"
                    );
                    return;
                }

                openEditDoctorForm(doctorId);
            }

            if (action === "delete") {

                if (!canDoctorAction("doctors.delete")) {
                    showDoctorMessage(
                        "Bạn không có quyền xóa bác sĩ.",
                        "error"
                    );
                    return;
                }

                openDeleteDoctorModal(doctorId);
            }

        });

    // Đóng modal khi nhấn ra ngoài
    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {

                closeModal(modal.id);

                if (
                    modal.id === "doctor-form-modal" &&
                    getElement("ma_bac_si")
                ) {
                    getElement("ma_bac_si").disabled = false;
                }

                if (
                    modal.id === "delete-doctor-modal"
                ) {
                    currentDoctorId = null;
                }

            }

        });

    });

    // Đóng modal bằng phím Escape
    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            document.querySelectorAll(".modal.show").forEach(modal => {
                closeModal(modal.id);
            });

            currentDoctorId = null;

            if (getElement("ma_bac_si")) {
                getElement("ma_bac_si").disabled = false;
            }

        }

    });

}


// =====================================================
// 19. KHỞI ĐỘNG TRANG
// =====================================================

async function initializeDoctorsPage() {

    if (typeof initializeLayout === "function") {

        await initializeLayout(
            "doctors",
            "Quản lý bác sĩ"
        );

    }

    bindDoctorEvents();

    await Promise.all([
        loadSpecialties(),
        loadDoctors()
    ]);

    updateDoctorFormFields();

}


// =====================================================
// 20. DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeDoctorsPage
);
