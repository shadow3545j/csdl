
"use strict";

// ==========================================
// 1. BIẾN TOÀN CỤC
// ==========================================

const MEDICINE_API = "/medicines";

let medicines = [];
let filteredMedicines = [];

let currentMedicineId = null;
let medicineToDelete = null;

let currentMedicineRole = null;

// Ngưỡng cảnh báo tồn kho thấp: 10
const LOW_STOCK_THRESHOLD = 10;


// ==========================================
// 2. KIỂM TRA QUYỀN
// ==========================================

function canManageMedicine() {
    return ["Admin", "Pharmacist"].includes(currentMedicineRole);
}

function canDeleteMedicine() {
    return currentMedicineRole === "Admin";
}


// ==========================================
// 3. THÔNG BÁO
// ==========================================

function showMedicineMessage(message, type = "success") {
    if (typeof window.showMessage === "function") {
        window.showMessage(message, type);
    } else {
        alert(message);
    }
}


// ==========================================
// 4. KHỞI TẠO TRANG
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    await initializeLayout(
        "medicines",
        "Quản lý danh mục thuốc"
    );

    currentMedicineRole =
        typeof window.getCurrentRole === "function"
            ? window.getCurrentRole()
            : null;

    initializeMedicineEvents();

    await loadMedicines();

});


// ==========================================
// 5. GẮN SỰ KIỆN
// ==========================================

function initializeMedicineEvents() {

    document
        .getElementById("btn-add-medicine")
        ?.addEventListener("click", openAddMedicineForm);

    document
        .getElementById("search-medicine")
        ?.addEventListener("input", handleMedicineSearch);

    document
        .getElementById("refresh-medicines")
        ?.addEventListener("click", loadMedicines);

    document
        .getElementById("medicine-form")
        ?.addEventListener("submit", handleSaveMedicine);

    document
        .getElementById("close-medicine-form")
        ?.addEventListener("click", closeMedicineForm);

    document
        .getElementById("cancel-medicine-form")
        ?.addEventListener("click", closeMedicineForm);

    document
        .getElementById("close-medicine-detail")
        ?.addEventListener("click", closeMedicineDetail);

    document
        .getElementById("close-delete-medicine")
        ?.addEventListener("click", closeDeleteMedicineModal);

    document
        .getElementById("cancel-delete-medicine")
        ?.addEventListener("click", closeDeleteMedicineModal);

    document
        .getElementById("confirm-delete-medicine")
        ?.addEventListener("click", confirmDeleteMedicine);

    document
        .getElementById("medicines-table")
        ?.addEventListener("click", handleMedicineTableClick);

    // Đóng modal khi click bên ngoài
    document.querySelectorAll(
        "#medicine-form-modal, #medicine-detail-modal, #delete-medicine-modal"
    ).forEach(modal => {

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                closeMedicineModal(modal.id);
            }

        });

    });

    // Đóng modal bằng phím Escape
    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            document.querySelectorAll(".modal.show").forEach(modal => {
                closeMedicineModal(modal.id);
            });

            currentMedicineId = null;
            medicineToDelete = null;

            const medicineIdInput = document.getElementById("ma_thuoc");

            if (medicineIdInput) {
                medicineIdInput.disabled = false;
            }

        }

    });

}


// ==========================================
// 6. ĐÓNG / MỞ MODAL
// ==========================================

function openMedicineModal(modalId) {

    const modal = document.getElementById(modalId);

    if (!modal) return;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

}


function closeMedicineModal(modalId) {

    const modal = document.getElementById(modalId);

    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    if (!document.querySelector(".modal.show")) {
        document.body.style.overflow = "";
    }

}


// ==========================================
// 7. TẢI DANH SÁCH THUỐC
// ==========================================

async function loadMedicines() {

    const table = document.getElementById("medicines-table");

    const refreshButton = document.getElementById(
        "refresh-medicines"
    );

    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
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

        const result = await window.api.get(MEDICINE_API);

        medicines = Array.isArray(result) ? result : [];

        filteredMedicines = [...medicines];

        renderMedicines();
        updateMedicineStatistics();

    } catch (error) {

        console.error("Lỗi tải danh sách thuốc:", error);

        medicines = [];
        filteredMedicines = [];

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        updateMedicineStatistics();

        showMedicineMessage(
            error.message || "Không thể tải danh sách thuốc.",
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
// 8. THỐNG KÊ THUỐC
// ==========================================

function updateMedicineStatistics() {

    const total = medicines.length;

    const available = medicines.filter(
        medicine => Number(medicine.so_luong_ton) > 0
    ).length;

    const outOfStock = medicines.filter(
        medicine => Number(medicine.so_luong_ton) === 0
    ).length;

    const totalElement = document.getElementById(
        "total-medicines"
    );

    const availableElement = document.getElementById(
        "available-medicines"
    );

    const outOfStockElement = document.getElementById(
        "out-of-stock-medicines"
    );

    if (totalElement) {
        totalElement.textContent = total;
    }

    if (availableElement) {
        availableElement.textContent = available;
    }

    if (outOfStockElement) {
        outOfStockElement.textContent = outOfStock;
    }

}


// ==========================================
// 9. XÁC ĐỊNH TRẠNG THÁI KHO
// ==========================================

function getMedicineStockStatus(quantity) {

    const stock = Number(quantity);

    if (stock === 0) {
        return {
            text: "Hết hàng",
            className: "empty"
        };
    }

    if (stock <= LOW_STOCK_THRESHOLD) {
        return {
            text: "Sắp hết hàng",
            className: "low"
        };
    }

    return {
        text: "Còn hàng",
        className: "available"
    };

}


// ==========================================
// 10. HIỂN THỊ DANH SÁCH THUỐC
// ==========================================

function renderMedicines() {

    const table = document.getElementById("medicines-table");

    if (!table) return;

    if (filteredMedicines.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Không tìm thấy thuốc nào.
                </td>
            </tr>
        `;

        updateMedicineResultCount();

        return;
    }

    const canUpdate = canManageMedicine();
    const canDelete = canDeleteMedicine();

    table.innerHTML = filteredMedicines.map((medicine, index) => {

        const id = escapeHTML(medicine.ma_thuoc);

        const quantity = Number(medicine.so_luong_ton);

        const stockStatus = getMedicineStockStatus(quantity);

        return `
            <tr>

                <td>${index + 1}</td>

                <td>
                    <strong>${id}</strong>
                </td>

                <td>
                    ${escapeHTML(medicine.ten_biet_duoc)}
                </td>

                <td>
                    ${escapeHTML(medicine.hoat_chat)}
                </td>

                <td>
                    <strong class="medicine-stock ${
                        stockStatus.className === "empty"
                            ? "medicine-stock-empty"
                            : stockStatus.className === "low"
                                ? "medicine-stock-low"
                                : "medicine-stock-available"
                    }">
                        ${quantity.toLocaleString("vi-VN")}
                    </strong>
                </td>

                <td>
                    <span class="medicine-stock-badge ${stockStatus.className}">
                        ${stockStatus.text}
                    </span>
                </td>

                <td class="actions">

                    <button
                        type="button"
                        class="btn btn-info btn-sm"
                        data-action="detail"
                        data-id="${id}">
                        Chi tiết
                    </button>

                    ${
                        canUpdate
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-warning btn-sm"
                                    data-action="edit"
                                    data-id="${id}">
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
                                    data-id="${id}">
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

    }).join("");

    updateMedicineResultCount();

}


// ==========================================
// 11. CẬP NHẬT SỐ KẾT QUẢ
// ==========================================

function updateMedicineResultCount() {

    const element = document.getElementById(
        "medicine-result-count"
    );

    if (!element) return;

    element.textContent =
        `${filteredMedicines.length} / ${medicines.length} thuốc`;

}


// ==========================================
// 12. TÌM KIẾM THUỐC
// ==========================================

function handleMedicineSearch(event) {

    const keyword = String(event.target.value || "")
        .trim()
        .toLowerCase();

    filteredMedicines = medicines.filter(medicine => {

        const medicineId = String(
            medicine.ma_thuoc || ""
        ).toLowerCase();

        const medicineName = String(
            medicine.ten_biet_duoc || ""
        ).toLowerCase();

        const activeIngredient = String(
            medicine.hoat_chat || ""
        ).toLowerCase();

        return (
            medicineId.includes(keyword) ||
            medicineName.includes(keyword) ||
            activeIngredient.includes(keyword)
        );

    });

    renderMedicines();

}


// ==========================================
// 13. XỬ LÝ NÚT THAO TÁC TRONG BẢNG
// ==========================================

function handleMedicineTableClick(event) {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const medicineId = button.dataset.id;

    if (!medicineId) return;

    if (action === "detail") {
        viewMedicineDetail(medicineId);
    }

    if (action === "edit") {
        openEditMedicineForm(medicineId);
    }

    if (action === "delete") {
        openDeleteMedicineModal(medicineId);
    }

}


// ==========================================
// 14. MỞ FORM THÊM THUỐC
// ==========================================

function openAddMedicineForm() {

    if (!canManageMedicine()) {
        showMedicineMessage(
            "Bạn không có quyền thêm thuốc.",
            "error"
        );
        return;
    }

    currentMedicineId = null;

    const form = document.getElementById("medicine-form");

    if (!form) return;

    form.reset();

    document.getElementById("medicine-form-mode").value = "create";

    document.getElementById("medicine-form-title").textContent =
        "Thêm thuốc";

    document.getElementById("save-medicine").textContent =
        "Lưu thuốc";

    const medicineIdInput = document.getElementById("ma_thuoc");

    medicineIdInput.disabled = false;
    medicineIdInput.value = "";

    document.getElementById("so_luong_ton").value = 0;

    openMedicineModal("medicine-form-modal");

}


// ==========================================
// 15. MỞ FORM SỬA THUỐC
// ==========================================

function openEditMedicineForm(medicineId) {

    if (!canManageMedicine()) {
        showMedicineMessage(
            "Bạn không có quyền cập nhật thuốc.",
            "error"
        );
        return;
    }

    const medicine = medicines.find(
        item => item.ma_thuoc === medicineId
    );

    if (!medicine) {
        showMedicineMessage(
            "Không tìm thấy thuốc cần sửa.",
            "error"
        );
        return;
    }

    currentMedicineId = medicineId;

    document.getElementById("medicine-form").reset();

    document.getElementById("medicine-form-mode").value = "edit";

    document.getElementById("medicine-form-title").textContent =
        "Cập nhật thuốc";

    document.getElementById("save-medicine").textContent =
        "Cập nhật";

    document.getElementById("ma_thuoc").value =
        medicine.ma_thuoc;

    document.getElementById("ma_thuoc").disabled = true;

    document.getElementById("ten_biet_duoc").value =
        medicine.ten_biet_duoc;

    document.getElementById("hoat_chat").value =
        medicine.hoat_chat;

    document.getElementById("so_luong_ton").value =
        medicine.so_luong_ton;

    openMedicineModal("medicine-form-modal");

}


// ==========================================
// 16. LƯU THUỐC
// ==========================================

async function handleSaveMedicine(event) {

    event.preventDefault();

    if (!canManageMedicine()) {
        showMedicineMessage(
            "Bạn không có quyền thực hiện chức năng này.",
            "error"
        );
        return;
    }

    const mode = document.getElementById(
        "medicine-form-mode"
    ).value;

    const medicineId = document.getElementById(
        "ma_thuoc"
    ).value.trim();

    const medicineName = document.getElementById(
        "ten_biet_duoc"
    ).value.trim();

    const activeIngredient = document.getElementById(
        "hoat_chat"
    ).value.trim();

    const stockValue = document.getElementById(
        "so_luong_ton"
    ).value;

    const stock = Number(stockValue);

    if (!medicineId || !medicineName || !activeIngredient) {
        showMedicineMessage(
            "Vui lòng nhập đầy đủ thông tin thuốc.",
            "error"
        );
        return;
    }

    if (mode === "create" && medicineId.length > 20) {
        showMedicineMessage(
            "Mã thuốc không được vượt quá 20 ký tự.",
            "error"
        );
        return;
    }

    if (medicineName.length > 100 || activeIngredient.length > 100) {
        showMedicineMessage(
            "Tên biệt dược và hoạt chất không được vượt quá 100 ký tự.",
            "error"
        );
        return;
    }

    if (
        stockValue.trim() === "" ||
        !Number.isInteger(stock) ||
        stock < 0
    ) {
        showMedicineMessage(
            "Số lượng tồn phải là số nguyên không âm.",
            "error"
        );
        return;
    }

    const data = {
        ten_biet_duoc: medicineName,
        hoat_chat: activeIngredient,
        so_luong_ton: stock
    };

    if (mode === "create") {
        data.ma_thuoc = medicineId;
    }

    const saveButton = document.getElementById("save-medicine");

    if (!saveButton || saveButton.disabled) return;

    saveButton.disabled = true;
    saveButton.textContent = "Đang lưu...";

    try {

        if (mode === "create") {

            await window.api.post(MEDICINE_API, data);

            showMedicineMessage("Thêm thuốc thành công.");

        } else {

            await window.api.put(
                `${MEDICINE_API}/${encodeURIComponent(currentMedicineId)}`,
                data
            );

            showMedicineMessage("Cập nhật thuốc thành công.");

        }

        closeMedicineForm();

        await loadMedicines();

    } catch (error) {

        console.error("Lỗi lưu thuốc:", error);

        showMedicineMessage(
            error.message || "Không thể lưu thông tin thuốc.",
            "error"
        );

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            mode === "create" ? "Lưu thuốc" : "Cập nhật";

    }

}


// ==========================================
// 17. ĐÓNG FORM THUỐC
// ==========================================

function closeMedicineForm() {

    closeMedicineModal("medicine-form-modal");

    currentMedicineId = null;

    const medicineIdInput = document.getElementById("ma_thuoc");

    if (medicineIdInput) {
        medicineIdInput.disabled = false;
    }

}


// ==========================================
// 18. XEM CHI TIẾT THUỐC
// ==========================================

function viewMedicineDetail(medicineId) {

    const medicine = medicines.find(
        item => item.ma_thuoc === medicineId
    );

    if (!medicine) {
        showMedicineMessage(
            "Không tìm thấy thông tin thuốc.",
            "error"
        );
        return;
    }

    const detail = document.getElementById("medicine-detail");

    if (!detail) return;

    const quantity = Number(medicine.so_luong_ton);

    const stockStatus = getMedicineStockStatus(quantity);

    detail.innerHTML = `

        <div class="medicine-detail-row">
            <strong>Mã thuốc:</strong>
            <span>${escapeHTML(medicine.ma_thuoc)}</span>
        </div>

        <div class="medicine-detail-row">
            <strong>Tên biệt dược:</strong>
            <span>${escapeHTML(medicine.ten_biet_duoc)}</span>
        </div>

        <div class="medicine-detail-row">
            <strong>Hoạt chất:</strong>
            <span>${escapeHTML(medicine.hoat_chat)}</span>
        </div>

        <div class="medicine-detail-row">
            <strong>Số lượng tồn:</strong>
            <span>${quantity.toLocaleString("vi-VN")}</span>
        </div>

        <div class="medicine-detail-row">
            <strong>Trạng thái kho:</strong>
            <span>
                <span class="medicine-stock-badge ${stockStatus.className}">
                    ${stockStatus.text}
                </span>
            </span>
        </div>

    `;

    openMedicineModal("medicine-detail-modal");

}


// ==========================================
// 19. ĐÓNG CHI TIẾT
// ==========================================

function closeMedicineDetail() {

    closeMedicineModal("medicine-detail-modal");

}


// ==========================================
// 20. MỞ MODAL XÓA
// ==========================================

function openDeleteMedicineModal(medicineId) {

    if (!canDeleteMedicine()) {
        showMedicineMessage(
            "Chỉ Admin mới có quyền xóa thuốc.",
            "error"
        );
        return;
    }

    const medicine = medicines.find(
        item => item.ma_thuoc === medicineId
    );

    if (!medicine) {
        showMedicineMessage(
            "Không tìm thấy thuốc cần xóa.",
            "error"
        );
        return;
    }

    medicineToDelete = medicineId;

    const nameElement = document.getElementById(
        "delete-medicine-name"
    );

    if (nameElement) {
        nameElement.textContent =
            `${medicine.ma_thuoc} - ${medicine.ten_biet_duoc}`;
    }

    openMedicineModal("delete-medicine-modal");

}


// ==========================================
// 21. XÁC NHẬN XÓA
// ==========================================

async function confirmDeleteMedicine() {

    if (!canDeleteMedicine()) {
        showMedicineMessage(
            "Chỉ Admin mới có quyền xóa thuốc.",
            "error"
        );
        return;
    }

    if (!medicineToDelete) return;

    const button = document.getElementById(
        "confirm-delete-medicine"
    );

    if (!button || button.disabled) return;

    button.disabled = true;
    button.textContent = "Đang xóa...";

    try {

        await window.api.delete(
            `${MEDICINE_API}/${encodeURIComponent(medicineToDelete)}`
        );

        showMedicineMessage("Xóa thuốc thành công.");

        closeDeleteMedicineModal();

        await loadMedicines();

    } catch (error) {

        console.error("Lỗi xóa thuốc:", error);

        showMedicineMessage(
            error.message ||
            "Không thể xóa thuốc.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Xác nhận xóa";

    }

}


// ==========================================
// 22. ĐÓNG MODAL XÓA
// ==========================================

function closeDeleteMedicineModal() {

    closeMedicineModal("delete-medicine-modal");

    medicineToDelete = null;

}
