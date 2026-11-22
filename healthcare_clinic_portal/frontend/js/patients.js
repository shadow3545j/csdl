
"use strict";

// ==========================================
// 1. BIẾN TOÀN CỤC
// ==========================================

let patients = [];
let filteredPatients = [];

let editingPatientId = null;

let currentPatientPage = 1;
const PATIENTS_PER_PAGE = 8;

let isLoadingPatients = false;


// ==========================================
// 2. KIỂM TRA QUYỀN
// ==========================================

function canPatientAction(permission) {
    return (
        typeof window.can === "function" &&
        window.can(permission)
    );
}


// ==========================================
// 3. KHỞI TẠO TRANG
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    await initializeLayout(
        "patients",
        "Quản lý bệnh nhân"
    );

    bindPatientEvents();

    const currentAccount = (
        typeof window.getCurrentAccountData === "function"
            ? window.getCurrentAccountData()
            : null
    );

    // Patient chỉ xem hồ sơ được liên kết với tài khoản của mình.
    if (currentAccount?.vai_tro === "Patient") {
        await loadOwnPatientProfile(currentAccount);
        return;
    }

    // Không cho chọn ngày sinh trong tương lai
    const birthDateInput = document.getElementById("ngay_sinh");

    if (birthDateInput) {
        birthDateInput.max = new Date()
            .toISOString()
            .split("T")[0];
    }

    await loadPatients();

});

// ==========================================
// 4. GẮN SỰ KIỆN
// ==========================================

function bindPatientEvents() {

    document
        .getElementById("add-patient-btn")
        ?.addEventListener("click", openCreatePatientModal);

    document
        .getElementById("close-patient-modal")
        ?.addEventListener("click", closePatientModal);

    document
        .getElementById("cancel-patient-modal")
        ?.addEventListener("click", closePatientModal);

    document
        .getElementById("patient-form")
        ?.addEventListener("submit", savePatient);

    document
        .getElementById("refresh-patients")
        ?.addEventListener("click", loadPatients);

    document
        .getElementById("search-patient")
        ?.addEventListener("input", searchPatients);

    document
        .getElementById("gender-filter")
        ?.addEventListener("change", searchPatients);

    document
        .getElementById("prev-page")
        ?.addEventListener("click", () => changePatientPage(-1));

    document
        .getElementById("next-page")
        ?.addEventListener("click", () => changePatientPage(1));

    document
        .getElementById("patients-table")
        ?.addEventListener("click", handlePatientTableClick);

    document
        .getElementById("patient-modal")
        ?.addEventListener("click", event => {

            if (event.target.id === "patient-modal") {
                closePatientModal();
            }

        });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closePatientModal();
        }

    });

}
// ==========================================
// 5. HỒ SƠ CÁ NHÂN CỦA PATIENT
// ==========================================

async function loadOwnPatientProfile(account) {

    const profileSection = document.getElementById("patient-own-profile");
    const profileContent = document.getElementById("patient-own-profile-content");
    const statsSection = document.getElementById("patient-stats-section");
    const tableSection = document.getElementById("patient-table-section");
    const addButton = document.getElementById("add-patient-btn");
    const modal = document.getElementById("patient-modal");

    const heading = document.querySelector(".patient-heading h1");
    const description = document.querySelector(".patient-heading p");

    // Ẩn thống kê và danh sách bệnh nhân
    if (statsSection) {
        statsSection.hidden = true;
        statsSection.style.display = "none";
    }

    if (tableSection) {
        tableSection.hidden = true;
        tableSection.style.display = "none";
    }

    // Patient không được thêm bệnh nhân
    if (addButton) {
        addButton.hidden = true;
        addButton.style.display = "none";
    }

    if (modal) {
        modal.hidden = true;
        modal.style.display = "none";
    }

    // Đổi tiêu đề trang
    if (heading) {
        heading.textContent = "Hồ sơ cá nhân";
    }

    if (description) {
        description.textContent = "Thông tin hồ sơ bệnh nhân của bạn.";
    }

    // Hiển thị khu vực hồ sơ cá nhân
    if (profileSection) {
        profileSection.hidden = false;
        profileSection.style.display = "block";
    }

    // Kiểm tra tài khoản có liên kết bệnh nhân không
    if (!account?.ma_benh_nhan) {

        if (profileContent) {
            profileContent.innerHTML = `
                <p class="empty-state">
                    Tài khoản chưa được liên kết với hồ sơ bệnh nhân.
                    Vui lòng liên hệ quản trị viên.
                </p>
            `;
        }

        return;
    }

    if (profileContent) {
        profileContent.innerHTML = "<p>Đang tải hồ sơ cá nhân...</p>";
    }

    try {

        // Chỉ lấy hồ sơ của mã bệnh nhân đang đăng nhập
        const patient = await API.get(
            `/patients/${encodeURIComponent(account.ma_benh_nhan)}`
        );

        // Kiểm tra dữ liệu trả về có đúng hồ sơ của mình không
        if (
            !patient ||
            patient.ma_benh_nhan !== account.ma_benh_nhan
        ) {
            throw new Error("Không tìm thấy hồ sơ cá nhân hợp lệ.");
        }

        const fields = [
            ["Mã bệnh nhân", patient.ma_benh_nhan],
            ["Họ và tên", patient.ho_va_ten],
            ["Ngày sinh", formatPatientDate(patient.ngay_sinh)],
            ["Giới tính", patient.gioi_tinh],
            ["Số điện thoại", patient.so_dien_thoai],
            ["CCCD", patient.can_cuoc_cong_dan],
            [
                "Tóm tắt tiền sử",
                patient.tom_tat_tien_su || "Chưa cập nhật"
            ]
        ];

        if (profileContent) {

            profileContent.innerHTML = `
                <div class="grid grid-2" style="gap: 16px;">

                    ${fields.map(([label, value]) => `
                        <div style="
                            padding: 14px;
                            border: 1px solid #e2e8f0;
                            border-radius: 10px;
                        ">
                            <div style="
                                font-size: 13px;
                                color: #64748b;
                                margin-bottom: 6px;
                            ">
                                ${escapeHTML(label)}
                            </div>

                            <div style="
                                font-weight: 600;
                                overflow-wrap: anywhere;
                            ">
                                ${escapeHTML(value)}
                            </div>
                        </div>
                    `).join("")}

                </div>

                <p style="
                    margin-top: 18px;
                    color: #64748b;
                    font-size: 13px;
                ">
                    Bạn chỉ có quyền xem hồ sơ này.
                    Nếu cần chỉnh sửa thông tin,
                    vui lòng liên hệ lễ tân hoặc quản trị viên.
                </p>
            `;
        }

    } catch (error) {

        console.error(
            "Lỗi tải hồ sơ cá nhân:",
            error
        );

        if (profileContent) {
            profileContent.innerHTML = `
                <p class="empty-state">
                    ${escapeHTML(
                        error.message || "Không thể tải hồ sơ cá nhân."
                    )}
                </p>
            `;
        }

        showMessage(
            error.message || "Không thể tải hồ sơ cá nhân.",
            "error"
        );

    }

}

// ==========================================
// 5. TẢI DANH SÁCH BỆNH NHÂN
// ==========================================

async function loadPatients() {

    const currentAccount = (
        typeof window.getCurrentAccountData === "function"
            ? window.getCurrentAccountData()
            : null
    );

    // Patient không được tải danh sách bệnh nhân.
    // Nếu gọi hàm này thì chỉ tải hồ sơ cá nhân.
    if (currentAccount?.vai_tro === "Patient") {
        await loadOwnPatientProfile(currentAccount);
        return;
    }

    if (isLoadingPatients) return;

    isLoadingPatients = true;

    const tbody = document.getElementById("patients-table");
    const refreshButton = document.getElementById("refresh-patients");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Đang tải...";
    }

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Đang tải dữ liệu bệnh nhân...
                </td>
            </tr>
        `;
    }

    try {

        const result = await API.get("/patients");

        // Hỗ trợ API trả về mảng trực tiếp
        // hoặc object chứa data
        if (Array.isArray(result)) {
            patients = result;
        } else if (Array.isArray(result?.data)) {
            patients = result.data;
        } else {
            patients = [];
        }

        currentPatientPage = 1;

        updatePatientStatistics();
        searchPatients();

    } catch (error) {

        patients = [];
        filteredPatients = [];

        updatePatientStatistics();

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        const recordInfo = document.getElementById(
            "patient-record-info"
        );

        if (recordInfo) {
            recordInfo.textContent = "Không thể tải dữ liệu";
        }

        showMessage(error.message, "error");

    } finally {

        isLoadingPatients = false;

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Làm mới";
        }

    }

}


// ==========================================
// 6. THỐNG KÊ BỆNH NHÂN
// ==========================================

function updatePatientStatistics() {

    const total = patients.length;

    const male = patients.filter(
        patient => patient.gioi_tinh === "Nam"
    ).length;

    const female = patients.filter(
        patient => patient.gioi_tinh === "Nữ"
    ).length;

    const other = patients.filter(
        patient => patient.gioi_tinh === "Khác"
    ).length;

    const totalElement = document.getElementById("total-patients");
    const maleElement = document.getElementById("male-patients");
    const femaleElement = document.getElementById("female-patients");
    const otherElement = document.getElementById("other-patients");

    if (totalElement) totalElement.textContent = total;
    if (maleElement) maleElement.textContent = male;
    if (femaleElement) femaleElement.textContent = female;
    if (otherElement) otherElement.textContent = other;

}


// ==========================================
// 7. TÌM KIẾM VÀ LỌC
// ==========================================

function searchPatients() {

    const searchInput = document.getElementById("search-patient");
    const genderInput = document.getElementById("gender-filter");

    const keyword = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const gender = genderInput?.value || "";

    filteredPatients = patients.filter(patient => {

        const searchableText = [
            patient.ma_benh_nhan,
            patient.ho_va_ten,
            patient.so_dien_thoai,
            patient.can_cuoc_cong_dan
        ]
            .map(value => String(value || "").toLowerCase())
            .join(" ");

        const matchesKeyword = searchableText.includes(keyword);

        const matchesGender =
            !gender || patient.gioi_tinh === gender;

        return matchesKeyword && matchesGender;

    });

    currentPatientPage = 1;

    renderPatients();

}


// ==========================================
// 8. PHÂN TRANG
// ==========================================

function changePatientPage(direction) {

    const totalPages = Math.max(
        1,
        Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE)
    );

    const nextPage = currentPatientPage + direction;

    if (nextPage < 1 || nextPage > totalPages) {
        return;
    }

    currentPatientPage = nextPage;

    renderPatients();

}


// ==========================================
// 9. CHUẨN HÓA NGÀY SINH
// ==========================================

function normalizePatientDate(value) {

    if (!value) return "";

    const dateText = String(value).trim();

    // YYYY-MM-DD hoặc YYYY-MM-DD HH:mm:ss
    let match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // DD/MM/YYYY hoặc DD/MM/YY
    match = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

    if (match) {

        let year = Number(match[3]);

        if (year < 100) {
            year += year < 50 ? 2000 : 1900;
        }

        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    // Ngày dạng RFC do Flask trả về
    const parsed = new Date(dateText);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return [
        parsed.getUTCFullYear(),
        String(parsed.getUTCMonth() + 1).padStart(2, "0"),
        String(parsed.getUTCDate()).padStart(2, "0")
    ].join("-");

}


// ==========================================
// 10. ĐỊNH DẠNG NGÀY SINH
// ==========================================

function formatPatientDate(value) {

    const normalized = normalizePatientDate(value);

    if (!normalized) return "—";

    const [year, month, day] = normalized.split("-");

    return `${day}/${month}/${year}`;

}


// ==========================================
// 11. LẤY CHỮ VIẾT TẮT TÊN
// ==========================================

function getPatientInitials(fullName) {

    if (!fullName) return "BN";

    const words = String(fullName)
        .trim()
        .split(/\s+/);

    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }

    return (
        words[0].charAt(0) +
        words[words.length - 1].charAt(0)
    ).toUpperCase();

}


// ==========================================
// 12. HIỂN THỊ DANH SÁCH BỆNH NHÂN
// ==========================================

function renderPatients() {

    const tbody = document.getElementById("patients-table");

    if (!tbody) return;

    const totalItems = filteredPatients.length;

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / PATIENTS_PER_PAGE)
    );

    const startIndex =
        (currentPatientPage - 1) * PATIENTS_PER_PAGE;

    const endIndex = Math.min(
        startIndex + PATIENTS_PER_PAGE,
        totalItems
    );

    const pageItems = filteredPatients.slice(
        startIndex,
        endIndex
    );

    if (pageItems.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Không tìm thấy bệnh nhân phù hợp.
                </td>
            </tr>
        `;

    } else {

        tbody.innerHTML = pageItems.map(patient => {

            const id = escapeHTML(patient.ma_benh_nhan);
            const name = escapeHTML(patient.ho_va_ten);
            const gender = escapeHTML(patient.gioi_tinh);
            const phone = escapeHTML(patient.so_dien_thoai);
            const citizenId = escapeHTML(patient.can_cuoc_cong_dan);

            let genderClass = "gender-other";

            if (patient.gioi_tinh === "Nam") {
                genderClass = "gender-male";
            }

            if (patient.gioi_tinh === "Nữ") {
                genderClass = "gender-female";
            }

            const initials = escapeHTML(
                getPatientInitials(patient.ho_va_ten)
            );

            const canUpdate = canPatientAction("patients.update");
            const canDelete = canPatientAction("patients.delete");

            return `
                <tr>

                    <td>${id}</td>

                    <td>
                        <div class="patient-name-cell">

                            <div class="patient-avatar">
                                ${initials}
                            </div>

                            <div class="patient-name-info">

                                <strong>${name}</strong>

                                <small>
                                    Mã hồ sơ: ${id}
                                </small>

                            </div>

                        </div>
                    </td>

                    <td>
                        ${escapeHTML(formatPatientDate(patient.ngay_sinh))}
                    </td>

                    <td>
                        <span class="gender-label ${genderClass}">
                            ${gender}
                        </span>
                    </td>

                    <td>${phone}</td>

                    <td>${citizenId}</td>

                    <td>
                        <div class="actions">

                            ${
                                canUpdate
                                    ? `
                                        <button
                                            type="button"
                                            class="patient-action-btn patient-edit-btn"
                                            data-action="edit"
                                            data-id="${id}"
                                            title="Chỉnh sửa"
                                            aria-label="Chỉnh sửa bệnh nhân ${id}"
                                        >
                                            ✎
                                        </button>
                                    `
                                    : ""
                            }

                            ${
                                canDelete
                                    ? `
                                        <button
                                            type="button"
                                            class="patient-action-btn patient-delete-btn"
                                            data-action="delete"
                                            data-id="${id}"
                                            title="Xóa"
                                            aria-label="Xóa bệnh nhân ${id}"
                                        >
                                            ×
                                        </button>
                                    `
                                    : ""
                            }

                            ${
                                !canUpdate && !canDelete
                                    ? `<span>Chỉ xem</span>`
                                    : ""
                            }

                        </div>
                    </td>

                </tr>
            `;

        }).join("");

    }

    // Cập nhật thông tin phân trang
    const recordInfo = document.getElementById(
        "patient-record-info"
    );

    if (recordInfo) {

        recordInfo.textContent = totalItems === 0
            ? "Không có dữ liệu"
            : `Hiển thị ${startIndex + 1} - ${endIndex} trong tổng số ${totalItems} bệnh nhân`;

    }

    const pageIndicator = document.getElementById("page-indicator");

    if (pageIndicator) {
        pageIndicator.textContent =
            `${currentPatientPage} / ${totalPages}`;
    }

    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");

    if (prevButton) {
        prevButton.disabled = currentPatientPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled = currentPatientPage >= totalPages;
    }

}


// ==========================================
// 13. XỬ LÝ NÚT SỬA VÀ XÓA
// ==========================================

function handlePatientTableClick(event) {

    const button = event.target.closest("[data-action]");

    if (!button) return;

    const patientId = button.dataset.id;
    const action = button.dataset.action;

    if (action === "edit") {

        if (!canPatientAction("patients.update")) {
            showMessage(
                "Bạn không có quyền sửa bệnh nhân.",
                "error"
            );
            return;
        }

        editPatient(patientId);
    }

    if (action === "delete") {

        if (!canPatientAction("patients.delete")) {
            showMessage(
                "Bạn không có quyền xóa bệnh nhân.",
                "error"
            );
            return;
        }

        deletePatient(patientId);
    }

}


// ==========================================
// 14. MỞ FORM THÊM BỆNH NHÂN
// ==========================================

function openCreatePatientModal() {

    if (!canPatientAction("patients.create")) {
        showMessage(
            "Bạn không có quyền thêm bệnh nhân.",
            "error"
        );
        return;
    }

    editingPatientId = null;

    const form = document.getElementById("patient-form");

    if (!form) return;

    form.reset();

    const patientIdInput = document.getElementById("ma_benh_nhan");

    if (patientIdInput) {
        patientIdInput.disabled = false;
    }

    const title = document.getElementById("patient-modal-title");

    if (title) {
        title.textContent = "Thêm bệnh nhân mới";
    }

    const saveButton = document.getElementById("save-patient-btn");

    if (saveButton) {
        saveButton.innerHTML = "<span>✓</span> Lưu thông tin";
    }

    openPatientModal();

}


// ==========================================
// 15. MỞ MODAL
// ==========================================

function openPatientModal() {

    const modal = document.getElementById("patient-modal");

    if (!modal) return;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    setTimeout(() => {

        const firstInput = editingPatientId
            ? document.getElementById("ho_va_ten")
            : document.getElementById("ma_benh_nhan");

        firstInput?.focus();

    }, 100);

}


// ==========================================
// 16. ĐÓNG MODAL
// ==========================================

function closePatientModal() {

    const modal = document.getElementById("patient-modal");

    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";

}


// ==========================================
// 17. LẤY THÔNG TIN BỆNH NHÂN ĐỂ SỬA
// ==========================================

async function editPatient(patientId) {

    if (!canPatientAction("patients.update")) {
        showMessage(
            "Bạn không có quyền sửa bệnh nhân.",
            "error"
        );
        return;
    }

    try {

        const response = await API.get(
            `/patients/${encodeURIComponent(patientId)}`
        );

        // Hỗ trợ API trả về object trực tiếp
        // hoặc object chứa data
        let patient = response;

        if (response?.data && !Array.isArray(response.data)) {
            patient = response.data;
        }

        if (patient?.data && !Array.isArray(patient.data)) {
            patient = patient.data;
        }

        if (!patient || !patient.ma_benh_nhan) {
            throw new Error(
                "Không tìm thấy thông tin bệnh nhân."
            );
        }

        editingPatientId = patientId;

        const form = document.getElementById("patient-form");

        if (!form) {
            throw new Error("Không tìm thấy biểu mẫu bệnh nhân.");
        }

        form.reset();

        form.elements.namedItem("ma_benh_nhan").value =
            patient.ma_benh_nhan || "";

        form.elements.namedItem("ho_va_ten").value =
            patient.ho_va_ten || "";

        form.elements.namedItem("ngay_sinh").value =
            normalizePatientDate(patient.ngay_sinh);

        form.elements.namedItem("gioi_tinh").value =
            patient.gioi_tinh || "";

        form.elements.namedItem("so_dien_thoai").value =
            patient.so_dien_thoai || "";

        form.elements.namedItem("can_cuoc_cong_dan").value =
            patient.can_cuoc_cong_dan || "";

        form.elements.namedItem("tom_tat_tien_su").value =
            patient.tom_tat_tien_su || "";

        const patientIdInput = document.getElementById("ma_benh_nhan");

        if (patientIdInput) {
            patientIdInput.disabled = true;
        }

        const title = document.getElementById("patient-modal-title");

        if (title) {
            title.textContent = "Cập nhật thông tin bệnh nhân";
        }

        const saveButton = document.getElementById("save-patient-btn");

        if (saveButton) {
            saveButton.innerHTML =
                "<span>✓</span> Cập nhật thông tin";
        }

        openPatientModal();

    } catch (error) {

        console.error(
            "Lỗi lấy thông tin bệnh nhân:",
            error
        );

        showMessage(error.message, "error");

    }

}


// ==========================================
// 18. LƯU BỆNH NHÂN
// ==========================================

async function savePatient(event) {

    event.preventDefault();

    // Xác định quyền theo thao tác
    const isEditing = Boolean(editingPatientId);

    const requiredPermission = isEditing
        ? "patients.update"
        : "patients.create";

    if (!canPatientAction(requiredPermission)) {

        showMessage(
            "Bạn không có quyền thực hiện thao tác này.",
            "error"
        );

        return;
    }

    const form = document.getElementById("patient-form");

    if (!form || !form.reportValidity()) {
        return;
    }

    const saveButton = document.getElementById("save-patient-btn");

    if (!saveButton || saveButton.disabled) {
        return;
    }

    const formData = new FormData(form);

    const data = Object.fromEntries(formData.entries());

    // Khi cập nhật, mã bệnh nhân lấy từ editingPatientId
    data.ma_benh_nhan = (
        editingPatientId || data.ma_benh_nhan || ""
    ).trim();

    data.ho_va_ten = (
        data.ho_va_ten || ""
    ).trim();

    data.so_dien_thoai = (
        data.so_dien_thoai || ""
    ).trim();

    data.can_cuoc_cong_dan = (
        data.can_cuoc_cong_dan || ""
    ).trim();

    data.tom_tat_tien_su = (
        data.tom_tat_tien_su || ""
    ).trim() || null;

    // Ngày sinh gửi Backend theo YYYY-MM-DD
    data.ngay_sinh = normalizePatientDate(data.ngay_sinh);

    saveButton.disabled = true;
    saveButton.textContent = "Đang lưu...";

    try {

        if (isEditing) {

            // CẬP NHẬT
            await API.put(
                `/patients/${encodeURIComponent(editingPatientId)}`,
                data
            );

            showMessage(
                "Cập nhật thông tin bệnh nhân thành công."
            );

        } else {

            // THÊM MỚI
            await API.post("/patients", data);

            showMessage(
                "Thêm bệnh nhân mới thành công."
            );

        }

        closePatientModal();

        editingPatientId = null;

        await loadPatients();

    } catch (error) {

        showMessage(error.message, "error");

    } finally {

        saveButton.disabled = false;

        saveButton.innerHTML = isEditing
            ? "<span>✓</span> Cập nhật thông tin"
            : "<span>✓</span> Lưu thông tin";

    }

}


// ==========================================
// 19. XÓA BỆNH NHÂN
// ==========================================

async function deletePatient(patientId) {

    if (!canPatientAction("patients.delete")) {

        showMessage(
            "Bạn không có quyền xóa bệnh nhân.",
            "error"
        );

        return;
    }

    const patient = patients.find(
        item => item.ma_benh_nhan === patientId
    );

    const patientName = patient
        ? patient.ho_va_ten
        : patientId;

    const confirmed = confirm(
        `Bạn có chắc chắn muốn xóa bệnh nhân:

${patientName} (${patientId})?

Thao tác này không thể hoàn tác.`
    );

    if (!confirmed) return;

    try {

        await API.delete(
            `/patients/${encodeURIComponent(patientId)}`
        );

        showMessage(
            "Xóa bệnh nhân thành công."
        );

        await loadPatients();

    } catch (error) {

        showMessage(
            error.message ||
            "Không thể xóa bệnh nhân. Có thể bệnh nhân đang có dữ liệu liên quan.",
            "error"
        );

    }

}
