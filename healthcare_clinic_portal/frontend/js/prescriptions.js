
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

    // Chờ tải giao diện và thông tin tài khoản
    if (typeof window.initializeLayout === "function") {
        await window.initializeLayout(
            "prescriptions",
            "Quản lý đơn thuốc"
        );
    }

    // Gắn sự kiện cho trang
    initializePrescriptionEvents();

    // Kiểm tra quyền sau khi tài khoản đã tải xong
    const role = getPrescriptionRole();

    const openButton = getElement(
        "open-create-prescription"
    );

    if (role === "Doctor" && openButton) {

        openButton.style.display = "inline-block";

        openButton.addEventListener(
            "click",
            openCreatePrescription
        );
    }

    // Đóng form kê đơn
    getElement("close-create-prescription")
        ?.addEventListener(
            "click",
            closeCreatePrescription
        );

    // Thêm thuốc
    getElement("add-prescription-medicine")
        ?.addEventListener(
            "click",
            addPrescriptionDraftItem
        );

    // Lưu đơn thuốc
    getElement("save-prescription")
        ?.addEventListener(
            "click",
            saveNewPrescription
        );

    // Xóa thuốc khỏi danh sách kê đơn
    getElement("new-prescription-items")
        ?.addEventListener("click", event => {

            const button = event.target.closest(
                "[data-remove-index]"
            );

            if (!button) {
                return;
            }

            prescriptionDraftItems.splice(
                Number(button.dataset.removeIndex),
                1
            );

            renderPrescriptionDraftItems();
        });

    // Tải danh sách đơn thuốc
    await loadPrescriptions();
});

// ==========================================
// 4. GẮN SỰ KIỆN
// ==========================================

function initializePrescriptionEvents() {

    // Tìm kiếm
    const searchInput = getElement("search-prescription");

    if (searchInput) {
        searchInput.addEventListener(
            "input",
            filterPrescriptions
        );
    }

    // Lọc trạng thái
    const statusFilter = getElement(
        "filter-prescription-status"
    );

    if (statusFilter) {
        statusFilter.addEventListener(
            "change",
            filterPrescriptions
        );
    }

    // Lọc ngày kê
    const dateFilter = getElement(
        "filter-prescription-date"
    );

    if (dateFilter) {
        dateFilter.addEventListener(
            "change",
            filterPrescriptions
        );
    }

    // Lọc bác sĩ
    const doctorFilter = getElement(
        "filter-prescription-doctor"
    );

    if (doctorFilter) {
        doctorFilter.addEventListener(
            "change",
            filterPrescriptions
        );
    }

    // Xóa bộ lọc
    const clearFilterButton = getElement(
        "clear-prescription-filters"
    );

    if (clearFilterButton) {

        clearFilterButton.addEventListener("click", () => {

            const searchInput = getElement(
                "search-prescription"
            );

            const statusFilter = getElement(
                "filter-prescription-status"
            );

            const dateFilter = getElement(
                "filter-prescription-date"
            );

            const doctorFilter = getElement(
                "filter-prescription-doctor"
            );

            if (searchInput) {
                searchInput.value = "";
            }

            if (statusFilter) {
                statusFilter.value = "";
            }

            if (dateFilter) {
                dateFilter.value = "";
            }

            if (doctorFilter) {
                doctorFilter.value = "";
            }

            filterPrescriptions();
        });
    }

    // Làm mới
    const refreshButton = getElement(
        "refresh-prescriptions"
    );

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadPrescriptions
        );
    }

    // Đóng modal
    const closeModalButton = getElement(
        "close-prescription-modal"
    );

    if (closeModalButton) {
        closeModalButton.addEventListener(
            "click",
            closePrescriptionModal
        );
    }

    const modal = getElement("prescription-modal");

    if (modal) {
        modal.addEventListener("click", event => {

            if (event.target === modal) {
                closePrescriptionModal();
            }

        });
    }

    // Event delegation cho các nút trong bảng
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

    // Nhấn ESC để đóng modal
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

        const response = await window.api.get(
            PRESCRIPTION_API
        );

        prescriptions = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : [];

        // Tạo danh sách bác sĩ
        renderPrescriptionDoctorFilter();

        // Áp dụng bộ lọc
        filterPrescriptions();

    } catch (error) {

        console.error(
            "Lỗi tải danh sách đơn thuốc:",
            error
        );

        prescriptions = [];
        filteredPrescriptions = [];

        renderPrescriptionDoctorFilter();
        renderPrescriptions();

        showPrescriptionMessage(
            error.message || "Không thể tải danh sách đơn thuốc",
            "error"
        );
    }
}


// ==========================================
// 6. TẠO DANH SÁCH BÁC SĨ
// ==========================================

function renderPrescriptionDoctorFilter() {

    const doctorFilter = getElement(
        "filter-prescription-doctor"
    );

    if (!doctorFilter) {
        return;
    }

    const selectedDoctor = doctorFilter.value;

    const doctors = new Map();

    prescriptions.forEach(prescription => {

        const doctorId = prescription.ma_bac_si;
        const doctorName = prescription.ten_bac_si;

        if (doctorId) {

            doctors.set(
                String(doctorId),
                doctorName || doctorId
            );

        }

    });

    doctorFilter.innerHTML = `
        <option value="">Tất cả bác sĩ</option>

        ${Array.from(doctors.entries())
            .map(([id, name]) => `
                <option value="${escapePrescriptionHTML(id)}">
                    ${escapePrescriptionHTML(name)}
                </option>
            `)
            .join("")}
    `;

    // Giữ lựa chọn bác sĩ nếu vẫn tồn tại
    if (doctors.has(selectedDoctor)) {
        doctorFilter.value = selectedDoctor;
    }
}


// ==========================================
// 7. TÌM KIẾM VÀ LỌC ĐƠN THUỐC
// ==========================================

function filterPrescriptions() {

    const searchValue = (
        getElement("search-prescription")?.value || ""
    ).trim().toLowerCase();

    const statusValue =
        getElement("filter-prescription-status")?.value || "";

    const dateValue =
        getElement("filter-prescription-date")?.value || "";

    const doctorValue =
        getElement("filter-prescription-doctor")?.value || "";

    filteredPrescriptions = prescriptions.filter(
        prescription => {

            const prescriptionId = String(
                prescription.ma_don_thuoc || ""
            ).toLowerCase();

            const patientName = String(
                prescription.ho_va_ten || ""
            ).toLowerCase();

            const recordId = String(
                prescription.ma_ho_so || ""
            ).toLowerCase();

            // Tìm theo mã đơn thuốc
            // Tìm theo tên bệnh nhân
            // Tìm theo mã hồ sơ
            const matchesSearch =
                prescriptionId.includes(searchValue) ||
                patientName.includes(searchValue) ||
                recordId.includes(searchValue);

            // Lọc trạng thái
            const matchesStatus =
                !statusValue ||
                prescription.trang_thai === statusValue;

            // Lọc ngày kê
            const prescriptionDate = String(
                prescription.thoi_gian_ke || ""
            ).slice(0, 10);

            const matchesDate =
                !dateValue ||
                prescriptionDate === dateValue;

            // Lọc bác sĩ
            const matchesDoctor =
                !doctorValue ||
                String(prescription.ma_bac_si || "") === doctorValue;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesDate &&
                matchesDoctor
            );

        }
    );

    renderPrescriptions();
}


// ==========================================
// 8. HIỂN THỊ DANH SÁCH ĐƠN THUỐC
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

    table.innerHTML = filteredPrescriptions.map(
        prescription => {

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
        }
    ).join("");

    updatePrescriptionCount(
        filteredPrescriptions.length
    );
}


// ==========================================
// 9. CẬP NHẬT SỐ LƯỢNG KẾT QUẢ
// ==========================================

function updatePrescriptionCount(count) {

    const resultCount = getElement(
        "prescription-result-count"
    );

    if (resultCount) {
        resultCount.textContent = count;
    }
}


// ==========================================
// 10. XEM CHI TIẾT ĐƠN THUỐC
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

        console.error(
            "Lỗi xem chi tiết đơn thuốc:",
            error
        );

        showPrescriptionMessage(
            error.message || "Không thể xem chi tiết đơn thuốc",
            "error"
        );
    }
}


// ==========================================
// 11. HIỂN THỊ CHI TIẾT ĐƠN THUỐC
// ==========================================

function renderPrescriptionDetail(prescription) {

    const container = getElement(
        "prescription-detail"
    );

    if (!container) {
        return;
    }

    const medicines = Array.isArray(prescription.chi_tiet)
        ? prescription.chi_tiet
        : [];

    const medicineRows = medicines.length > 0

        ? medicines.map((medicine, index) => `

            <tr>

                <td>
                    ${index + 1}
                </td>

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
                    <strong>Bác sĩ kê đơn:</strong>
                    ${escapePrescriptionHTML(
                        prescription.ten_bac_si || "—"
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
// 12. ĐÓNG MODAL
// ==========================================

function closePrescriptionModal() {

    const modal = getElement(
        "prescription-modal"
    );

    if (modal) {
        modal.classList.remove("show");
    }
}


// ==========================================
// 13. CẤP PHÁT THUỐC
// ==========================================

async function dispensePrescription(id) {

    // Kiểm tra quyền frontend
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

    // Chỉ cấp phát đơn đang hiệu lực
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

        console.error(
            "Lỗi cấp phát thuốc:",
            error
        );

        showPrescriptionMessage(
            error.message || "Không thể cấp phát thuốc",
            "error"
        );
    }
}
// ==========================================
// 10. BÁC SĨ KÊ ĐƠN THUỐC MỚI
// ==========================================

let prescriptionFormMedicines = [];
let prescriptionDraftItems = [];


// ==========================================
// MỞ FORM KÊ ĐƠN
// ==========================================

async function openCreatePrescription() {

    try {

        const response = await window.api.get(
            `${PRESCRIPTION_API}/form-options`
        );

        const data = response?.data || response;

        prescriptionFormMedicines = data?.thuoc || [];

        prescriptionDraftItems = [];

        const recordSelect = getElement(
            "prescription-record"
        );

        recordSelect.innerHTML =
            '<option value="">-- Chọn hồ sơ bệnh án --</option>' +

            (data?.ho_so || []).map(record => `
                <option value="${escapePrescriptionHTML(record.ma_ho_so)}">
                    ${escapePrescriptionHTML(record.ma_ho_so)}
                    -
                    ${escapePrescriptionHTML(record.ho_va_ten)}
                    ${record.chan_doan
                        ? " - " + escapePrescriptionHTML(record.chan_doan)
                        : ""}
                </option>
            `).join("");

        const medicineSelect = getElement(
            "prescription-medicine"
        );

        medicineSelect.innerHTML =
            '<option value="">-- Chọn thuốc --</option>' +

            prescriptionFormMedicines.map(medicine => `
                <option value="${escapePrescriptionHTML(medicine.ma_thuoc)}">
                    ${escapePrescriptionHTML(medicine.ten_biet_duoc)}
                    (${escapePrescriptionHTML(medicine.hoat_chat)})
                    - Tồn: ${Number(medicine.so_luong_ton)}
                </option>
            `).join("");

        renderPrescriptionDraftItems();

        getElement(
            "create-prescription-message"
        ).textContent = "";

        getElement(
            "create-prescription-modal"
        ).classList.add("show");

    } catch (error) {

        showPrescriptionMessage(
            error.message || "Không tải được dữ liệu kê đơn.",
            "error"
        );
    }
}


// ==========================================
// ĐÓNG FORM
// ==========================================

function closeCreatePrescription() {

    getElement(
        "create-prescription-modal"
    )?.classList.remove("show");
}


// ==========================================
// THÊM THUỐC VÀO ĐƠN
// ==========================================

function addPrescriptionDraftItem() {

    const medicineId = getElement(
        "prescription-medicine"
    ).value;

    const quantity = Number(
        getElement("prescription-quantity").value
    );

    const dose = getElement(
        "prescription-dose"
    ).value.trim();

    const route = getElement(
        "prescription-route"
    ).value.trim();

    const medicine = prescriptionFormMedicines.find(
        item => String(item.ma_thuoc) === String(medicineId)
    );

    const message = getElement(
        "create-prescription-message"
    );

    if (
        !medicine ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !dose ||
        !route
    ) {

        message.textContent =
            "Vui lòng chọn thuốc và nhập đầy đủ số lượng, liều dùng, đường dùng.";

        return;
    }

    if (
        prescriptionDraftItems.some(
            item => item.ma_thuoc === medicineId
        )
    ) {

        message.textContent =
            "Thuốc này đã có trong đơn.";

        return;
    }

    prescriptionDraftItems.push({

        ma_thuoc: medicineId,

        ten_biet_duoc: medicine.ten_biet_duoc,

        so_luong_ton: medicine.so_luong_ton,

        so_luong: quantity,

        lieu_dung: dose,

        duong_dung: route
    });

    message.textContent = "";

    getElement("prescription-medicine").value = "";

    getElement("prescription-quantity").value = "1";

    getElement("prescription-dose").value = "";

    getElement("prescription-route").value = "";

    renderPrescriptionDraftItems();
}


// ==========================================
// HIỂN THỊ DANH SÁCH THUỐC
// ==========================================

function renderPrescriptionDraftItems() {

    const body = getElement(
        "new-prescription-items"
    );

    if (!prescriptionDraftItems.length) {

        body.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    Chưa có thuốc
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML = prescriptionDraftItems.map(
        (item, index) => `

            <tr>
                <td>
                    ${escapePrescriptionHTML(item.ten_biet_duoc)}
                </td>

                <td>
                    ${Number(item.so_luong_ton)}
                </td>

                <td>
                    ${Number(item.so_luong)}
                </td>

                <td>
                    ${escapePrescriptionHTML(item.lieu_dung)}
                </td>

                <td>
                    ${escapePrescriptionHTML(item.duong_dung)}
                </td>

                <td>
                    <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        data-remove-index="${index}"
                    >
                        Xóa
                    </button>
                </td>
            </tr>

        `
    ).join("");
}


// ==========================================
// LƯU ĐƠN THUỐC
// ==========================================

async function saveNewPrescription() {

    const recordId = getElement(
        "prescription-record"
    ).value;

    const message = getElement(
        "create-prescription-message"
    );

    if (
        !recordId ||
        !prescriptionDraftItems.length
    ) {

        message.textContent =
            "Vui lòng chọn hồ sơ và thêm ít nhất một thuốc.";

        return;
    }

    const button = getElement(
        "save-prescription"
    );

    button.disabled = true;

    try {

        await window.api.post(
            PRESCRIPTION_API,
            {
                ma_ho_so: recordId,

                chi_tiet: prescriptionDraftItems.map(
                    item => ({
                        ma_thuoc: item.ma_thuoc,
                        so_luong: item.so_luong,
                        lieu_dung: item.lieu_dung,
                        duong_dung: item.duong_dung
                    })
                )
            }
        );

        closeCreatePrescription();

        showPrescriptionMessage(
            "Kê đơn thuốc thành công.",
            "success"
        );

        await loadPrescriptions();

    } catch (error) {

        message.textContent =
            error.message || "Không thể lưu đơn thuốc.";

    } finally {

        button.disabled = false;
    }
}