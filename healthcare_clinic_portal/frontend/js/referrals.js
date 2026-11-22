
"use strict";

// =========================================================
// REFERRALS - QUẢN LÝ PHIẾU CHUYỂN TUYẾN
// =========================================================

document.addEventListener("DOMContentLoaded", async function () {

    await initializeLayout(
        "referrals",
        "Quản lý phiếu chuyển tuyến"
    );

    const state = {
        referrals: [],
        filteredReferrals: [],
        formOptions: null,
        currentRole: null,
        currentAccount: null,
        selectedReferral: null,
        specialists: []
    };

    const $ = (id) => document.getElementById(id);

    // =====================================================
    // 1. CẤU HÌNH VÀ TIỆN ÍCH
    // =====================================================

    function escapeHTML(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value).replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function getValue(value, fallback = "—") {
        if (value === null || value === undefined || value === "") {
            return fallback;
        }

        return value;
    }

    function formatDateTime(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatStatus(status) {
        const labels = {
            Pending: "Chờ tiếp nhận",
            Accepted: "Đã tiếp nhận",
            Completed: "Đã hoàn thành"
        };

        return labels[status] || status || "Không xác định";
    }

    function getStatusClass(status) {
        const classes = {
            Pending: "pending",
            Accepted: "accepted",
            Completed: "completed"
        };

        return classes[status] || "";
    }

    function showNotification(message, type = "success") {
        const messageElement = $("message");

        if (!messageElement) return;

        if (typeof showMessage === "function") {
            showMessage(messageElement, message, type);
            return;
        }

        messageElement.innerHTML = `
            <div class="alert alert-${escapeHTML(type)}">
                ${escapeHTML(message)}
            </div>
        `;
    }

    function showFormMessage(message, type = "error") {
        const element = $("referral-form-message");

        if (!element) return;

        element.innerHTML = `
            <div class="alert alert-${escapeHTML(type)}">
                ${escapeHTML(message)}
            </div>
        `;
    }

    function clearFormMessage() {
        $("referral-form-message").innerHTML = "";
    }

    function getApiData(response) {
        if (response && response.data !== undefined) {
            return response.data;
        }

        return response;
    }

    async function apiRequest(method, url, data = null) {
        if (!window.api || typeof window.api[method] !== "function") {
            throw new Error("Không tìm thấy hàm API: " + method);
        }

        let response;

        if (method === "get" || method === "delete") {
            response = await window.api[method](url);
        } else {
            response = await window.api[method](url, data);
        }

        return getApiData(response);
    }

    function getErrorMessage(error, fallback) {
        if (error && error.message) {
            return error.message;
        }

        return fallback;
    }

    function openModal(id) {
        const modal = $(id);

        if (modal) {
            modal.classList.add("active");
            modal.style.display = "flex";
        }
    }

    function closeModal(id) {
        const modal = $(id);

        if (modal) {
            modal.classList.remove("active");
            modal.style.display = "none";
        }
    }

    function setButtonLoading(buttonId, loading, loadingText = "Đang xử lý...") {
        const button = $(buttonId);

        if (!button) return;

        if (loading) {
            button.dataset.originalText = button.textContent;
            button.disabled = true;
            button.textContent = loadingText;
        } else {
            button.disabled = false;

            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    // =====================================================
    // 2. LẤY THÔNG TIN TÀI KHOẢN
    // =====================================================

    async function loadCurrentAccount() {
        try {
            if (typeof getCurrentAccount === "function") {
                await getCurrentAccount();
            }
        } catch (error) {
            console.warn("Không thể tải tài khoản:", error);
        }

        state.currentRole =
            typeof getCurrentRole === "function"
                ? getCurrentRole()
                : null;

        state.currentAccount =
            typeof getCurrentAccountData === "function"
                ? getCurrentAccountData()
                : null;

        if (!state.currentRole && state.currentAccount) {
            state.currentRole =
                state.currentAccount.vai_tro;
        }

        applyReferralPermissions();
    }

    // =====================================================
    // 3. PHÂN QUYỀN GIAO DIỆN
    // =====================================================

    function applyReferralPermissions() {
        const role = state.currentRole;

        const canCreate =
            role === "Doctor";

        const canUpdate =
            role === "Admin" ||
            role === "Doctor";

        const createButton = $("btn-add-referral");

        if (createButton) {
            createButton.style.display =
                canCreate ? "" : "none";
        }

        document.querySelectorAll(
            "[data-referral-permission='create']"
        ).forEach(element => {
            element.style.display =
                canCreate ? "" : "none";
        });

        state.canUpdate = canUpdate;
    }

    // =====================================================
    // 4. TẢI DANH SÁCH PHIẾU
    // =====================================================

    async function loadReferrals() {
        const table = $("referrals-table");

        table.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;">
                    Đang tải dữ liệu...
                </td>
            </tr>
        `;

        try {
            const data = await apiRequest(
                "get",
                "/referrals"
            );

            state.referrals = Array.isArray(data)
                ? data
                : [];

            updateStatistics();
            filterReferrals();

        } catch (error) {
            console.error("Load referrals error:", error);

            table.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;color:#dc2626;">
                        ${escapeHTML(
                            getErrorMessage(
                                error,
                                "Không thể tải danh sách phiếu chuyển tuyến."
                            )
                        )}
                    </td>
                </tr>
            `;

            state.referrals = [];
            updateStatistics();

            showNotification(
                "Không thể tải danh sách phiếu chuyển tuyến.",
                "error"
            );
        }
    }

    // =====================================================
    // 5. THỐNG KÊ
    // =====================================================

    function updateStatistics() {
        const referrals = state.referrals;

        $("total-referrals").textContent =
            referrals.length;

        $("pending-referrals").textContent =
            referrals.filter(item =>
                item.trang_thai === "Pending"
            ).length;

        $("accepted-referrals").textContent =
            referrals.filter(item =>
                item.trang_thai === "Accepted"
            ).length;

        $("completed-referrals").textContent =
            referrals.filter(item =>
                item.trang_thai === "Completed"
            ).length;
    }

    // =====================================================
    // 6. TÌM KIẾM VÀ LỌC
    // =====================================================

    function filterReferrals() {
        const keyword = $("search-referral")
            .value
            .trim()
            .toLowerCase();

        const status = $("filter-referral-status").value;

        state.filteredReferrals = state.referrals.filter(item => {

            const searchContent = [
                item.ma_chuyen_tuyen,
                item.ma_lich_hen,
                item.ten_benh_nhan,
                item.ten_bac_si_gp,
                item.ten_chuyen_khoa,
                item.ten_bac_si_nhan
            ].join(" ").toLowerCase();

            const matchesKeyword =
                !keyword ||
                searchContent.includes(keyword);

            const matchesStatus =
                !status ||
                item.trang_thai === status;

            return matchesKeyword && matchesStatus;
        });

        renderReferralTable();
    }

    // =====================================================
    // 7. HIỂN THỊ BẢNG
    // =====================================================

    function renderReferralTable() {
        const table = $("referrals-table");

        const referrals = state.filteredReferrals;

        if (!referrals.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="referral-empty">
                            Không tìm thấy phiếu chuyển tuyến phù hợp.
                        </div>
                    </td>
                </tr>
            `;

            $("referral-result-count").textContent =
                "0 phiếu chuyển tuyến";

            return;
        }

        table.innerHTML = referrals.map((item, index) => {

            const statusClass =
                getStatusClass(item.trang_thai);

            const statusLabel =
                formatStatus(item.trang_thai);

            let actions = `
                <button
                    type="button"
                    class="btn btn-secondary referral-action-view"
                    data-action="view"
                    data-id="${escapeHTML(item.ma_chuyen_tuyen)}"
                >
                    Chi tiết
                </button>
            `;

            const canUpdate =
                state.canUpdate &&
                (
                    state.currentRole === "Admin" ||
                    (
                        state.currentRole === "Doctor" &&
                        item.ma_bac_si_nhan ===
                        state.currentAccount?.ma_bac_si
                    )
                );

            if (
                canUpdate &&
                item.trang_thai !== "Completed"
            ) {
                actions += `
                    <button
                        type="button"
                        class="btn btn-primary referral-action-status"
                        data-action="status"
                        data-id="${escapeHTML(item.ma_chuyen_tuyen)}"
                    >
                        Xử lý
                    </button>
                `;
            }

            return `
                <tr>
                    <td>${index + 1}</td>

                    <td>
                        <strong>
                            ${escapeHTML(item.ma_chuyen_tuyen)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(
                            getValue(item.ten_benh_nhan)
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            getValue(item.ten_bac_si_gp)
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            getValue(item.ten_chuyen_khoa)
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            getValue(item.ten_bac_si_nhan)
                        )}
                    </td>

                    <td>
                        <span class="referral-status ${statusClass}">
                            ${escapeHTML(statusLabel)}
                        </span>
                    </td>

                    <td>
                        <div class="referral-action-group">
                            ${actions}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        $("referral-result-count").textContent =
            `${referrals.length} phiếu chuyển tuyến`;
    }

    // =====================================================
    // 8. TẢI DỮ LIỆU FORM
    // =====================================================

    async function loadReferralOptions() {
        const appointmentSelect =
            $("referral-appointment");

        const specialtySelect =
            $("referral-specialty");

        appointmentSelect.innerHTML =
            `<option value="">Đang tải lịch hẹn...</option>`;

        specialtySelect.innerHTML =
            `<option value="">Đang tải chuyên khoa...</option>`;

        $("referral-specialist").innerHTML =
            `<option value="">Vui lòng chọn chuyên khoa trước</option>`;

        $("referral-specialist").disabled = true;

        try {
            const data = await apiRequest(
                "get",
                "/referrals/options"
            );

            state.formOptions = data;

            renderAppointmentOptions(
                data.appointments || []
            );

            renderSpecialtyOptions(
                data.specialties || []
            );

        } catch (error) {
            console.error("Referral options error:", error);

            appointmentSelect.innerHTML =
                `<option value="">Không thể tải lịch hẹn</option>`;

            specialtySelect.innerHTML =
                `<option value="">Không thể tải chuyên khoa</option>`;

            throw error;
        }
    }

    // =====================================================
    // 9. HIỂN THỊ LỊCH HẸN
    // =====================================================

    function renderAppointmentOptions(appointments) {
        const select = $("referral-appointment");

        if (!appointments.length) {
            select.innerHTML = `
                <option value="">
                    Không có lịch hẹn đủ điều kiện chuyển tuyến
                </option>
            `;

            return;
        }

        select.innerHTML = `
            <option value="">Chọn lịch hẹn</option>

            ${appointments.map(item => `
                <option value="${escapeHTML(item.ma_lich_hen)}">
                    ${escapeHTML(item.ma_lich_hen)}
                    - ${escapeHTML(item.ten_benh_nhan)}
                    - ${escapeHTML(formatDateTime(item.thoi_gian_hen))}
                    - ${escapeHTML(item.loai_hinh_kham)}
                </option>
            `).join("")}
        `;
    }

    // =====================================================
    // 10. HIỂN THỊ CHUYÊN KHOA
    // =====================================================

    function renderSpecialtyOptions(specialties) {
        const select = $("referral-specialty");

        select.innerHTML = `
            <option value="">Chọn chuyên khoa</option>

            ${specialties.map(item => `
                <option value="${escapeHTML(item.ma_chuyen_khoa)}">
                    ${escapeHTML(item.ten_chuyen_khoa)}
                </option>
            `).join("")}
        `;
    }

    // =====================================================
    // 11. LỌC BÁC SĨ THEO CHUYÊN KHOA
    // =====================================================

    async function loadSpecialists(specialtyId) {
        const select = $("referral-specialist");

        select.disabled = true;

        select.innerHTML = `
            <option value="">Đang tải bác sĩ...</option>
        `;

        if (!specialtyId) {
            select.innerHTML = `
                <option value="">
                    Vui lòng chọn chuyên khoa trước
                </option>
            `;

            return;
        }

        try {
            const data = await apiRequest(
                "get",
                `/referrals/specialists?specialty_id=${encodeURIComponent(specialtyId)}`
            );

            state.specialists = Array.isArray(data)
                ? data
                : [];

            if (!state.specialists.length) {
                select.innerHTML = `
                    <option value="">
                        Chuyên khoa chưa có bác sĩ tiếp nhận
                    </option>
                `;

                return;
            }

            select.innerHTML = `
                <option value="">Chọn bác sĩ tiếp nhận</option>

                ${state.specialists.map(item => `
                    <option value="${escapeHTML(item.ma_bac_si)}">
                        ${escapeHTML(item.ho_va_ten)}
                        - ${escapeHTML(item.ma_bac_si)}
                    </option>
                `).join("")}
            `;

            select.disabled = false;

        } catch (error) {
            console.error("Load specialists error:", error);

            select.innerHTML = `
                <option value="">
                    Không thể tải danh sách bác sĩ
                </option>
            `;

            showFormMessage(
                getErrorMessage(
                    error,
                    "Không thể tải danh sách bác sĩ chuyên khoa."
                )
            );
        }
    }

    // =====================================================
    // 12. MỞ FORM TẠO PHIẾU
    // =====================================================

    async function openReferralForm() {
        if (state.currentRole !== "Doctor") {
            showNotification(
                "Chỉ bác sĩ mới được tạo phiếu chuyển tuyến.",
                "error"
            );

            return;
        }

        $("referral-form").reset();

        clearFormMessage();

        $("referral-specialist").disabled = true;

        openModal("referral-form-modal");

        try {
            await loadReferralOptions();

        } catch (error) {
            showFormMessage(
                getErrorMessage(
                    error,
                    "Không thể tải dữ liệu tạo phiếu."
                )
            );
        }
    }

    // =====================================================
    // 13. TẠO PHIẾU CHUYỂN TUYẾN
    // =====================================================

    async function createReferral(event) {
        event.preventDefault();

        const payload = {
            ma_lich_hen:
                $("referral-appointment").value,

            ma_chuyen_khoa:
                $("referral-specialty").value,

            ma_bac_si_nhan:
                $("referral-specialist").value,

            ly_do_chuyen:
                $("referral-reason").value.trim()
        };

        if (
            !payload.ma_lich_hen ||
            !payload.ma_chuyen_khoa ||
            !payload.ma_bac_si_nhan ||
            !payload.ly_do_chuyen
        ) {
            showFormMessage(
                "Vui lòng nhập đầy đủ thông tin bắt buộc."
            );

            return;
        }

        setButtonLoading(
            "save-referral",
            true,
            "Đang tạo phiếu..."
        );

        try {
            await apiRequest(
                "post",
                "/referrals",
                payload
            );

            closeModal("referral-form-modal");

            showNotification(
                "Tạo phiếu chuyển tuyến thành công."
            );

            await loadReferrals();

        } catch (error) {
            console.error("Create referral error:", error);

            showFormMessage(
                getErrorMessage(
                    error,
                    "Không thể tạo phiếu chuyển tuyến."
                )
            );

        } finally {
            setButtonLoading(
                "save-referral",
                false
            );
        }
    }

    // =====================================================
    // 14. XEM CHI TIẾT PHIẾU
    // =====================================================

    async function viewReferral(referralId) {
        $("referral-detail").innerHTML = `
            <div class="loading-placeholder">
                Đang tải thông tin phiếu...
            </div>
        `;

        openModal("referral-detail-modal");

        try {
            const item = await apiRequest(
                "get",
                `/referrals/${encodeURIComponent(referralId)}`
            );

            if (!item) {
                throw new Error("Không tìm thấy phiếu chuyển tuyến.");
            }

            state.selectedReferral = item;

            renderReferralDetail(item);

        } catch (error) {
            console.error("Referral detail error:", error);

            $("referral-detail").innerHTML = `
                <div class="referral-empty">
                    ${escapeHTML(
                        getErrorMessage(
                            error,
                            "Không thể tải chi tiết phiếu."
                        )
                    )}
                </div>
            `;
        }
    }

    // =====================================================
    // 15. HIỂN THỊ CHI TIẾT
    // =====================================================

    function renderReferralDetail(item) {
        $("referral-detail").innerHTML = `
            <h3 class="referral-detail-heading">
                Thông tin phiếu
            </h3>

            <div class="referral-detail-grid">

                <div class="referral-detail-item">
                    <label>Mã phiếu chuyển tuyến</label>
                    <strong>
                        ${escapeHTML(item.ma_chuyen_tuyen)}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Mã lịch hẹn</label>
                    <strong>
                        ${escapeHTML(item.ma_lich_hen)}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Trạng thái phiếu</label>
                    <strong>
                        <span class="referral-status ${getStatusClass(item.trang_thai)}">
                            ${escapeHTML(formatStatus(item.trang_thai))}
                        </span>
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Trạng thái lịch hẹn</label>
                    <strong>
                        ${escapeHTML(getValue(item.trang_thai_lich_hen))}
                    </strong>
                </div>

            </div>

            <h3 class="referral-detail-heading">
                Thông tin bệnh nhân
            </h3>

            <div class="referral-detail-grid">

                <div class="referral-detail-item">
                    <label>Mã bệnh nhân</label>
                    <strong>
                        ${escapeHTML(getValue(item.ma_benh_nhan))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Họ và tên</label>
                    <strong>
                        ${escapeHTML(getValue(item.ten_benh_nhan))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Thời gian khám</label>
                    <strong>
                        ${escapeHTML(formatDateTime(item.thoi_gian_hen))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Loại hình khám</label>
                    <strong>
                        ${escapeHTML(getValue(item.loai_hinh_kham))}
                    </strong>
                </div>

            </div>

            <h3 class="referral-detail-heading">
                Thông tin chuyển tuyến
            </h3>

            <div class="referral-detail-grid">

                <div class="referral-detail-item">
                    <label>Bác sĩ đa khoa chuyển</label>
                    <strong>
                        ${escapeHTML(getValue(item.ten_bac_si_gp))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Mã bác sĩ chuyển</label>
                    <strong>
                        ${escapeHTML(getValue(item.ma_bac_si_gp))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Chuyên khoa tiếp nhận</label>
                    <strong>
                        ${escapeHTML(getValue(item.ten_chuyen_khoa))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Mã chuyên khoa</label>
                    <strong>
                        ${escapeHTML(getValue(item.ma_chuyen_khoa))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Bác sĩ chuyên khoa nhận</label>
                    <strong>
                        ${escapeHTML(getValue(item.ten_bac_si_nhan))}
                    </strong>
                </div>

                <div class="referral-detail-item">
                    <label>Mã bác sĩ nhận</label>
                    <strong>
                        ${escapeHTML(getValue(item.ma_bac_si_nhan))}
                    </strong>
                </div>

                <div class="referral-detail-item full-width">
                    <label>Lý do chuyển tuyến</label>
                    <p>
                        ${escapeHTML(getValue(item.ly_do_chuyen))}
                    </p>
                </div>

            </div>
        `;
    }

    // =====================================================
    // 16. MỞ FORM CẬP NHẬT TRẠNG THÁI
    // =====================================================

    function openStatusForm(referralId) {
        const item = state.referrals.find(
            referral =>
                referral.ma_chuyen_tuyen === referralId
        );

        if (!item) {
            showNotification(
                "Không tìm thấy phiếu chuyển tuyến.",
                "error"
            );

            return;
        }

        const isAdmin =
            state.currentRole === "Admin";

        const isAssignedSpecialist =
            state.currentRole === "Doctor" &&
            item.ma_bac_si_nhan ===
            state.currentAccount?.ma_bac_si;

        if (!isAdmin && !isAssignedSpecialist) {
            showNotification(
                "Bạn không có quyền xử lý phiếu này.",
                "error"
            );

            return;
        }

        $("status-referral-id").value =
            item.ma_chuyen_tuyen;

        $("current-referral-status").value =
            formatStatus(item.trang_thai);

        const select = $("new-referral-status");

        if (item.trang_thai === "Pending") {
            select.innerHTML = `
                <option value="Accepted">Đã tiếp nhận</option>
            `;
        } else if (item.trang_thai === "Accepted") {
            select.innerHTML = `
                <option value="Completed">Đã hoàn thành</option>
            `;
        } else {
            select.innerHTML = `
                <option value="">Không còn trạng thái tiếp theo</option>
            `;
        }

        $("referral-status-message").innerHTML = "";

        openModal("referral-status-modal");
    }

    // =====================================================
    // 17. CẬP NHẬT TRẠNG THÁI
    // =====================================================

    async function updateReferralStatus(event) {
        event.preventDefault();

        const referralId =
            $("status-referral-id").value;

        const newStatus =
            $("new-referral-status").value;

        if (!referralId || !newStatus) {
            $("referral-status-message").innerHTML = `
                <div class="alert alert-error">
                    Vui lòng chọn trạng thái cần cập nhật.
                </div>
            `;

            return;
        }

        setButtonLoading(
            "save-referral-status",
            true,
            "Đang cập nhật..."
        );

        try {
            await apiRequest(
                "put",
                `/referrals/${encodeURIComponent(referralId)}/status`,
                {
                    trang_thai: newStatus
                }
            );

            closeModal("referral-status-modal");

            showNotification(
                "Cập nhật trạng thái phiếu thành công."
            );

            await loadReferrals();

        } catch (error) {
            console.error("Update referral status error:", error);

            $("referral-status-message").innerHTML = `
                <div class="alert alert-error">
                    ${escapeHTML(
                        getErrorMessage(
                            error,
                            "Không thể cập nhật trạng thái."
                        )
                    )}
                </div>
            `;

        } finally {
            setButtonLoading(
                "save-referral-status",
                false
            );
        }
    }

    // =====================================================
    // 18. SỰ KIỆN BẢNG
    // =====================================================

    $("referrals-table").addEventListener(
        "click",
        function (event) {
            const button = event.target.closest(
                "button[data-action]"
            );

            if (!button) return;

            const action = button.dataset.action;
            const referralId = button.dataset.id;

            if (action === "view") {
                viewReferral(referralId);
            }

            if (action === "status") {
                openStatusForm(referralId);
            }
        }
    );

    // =====================================================
    // 19. SỰ KIỆN FORM
    // =====================================================

    $("btn-add-referral").addEventListener(
        "click",
        openReferralForm
    );

    $("referral-form").addEventListener(
        "submit",
        createReferral
    );

    $("referral-specialty").addEventListener(
        "change",
        function () {
            clearFormMessage();

            loadSpecialists(this.value);
        }
    );

    $("referral-status-form").addEventListener(
        "submit",
        updateReferralStatus
    );

    // =====================================================
    // 20. TÌM KIẾM VÀ LỌC
    // =====================================================

    $("search-referral").addEventListener(
        "input",
        filterReferrals
    );

    $("filter-referral-status").addEventListener(
        "change",
        filterReferrals
    );

    $("refresh-referrals").addEventListener(
        "click",
        loadReferrals
    );

    // =====================================================
    // 21. ĐÓNG MODAL
    // =====================================================

    const modalCloseEvents = {
        "close-referral-form": "referral-form-modal",
        "cancel-referral-form": "referral-form-modal",
        "close-referral-detail": "referral-detail-modal",
        "close-referral-detail-footer": "referral-detail-modal",
        "close-referral-status": "referral-status-modal",
        "cancel-referral-status": "referral-status-modal"
    };

    Object.entries(modalCloseEvents).forEach(
        ([buttonId, modalId]) => {
            $(buttonId).addEventListener(
                "click",
                () => closeModal(modalId)
            );
        }
    );

    [
        "referral-form-modal",
        "referral-detail-modal",
        "referral-status-modal"
    ].forEach(modalId => {
        $(modalId).addEventListener(
            "click",
            function (event) {
                if (event.target === this) {
                    closeModal(modalId);
                }
            }
        );
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            [
                "referral-form-modal",
                "referral-detail-modal",
                "referral-status-modal"
            ].forEach(closeModal);
        }
    });

    // =====================================================
    // 22. KHỞI TẠO TRANG
    // =====================================================

    try {
        await loadCurrentAccount();

        await loadReferrals();

    } catch (error) {
        console.error(
            "Referral page initialization error:",
            error
        );

        showNotification(
            "Có lỗi khi khởi tạo trang chuyển tuyến.",
            "error"
        );
    }

});
