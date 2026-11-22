
"use strict";

// ==========================================
// 1. BIẾN TOÀN CỤC
// ==========================================

const SPECIALTY_API = "/specialties";

let specialties = [];
let filteredSpecialties = [];

let currentSpecialtyId = null;
let specialtyToDelete = null;


// ==========================================
// 2. HÀM KIỂM TRA QUYỀN
// ==========================================

function canSpecialtyAction(permission) {
    return (
        typeof window.can === "function" &&
        window.can(permission)
    );
}


// ==========================================
// 3. HÀM THÔNG BÁO
// ==========================================

function showSpecialtyMessage(message, type = "success") {

    if (typeof showMessage === "function") {
        showMessage(message, type);
    } else {
        alert(message);
    }

}


// ==========================================
// 4. KHỞI TẠO TRANG
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    await initializeLayout(
        "specialties",
        "Quản lý chuyên khoa"
    );

    initializeSpecialtyEvents();

    await loadSpecialties();

});


// ==========================================
// 5. GẮN SỰ KIỆN
// ==========================================

function initializeSpecialtyEvents() {

    document
        .getElementById("btn-add-specialty")
        ?.addEventListener("click", openAddForm);

    document
        .getElementById("search-specialty")
        ?.addEventListener("input", handleSearch);

    document
        .getElementById("refresh-specialties")
        ?.addEventListener("click", loadSpecialties);

    document
        .getElementById("specialty-form")
        ?.addEventListener("submit", handleSaveSpecialty);

    document
        .getElementById("close-specialty-form")
        ?.addEventListener("click", closeSpecialtyForm);

    document
        .getElementById("cancel-specialty-form")
        ?.addEventListener("click", closeSpecialtyForm);

    document
        .getElementById("close-specialty-detail")
        ?.addEventListener("click", closeSpecialtyDetail);

    document
        .getElementById("close-delete-specialty")
        ?.addEventListener("click", closeDeleteModal);

    document
        .getElementById("cancel-delete-specialty")
        ?.addEventListener("click", closeDeleteModal);

    document
        .getElementById("confirm-delete-specialty")
        ?.addEventListener("click", confirmDeleteSpecialty);

    // Xử lý các nút thao tác trong bảng
    document
        .getElementById("specialties-table")
        ?.addEventListener("click", handleSpecialtyTableClick);

    // Đóng modal khi click bên ngoài
    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                closeSpecialtyModal(modal.id);
            }

        });

    });

    // Đóng modal bằng phím Escape
    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            document.querySelectorAll(".modal.show").forEach(modal => {
                closeSpecialtyModal(modal.id);
            });

            currentSpecialtyId = null;
            specialtyToDelete = null;

            const idInput = document.getElementById("ma_chuyen_khoa");

            if (idInput) {
                idInput.disabled = false;
            }

        }

    });

}


// ==========================================
// 6. ĐÓNG MODAL CHUNG
// ==========================================

function closeSpecialtyModal(modalId) {

    const modal = document.getElementById(modalId);

    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    if (!document.querySelector(".modal.show")) {
        document.body.style.overflow = "";
    }

}

function openSpecialtyModal(modalId) {

    const modal = document.getElementById(modalId);

    if (!modal) return;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

}


// ==========================================
// 7. TẢI DANH SÁCH CHUYÊN KHOA
// ==========================================

async function loadSpecialties() {

    const table = document.getElementById(
        "specialties-table"
    );

    const refreshButton = document.getElementById(
        "refresh-specialties"
    );

    if (table) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    Đang tải dữ liệu...
                </td>
            </tr>
        `;

    }

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Đang tải...";
    }

    try {

        const result = await window.api.get(SPECIALTY_API);

        if (Array.isArray(result)) {
            specialties = result;
        } else if (Array.isArray(result?.data)) {
            specialties = result.data;
        } else {
            specialties = [];
        }

        filteredSpecialties = [...specialties];

        renderSpecialties();
        updateSpecialtyStatistics();

    } catch (error) {

        console.error(
            "Lỗi tải danh sách chuyên khoa:",
            error
        );

        specialties = [];
        filteredSpecialties = [];

        if (table) {

            table.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;

        }

        updateSpecialtyStatistics();

        showSpecialtyMessage(
            error.message || "Không thể tải dữ liệu.",
            "error"
        );

    } finally {

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Làm mới";
        }

    }

}


// ==========================================
// 8. HIỂN THỊ DANH SÁCH
// ==========================================

function renderSpecialties() {

    const table = document.getElementById(
        "specialties-table"
    );

    if (!table) return;

    const canUpdate = canSpecialtyAction("specialties.update");
    const canDelete = canSpecialtyAction("specialties.delete");

    if (filteredSpecialties.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    Không tìm thấy chuyên khoa nào.
                </td>
            </tr>
        `;

        updateResultCount();

        return;
    }

    table.innerHTML = filteredSpecialties
        .map((specialty, index) => {

            const id = escapeHTML(specialty.ma_chuyen_khoa);

            return `
                <tr>

                    <td>${index + 1}</td>

                    <td>
                        <strong>${id}</strong>
                    </td>

                    <td>
                        ${escapeHTML(specialty.ma_dinh_danh)}
                    </td>

                    <td>
                        ${escapeHTML(specialty.ten_chuyen_khoa)}
                    </td>

                    <td class="actions">

                        <button
                            type="button"
                            class="btn btn-info btn-sm"
                            data-action="detail"
                            data-id="${id}"
                        >
                            Chi tiết
                        </button>

                        ${
                            canUpdate
                                ? `
                                    <button
                                        type="button"
                                        class="btn btn-warning btn-sm"
                                        data-action="edit"
                                        data-id="${id}"
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
                                        class="btn btn-danger btn-sm"
                                        data-action="delete"
                                        data-id="${id}"
                                    >
                                        Xóa
                                    </button>
                                `
                                : ""
                        }

                        ${
                            !canUpdate && !canDelete
                                ? `<span>Chỉ xem</span>`
                                : ""
                        }

                    </td>

                </tr>
            `;

        })
        .join("");

    updateResultCount();

}


// ==========================================
// 9. XỬ LÝ NÚT TRONG BẢNG
// ==========================================

function handleSpecialtyTableClick(event) {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const specialtyId = button.dataset.id;

    if (!specialtyId) return;

    if (action === "detail") {
        viewSpecialty(specialtyId);
    }

    if (action === "edit") {

        if (!canSpecialtyAction("specialties.update")) {

            showSpecialtyMessage(
                "Bạn không có quyền sửa chuyên khoa.",
                "error"
            );

            return;
        }

        editSpecialty(specialtyId);
    }

    if (action === "delete") {

        if (!canSpecialtyAction("specialties.delete")) {

            showSpecialtyMessage(
                "Bạn không có quyền xóa chuyên khoa.",
                "error"
            );

            return;
        }

        openDeleteModal(specialtyId);
    }

}


// ==========================================
// 10. CẬP NHẬT THỐNG KÊ
// ==========================================

function updateSpecialtyStatistics() {

    const totalElement = document.getElementById(
        "total-specialties"
    );

    if (totalElement) {
        totalElement.textContent = specialties.length;
    }

    updateResultCount();

}

function updateResultCount() {

    const resultElement = document.getElementById(
        "specialty-result-count"
    );

    if (resultElement) {

        resultElement.textContent =
            `Hiển thị ${filteredSpecialties.length} / ${specialties.length} chuyên khoa`;

    }

}


// ==========================================
// 11. TÌM KIẾM
// ==========================================

function handleSearch(event) {

    const keyword = event.target.value
        .trim()
        .toLowerCase();

    filteredSpecialties = specialties.filter(specialty => {

        const code = String(
            specialty.ma_chuyen_khoa || ""
        ).toLowerCase();

        const identifier = String(
            specialty.ma_dinh_danh || ""
        ).toLowerCase();

        const name = String(
            specialty.ten_chuyen_khoa || ""
        ).toLowerCase();

        return (
            code.includes(keyword) ||
            identifier.includes(keyword) ||
            name.includes(keyword)
        );

    });

    renderSpecialties();

}


// ==========================================
// 12. MỞ FORM THÊM
// ==========================================

function openAddForm() {

    if (!canSpecialtyAction("specialties.create")) {

        showSpecialtyMessage(
            "Bạn không có quyền thêm chuyên khoa.",
            "error"
        );

        return;
    }

    currentSpecialtyId = null;

    const form = document.getElementById(
        "specialty-form"
    );

    if (!form) return;

    form.reset();

    const title = document.getElementById(
        "specialty-form-title"
    );

    if (title) {
        title.textContent = "Thêm chuyên khoa";
    }

    const mode = document.getElementById(
        "specialty-form-mode"
    );

    if (mode) {
        mode.value = "add";
    }

    const idInput = document.getElementById(
        "ma_chuyen_khoa"
    );

    if (idInput) {
        idInput.disabled = false;
    }

    const saveButton = document.getElementById(
        "save-specialty"
    );

    if (saveButton) {
        saveButton.textContent = "Lưu chuyên khoa";
    }

    openSpecialtyModal("specialty-form-modal");

}


// ==========================================
// 13. MỞ FORM SỬA
// ==========================================

function editSpecialty(specialtyId) {

    if (!canSpecialtyAction("specialties.update")) {

        showSpecialtyMessage(
            "Bạn không có quyền sửa chuyên khoa.",
            "error"
        );

        return;
    }

    const specialty = specialties.find(
        item => item.ma_chuyen_khoa === specialtyId
    );

    if (!specialty) {

        showSpecialtyMessage(
            "Không tìm thấy chuyên khoa.",
            "error"
        );

        return;
    }

    currentSpecialtyId = specialtyId;

    const title = document.getElementById(
        "specialty-form-title"
    );

    if (title) {
        title.textContent = "Cập nhật chuyên khoa";
    }

    const mode = document.getElementById(
        "specialty-form-mode"
    );

    if (mode) {
        mode.value = "edit";
    }

    const idInput = document.getElementById(
        "ma_chuyen_khoa"
    );

    if (idInput) {
        idInput.value = specialty.ma_chuyen_khoa;
        idInput.disabled = true;
    }

    const identifierInput = document.getElementById(
        "ma_dinh_danh"
    );

    if (identifierInput) {
        identifierInput.value = specialty.ma_dinh_danh || "";
    }

    const nameInput = document.getElementById(
        "ten_chuyen_khoa"
    );

    if (nameInput) {
        nameInput.value = specialty.ten_chuyen_khoa || "";
    }

    const saveButton = document.getElementById(
        "save-specialty"
    );

    if (saveButton) {
        saveButton.textContent = "Cập nhật chuyên khoa";
    }

    openSpecialtyModal("specialty-form-modal");

}


// ==========================================
// 14. LƯU CHUYÊN KHOA
// ==========================================

async function handleSaveSpecialty(event) {

    event.preventDefault();

    const mode = document.getElementById(
        "specialty-form-mode"
    )?.value;

    const permission = mode === "add"
        ? "specialties.create"
        : "specialties.update";

    if (!canSpecialtyAction(permission)) {

        showSpecialtyMessage(
            "Bạn không có quyền thực hiện thao tác này.",
            "error"
        );

        return;
    }

    const data = {

        ma_chuyen_khoa: document.getElementById(
            "ma_chuyen_khoa"
        )?.value.trim(),

        ma_dinh_danh: document.getElementById(
            "ma_dinh_danh"
        )?.value.trim(),

        ten_chuyen_khoa: document.getElementById(
            "ten_chuyen_khoa"
        )?.value.trim()

    };

    if (
        !data.ma_chuyen_khoa ||
        !data.ma_dinh_danh ||
        !data.ten_chuyen_khoa
    ) {

        showSpecialtyMessage(
            "Vui lòng nhập đầy đủ thông tin.",
            "warning"
        );

        return;
    }

    const form = document.getElementById(
        "specialty-form"
    );

    if (form && !form.reportValidity()) {
        return;
    }

    const saveButton = document.getElementById(
        "save-specialty"
    );

    if (!saveButton || saveButton.disabled) {
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Đang lưu...";

    try {

        if (mode === "add") {

            await window.api.post(
                SPECIALTY_API,
                data
            );

            showSpecialtyMessage(
                "Thêm chuyên khoa thành công."
            );

        } else {

            if (!currentSpecialtyId) {
                throw new Error(
                    "Không xác định được chuyên khoa cần cập nhật."
                );
            }

            await window.api.put(
                `${SPECIALTY_API}/${encodeURIComponent(currentSpecialtyId)}`,
                {
                    ma_dinh_danh: data.ma_dinh_danh,
                    ten_chuyen_khoa: data.ten_chuyen_khoa
                }
            );

            showSpecialtyMessage(
                "Cập nhật chuyên khoa thành công."
            );

        }

        closeSpecialtyForm();

        await loadSpecialties();

    } catch (error) {

        console.error(
            "Lỗi lưu chuyên khoa:",
            error
        );

        showSpecialtyMessage(
            error.message || "Không thể lưu chuyên khoa.",
            "error"
        );

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            mode === "add"
                ? "Lưu chuyên khoa"
                : "Cập nhật chuyên khoa";

    }

}


// ==========================================
// 15. ĐÓNG FORM
// ==========================================

function closeSpecialtyForm() {

    closeSpecialtyModal("specialty-form-modal");

    const form = document.getElementById(
        "specialty-form"
    );

    if (form) {
        form.reset();
    }

    const idInput = document.getElementById(
        "ma_chuyen_khoa"
    );

    if (idInput) {
        idInput.disabled = false;
    }

    currentSpecialtyId = null;

}


// ==========================================
// 16. XEM CHI TIẾT
// ==========================================

function viewSpecialty(specialtyId) {

    const specialty = specialties.find(
        item => item.ma_chuyen_khoa === specialtyId
    );

    if (!specialty) {

        showSpecialtyMessage(
            "Không tìm thấy chuyên khoa.",
            "error"
        );

        return;
    }

    const detail = document.getElementById(
        "specialty-detail"
    );

    if (!detail) return;

    detail.innerHTML = `

        <div class="detail-item">
            <strong>Mã chuyên khoa:</strong>
            <span>
                ${escapeHTML(specialty.ma_chuyen_khoa)}
            </span>
        </div>

        <div class="detail-item">
            <strong>Mã định danh:</strong>
            <span>
                ${escapeHTML(specialty.ma_dinh_danh)}
            </span>
        </div>

        <div class="detail-item">
            <strong>Tên chuyên khoa:</strong>
            <span>
                ${escapeHTML(specialty.ten_chuyen_khoa)}
            </span>
        </div>

    `;

    openSpecialtyModal("specialty-detail-modal");

}


// ==========================================
// 17. ĐÓNG CHI TIẾT
// ==========================================

function closeSpecialtyDetail() {

    closeSpecialtyModal("specialty-detail-modal");

}


// ==========================================
// 18. MỞ MODAL XÓA
// ==========================================

function openDeleteModal(specialtyId) {

    if (!canSpecialtyAction("specialties.delete")) {

        showSpecialtyMessage(
            "Bạn không có quyền xóa chuyên khoa.",
            "error"
        );

        return;
    }

    const specialty = specialties.find(
        item => item.ma_chuyen_khoa === specialtyId
    );

    if (!specialty) {

        showSpecialtyMessage(
            "Không tìm thấy chuyên khoa.",
            "error"
        );

        return;
    }

    specialtyToDelete = specialtyId;

    const nameElement = document.getElementById(
        "delete-specialty-name"
    );

    if (nameElement) {
        nameElement.textContent = specialty.ten_chuyen_khoa;
    }

    openSpecialtyModal("delete-specialty-modal");

}


// ==========================================
// 19. XÁC NHẬN XÓA
// ==========================================

async function confirmDeleteSpecialty() {

    if (!canSpecialtyAction("specialties.delete")) {

        showSpecialtyMessage(
            "Bạn không có quyền xóa chuyên khoa.",
            "error"
        );

        return;
    }

    if (!specialtyToDelete) return;

    const button = document.getElementById(
        "confirm-delete-specialty"
    );

    if (!button || button.disabled) {
        return;
    }

    button.disabled = true;
    button.textContent = "Đang xóa...";

    try {

        await window.api.delete(
            `${SPECIALTY_API}/${encodeURIComponent(specialtyToDelete)}`
        );

        showSpecialtyMessage(
            "Xóa chuyên khoa thành công."
        );

        closeDeleteModal();

        await loadSpecialties();

    } catch (error) {

        console.error(
            "Lỗi xóa chuyên khoa:",
            error
        );

        showSpecialtyMessage(
            error.message ||
            "Không thể xóa chuyên khoa.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Xác nhận xóa";

    }

}


// ==========================================
// 20. ĐÓNG MODAL XÓA
// ==========================================

function closeDeleteModal() {

    closeSpecialtyModal("delete-specialty-modal");

    specialtyToDelete = null;

}
