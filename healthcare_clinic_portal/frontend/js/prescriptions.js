
"use strict";

// ==========================================
// 1. KHAI BÁO BIẾN
// ==========================================

const PRESCRIPTION_API = "/prescriptions";

let prescriptions = [];
let filteredPrescriptions = [];


// ==========================================
// 2. HÀM HỖ TRỢ
// ==========================================

function getElement(id) {
    return document.getElementById(id);
}


function escapePrescriptionHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof window.escapeHTML === "function") {
        return window.escapeHTML(value);
    }

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


function getPrescriptionRole() {
    if (typeof window.getCurrentRole === "function") {
        return window.getCurrentRole();
    }

    if (typeof window.getCurrentAccountData === "function") {
        const account = window.getCurrentAccountData();

        return account?.vai_tro || null;
    }

    return null;
}


// Chỉ Admin và Pharmacist được cấp phát
function canDispensePrescription() {
    const role = getPrescriptionRole();

    return role === "Admin" || role === "Pharmacist";
}


function showPrescriptionMessage(message, type = "success") {
    if (typeof window.showMessage === "function") {
        window.showMessage(message, type);
        return;
    }

    alert(message);
}


function getPrescriptionStatus(status) {
    const labels = {
        Active: "Đang hiệu lực",
        Dispensed: "Đã cấp phát",
        Cancelled: "Đã hủy"
    };

    if (typeof window.getStatusBadge === "function") {
        return window.getStatusBadge(status);
    }

    const label = labels[status] || status || "Không xác định";

    return `
        <span class="badge">
            ${escapePrescriptionHTML(label)}
        </span>
    `;
}


function formatPrescriptionDate(value) {
    if (!value) {
        return "—";
    }

    if (typeof window.formatDateTime === "function") {
        return window.formatDateTime(value);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapePrescriptionHTML(value);
    }

    return date.toLocaleString("vi-VN");
}


// ==========================================
// 3. KHỞI TẠO TRANG
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof window.initializeLayout === "function") {
        await window.initializeLayout(
            "prescriptions",
            "Quản lý đơn thuốc"
        );
    }

    initializePrescriptionEvents();

    await loadPrescriptions();
});


// ==========================================
// 4. GẮN SỰ KIỆN
// ==========================================

function initializePrescriptionEvents() {
    const searchInput = getElement("search-prescription");

    if (searchInput) {
        searchInput.addEventListener("input", filterPrescriptions);
    }

    const statusFilter = getElement("filter-prescription-status");

    if (statusFilter) {
        statusFilter.addEventListener("change", filterPrescriptions);
    }

    const refreshButton = getElement("refresh-prescriptions");

    if (refreshButton) {
        refreshButton.addEventListener("click", loadPrescriptions);
    }

    const closeModalButton = getElement("close-prescription-modal");

    if (closeModalButton) {
        closeModalButton.addEventListener("click", closePrescriptionModal);
    }

    const modal = getElement("prescription-modal");

    if (modal) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closePrescriptionModal();
            }
        });
    }

    // Sử dụng event delegation cho các nút trong bảng
    const table = getElement("prescriptions-table");

    if (table) {
        table.addEventListener("click", event => {
            const detailButton = event.target.closest(
                "[data-action='view']"
            );

            const dispenseButton = event.target.closest(
                "[data-action='dispense']"
            );

            if (detailButton) {
                const id = detailButton.dataset.id;

                if (id) {
                    viewPrescription(id);
                }

                return;
            }

            if (dispenseButton) {
                const id = dispenseButton.dataset.id;

                if (id && canDispensePrescription()) {
                    dispensePrescription(id);
                }
            }
        });
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePrescriptionModal();
        }
    });
}


// ==========================================
// 5. LẤY DANH SÁCH ĐƠN THUỐC
// ==========================================

async function loadPrescriptions() {
    const table = getElement("prescriptions-table");

    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    Đang tải dữ liệu...
                </td>
            </tr>
        `;
    }

    try {
        const response = await window.api.get(PRESCRIPTION_API);

        prescriptions = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : [];

        filterPrescriptions();

    } catch (error) {
        console.error("Lỗi tải danh sách đơn thuốc:", error);

        prescriptions = [];
        filteredPrescriptions = [];

        renderPrescriptions();

        showPrescriptionMessage(
            error.message || "Không thể tải danh sách đơn thuốc",
            "error"
        );
    }
}


// ==========================================
// 6. TÌM KIẾM VÀ LỌC
// ==========================================

function filterPrescriptions() {
    const searchValue = (
        getElement("search-prescription")?.value || ""
    ).trim().toLowerCase();

    const statusValue =
        getElement("filter-prescription-status")?.value || "";

    filteredPrescriptions = prescriptions.filter(prescription => {
        const prescriptionId = String(
            prescription.ma_don_thuoc || ""
        ).toLowerCase();

        const patientName = String(
            prescription.ho_va_ten || ""
        ).toLowerCase();

        const recordId = String(
            prescription.ma_ho_so || ""
        ).toLowerCase();

        const matchesSearch =
            prescriptionId.includes(searchValue) ||
            patientName.includes(searchValue) ||
            recordId.includes(searchValue);

        const matchesStatus =
            !statusValue ||
            prescription.trang_thai === statusValue;

        return matchesSearch && matchesStatus;
    });

    renderPrescriptions();
}


// ==========================================
// 7. HIỂN THỊ DANH SÁCH
// ==========================================

function renderPrescriptions() {
    const table = getElement("prescriptions-table");

    if (!table) {
        return;
    }

    if (filteredPrescriptions.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    Không tìm thấy đơn thuốc
                </td>
            </tr>
        `;

        updatePrescriptionCount(0);
        return;
    }

    const canDispense = canDispensePrescription();

    table.innerHTML = filteredPrescriptions.map(prescription => {
        const id = escapePrescriptionHTML(
            prescription.ma_don_thuoc
        );

        const status = prescription.trang_thai;

        const dispenseButton =
            canDispense && status === "Active"
                ? `
                    <button
                        type="button"
                        class="btn btn-sm btn-success"
                        data-action="dispense"
                        data-id="${id}">
                        Cấp phát
                    </button>
                `
                : "";

        return `
            <tr>
                <td>
                    ${id}
                </td>

                <td>
                    ${escapePrescriptionHTML(
                        prescription.ma_ho_so || "—"
                    )}
                </td>

                <td>
                    ${escapePrescriptionHTML(
                        prescription.ho_va_ten || "—"
                    )}
                </td>

                <td>
                    ${formatPrescriptionDate(
                        prescription.thoi_gian_ke
                    )}
                </td>

                <td>
                    ${getPrescriptionStatus(status)}
                </td>

                <td>
                    <button
                        type="button"
                        class="btn btn-sm btn-info"
                        data-action="view"
                        data-id="${id}">
                        Chi tiết
                    </button>

                    ${dispenseButton}
                </td>
            </tr>
        `;
    }).join("");

    updatePrescriptionCount(filteredPrescriptions.length);
}


function updatePrescriptionCount(count) {
    const resultCount = getElement("prescription-result-count");

    if (resultCount) {
        resultCount.textContent = count;
    }
}


// ==========================================
// 8. XEM CHI TIẾT ĐƠN THUỐC
// ==========================================

async function viewPrescription(id) {
    try {
        const response = await window.api.get(
            `${PRESCRIPTION_API}/${encodeURIComponent(id)}`
        );

        const prescription = response?.data || response;

        if (!prescription) {
            showPrescriptionMessage(
                "Không tìm thấy thông tin đơn thuốc",
                "error"
            );
            return;
        }

        renderPrescriptionDetail(prescription);

        const modal = getElement("prescription-modal");

        if (modal) {
            modal.classList.add("show");
        }

    } catch (error) {
        console.error("Lỗi xem chi tiết đơn thuốc:", error);

        showPrescriptionMessage(
            error.message || "Không thể xem chi tiết đơn thuốc",
            "error"
        );
    }
}


// ==========================================
// 9. HIỂN THỊ CHI TIẾT
// ==========================================

function renderPrescriptionDetail(prescription) {
    const container = getElement("prescription-detail");

    if (!container) {
        return;
    }

    const medicines = Array.isArray(prescription.chi_tiet)
        ? prescription.chi_tiet
        : [];

    const medicineRows = medicines.length > 0
        ? medicines.map((medicine, index) => `
            <tr>
                <td>${index + 1}</td>

                <td>
                    ${escapePrescriptionHTML(
                        medicine.ten_biet_duoc || "—"
                    )}
                </td>

                <td>
                    ${escapePrescriptionHTML(
                        medicine.so_luong ?? "—"
                    )}
                </td>

                <td>
                    ${escapePrescriptionHTML(
                        medicine.so_luong_ton ?? "—"
                    )}
                </td>

                <td>
                    ${escapePrescriptionHTML(
                        medicine.lieu_dung || "—"
                    )}
                </td>

                <td>
                    ${escapePrescriptionHTML(
                        medicine.duong_dung || "—"
                    )}
                </td>
            </tr>
        `).join("")
        : `
            <tr>
                <td colspan="6" class="text-center">
                    Không có thuốc trong đơn
                </td>
            </tr>
        `;

    container.innerHTML = `
        <div class="prescription-detail-content">

            <div class="detail-section">
                <h3>Thông tin đơn thuốc</h3>

                <p>
                    <strong>Mã đơn thuốc:</strong>
                    ${escapePrescriptionHTML(
                        prescription.ma_don_thuoc || "—"
                    )}
                </p>

                <p>
                    <strong>Mã hồ sơ:</strong>
                    ${escapePrescriptionHTML(
                        prescription.ma_ho_so || "—"
                    )}
                </p>

                <p>
                    <strong>Bệnh nhân:</strong>
                    ${escapePrescriptionHTML(
                        prescription.ho_va_ten || "—"
                    )}
                </p>

                <p>
                    <strong>Thời gian kê:</strong>
                    ${formatPrescriptionDate(
                        prescription.thoi_gian_ke
                    )}
                </p>

                <p>
                    <strong>Trạng thái:</strong>
                    ${getPrescriptionStatus(
                        prescription.trang_thai
                    )}
                </p>
            </div>

            <div class="detail-section">
                <h3>Danh sách thuốc</h3>

                <div class="table-wrapper">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Tên thuốc</th>
                                <th>Số lượng</th>
                                <th>Tồn kho</th>
                                <th>Liều dùng</th>
                                <th>Đường dùng</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${medicineRows}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;
}


// ==========================================
// 10. ĐÓNG MODAL
// ==========================================

function closePrescriptionModal() {
    const modal = getElement("prescription-modal");

    if (modal) {
        modal.classList.remove("show");
    }
}


// ==========================================
// 11. CẤP PHÁT THUỐC
// ==========================================

async function dispensePrescription(id) {
    // Kiểm tra quyền ở frontend
    if (!canDispensePrescription()) {
        showPrescriptionMessage(
            "Bạn không có quyền cấp phát thuốc",
            "error"
        );
        return;
    }

    const prescription = prescriptions.find(item =>
        String(item.ma_don_thuoc) === String(id)
    );

    if (!prescription) {
        showPrescriptionMessage(
            "Không tìm thấy đơn thuốc",
            "error"
        );
        return;
    }

    if (prescription.trang_thai !== "Active") {
        showPrescriptionMessage(
            "Chỉ có thể cấp phát đơn thuốc đang hiệu lực",
            "error"
        );
        return;
    }

    const confirmed = confirm(
        `Bạn có chắc chắn muốn cấp phát đơn thuốc ${id} không?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await window.api.post(
            `${PRESCRIPTION_API}/${encodeURIComponent(id)}/dispense`,
            {}
        );

        showPrescriptionMessage(
            "Cấp phát thuốc thành công",
            "success"
        );

        await loadPrescriptions();

    } catch (error) {
        console.error("Lỗi cấp phát thuốc:", error);

        showPrescriptionMessage(
            error.message || "Không thể cấp phát thuốc",
            "error"
        );
    }
}
