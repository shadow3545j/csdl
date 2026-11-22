document.addEventListener("DOMContentLoaded", async () => {
    await initializeLayout("medical_records", "Quản lý hồ sơ bệnh án");

    // =========================================
    // ROLE PERMISSIONS
    // =========================================

    let currentRole = "";

    try {
        let account = null;

        if (typeof window.getCurrentAccount === "function") {
            account = await window.getCurrentAccount();
        }

        if (!account && window.api?.get) {
            account = await window.api.get("/auth/me");
            account = account?.data ?? account;
        }

        currentRole = String(
            account?.vai_tro || account?.role || ""
        ).trim();
    } catch (error) {
        console.error("Get current account error:", error);
    }

    const canManageRecords = ["Admin", "Doctor"].includes(currentRole);
    const canDeleteRecords = currentRole === "Admin";
    const canManageAttachments = ["Admin", "Doctor"].includes(currentRole);
    const canDeleteAttachments = currentRole === "Admin";

    function denyPermission() {
        showPageMessage("Bạn không có quyền thực hiện chức năng này.", "error");
    }

    function applyMedicalRecordPermissions() {
        if (addButton) addButton.hidden = !canManageRecords;
        if (addAttachmentButton) addAttachmentButton.hidden = !canManageAttachments;
    }

    // =========================================
    // DOM ELEMENTS - MEDICAL RECORDS
    // =========================================

    const tableBody = document.getElementById("medical-records-table");

    const totalRecords = document.getElementById("total-records");
    const draftRecords = document.getElementById("draft-records");
    const finalizedRecords = document.getElementById("finalized-records");

    const searchInput = document.getElementById("search-medical-record");
    const statusFilter = document.getElementById("filter-record-status");
    const patientFilter = document.getElementById("filter-record-patient");
    const refreshButton = document.getElementById("refresh-medical-records");
    const resultCount = document.getElementById("medical-record-result-count");

    const addButton = document.getElementById("btn-add-medical-record");

    const formModal = document.getElementById("medical-record-form-modal");
    const medicalRecordForm = document.getElementById("medical-record-form");
    const formTitle = document.getElementById("medical-record-form-title");
    const formMessage = document.getElementById("medical-record-form-message");

    const closeFormButton = document.getElementById("close-medical-record-form");
    const cancelFormButton = document.getElementById("cancel-medical-record-form");

    const detailModal = document.getElementById("medical-record-detail-modal");
    const detailContent = document.getElementById("medical-record-detail");
    const closeDetailButton = document.getElementById("close-medical-record-detail");

    const deleteModal = document.getElementById("delete-medical-record-modal");
    const deleteRecordId = document.getElementById("delete-medical-record-id");
    const deleteRecordName = document.getElementById("delete-medical-record-name");
    const closeDeleteButton = document.getElementById("close-delete-medical-record");
    const cancelDeleteButton = document.getElementById("cancel-delete-medical-record");
    const confirmDeleteButton = document.getElementById("confirm-delete-medical-record");

    const recordIdInput = document.getElementById("ma_ho_so");
    const patientSelect = document.getElementById("ma_benh_nhan");
    const appointmentSelect = document.getElementById("ma_lich_hen");
    const diseaseCodeInput = document.getElementById("ma_benh");
    const symptomsInput = document.getElementById("trieu_chung");
    const diagnosisInput = document.getElementById("chan_doan");
    const statusSelect = document.getElementById("trang_thai");

    // =========================================
    // DOM ELEMENTS - ATTACHMENTS
    // =========================================

    const attachmentsModal = document.getElementById(
        "medical-record-attachments-modal"
    );

    const attachmentRecordLabel = document.getElementById(
        "attachment-record-label"
    );

    const attachmentParentRecordId = document.getElementById(
        "attachment-parent-record-id"
    );

    const attachmentsMessage = document.getElementById(
        "medical-record-attachments-message"
    );

    const attachmentsTable = document.getElementById(
        "medical-record-attachments-table"
    );

    const addAttachmentButton = document.getElementById(
        "btn-add-medical-record-attachment"
    );

    const closeAttachmentsButton = document.getElementById(
        "close-medical-record-attachments"
    );

    const closeAttachmentsFooterButton = document.getElementById(
        "close-medical-record-attachments-footer"
    );

    const attachmentFormModal = document.getElementById(
        "medical-record-attachment-form-modal"
    );

    const attachmentForm = document.getElementById(
        "medical-record-attachment-form"
    );

    const attachmentFormTitle = document.getElementById(
        "medical-record-attachment-form-title"
    );

    const attachmentFormMessage = document.getElementById(
        "medical-record-attachment-form-message"
    );

    const attachmentFormRecordId = document.getElementById(
        "attachment-form-record-id"
    );

    const attachmentIdInput = document.getElementById("ma_phu_luc");
    const attachmentReasonInput = document.getElementById("ly_do_dinh_chinh");
    const attachmentContentInput = document.getElementById("noi_dung");

    const closeAttachmentFormButton = document.getElementById(
        "close-medical-record-attachment-form"
    );

    const cancelAttachmentFormButton = document.getElementById(
        "cancel-medical-record-attachment-form"
    );

    const saveAttachmentButton = document.getElementById(
        "save-medical-record-attachment"
    );

    const deleteAttachmentModal = document.getElementById(
        "delete-medical-record-attachment-modal"
    );

    const deleteAttachmentId = document.getElementById(
        "delete-medical-record-attachment-id"
    );

    const deleteAttachmentName = document.getElementById(
        "delete-medical-record-attachment-name"
    );

    const closeDeleteAttachmentButton = document.getElementById(
        "close-delete-medical-record-attachment"
    );

    const cancelDeleteAttachmentButton = document.getElementById(
        "cancel-delete-medical-record-attachment"
    );

    const confirmDeleteAttachmentButton = document.getElementById(
        "confirm-delete-medical-record-attachment"
    );

    // =========================================
    // DATA
    // =========================================

    let medicalRecords = [];
    let patients = [];
    let appointments = [];

    let editingRecordId = null;

    let medicalRecordAttachments = [];
    let currentAttachmentRecordId = null;
    let editingAttachmentId = null;

    // =========================================
    // HELPER FUNCTIONS
    // =========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function getErrorMessage(error) {
        return error?.message ||
            error?.response?.message ||
            "Đã xảy ra lỗi. Vui lòng thử lại.";
    }

    function normalizeResponse(response) {
        return response?.data ?? response;
    }

    function getPatientName(record) {
        return record.ho_va_ten ||
            record.ten_benh_nhan ||
            record.ma_benh_nhan ||
            "Chưa có thông tin";
    }

    function getStatusText(status) {
        return status === "Finalized" ? "Đã hoàn tất" : "Bản nháp";
    }

    function getStatusHTML(status) {
        const className = status === "Finalized"
            ? "finalized"
            : "draft";

        return `
            <span class="record-status ${className}">
                ${getStatusText(status)}
            </span>
        `;
    }

    function showModal(modal) {
        modal?.classList.add("show");
    }

    function hideModal(modal) {
        modal?.classList.remove("show");
    }

    function showPageMessage(message, type = "success") {
        if (typeof window.showMessage === "function") {
            window.showMessage(message, type);
            return;
        }

        const messageBox = document.getElementById("message");

        if (!messageBox) {
            alert(message);
            return;
        }

        messageBox.textContent = message;
        messageBox.className = `message ${type}`;
        messageBox.classList.remove("hidden");

        setTimeout(() => {
            messageBox.classList.add("hidden");
        }, 4000);
    }

    function showFormMessage(message) {
        if (!formMessage) return;

        formMessage.textContent = message;
        formMessage.className = "message error";
        formMessage.classList.remove("hidden");
    }

    function clearFormMessage() {
        if (!formMessage) return;

        formMessage.textContent = "";
        formMessage.classList.add("hidden");
    }

    function showAttachmentMessage(message, type = "error") {
        if (!attachmentsMessage) return;

        attachmentsMessage.textContent = message;
        attachmentsMessage.className = `message ${type}`;
        attachmentsMessage.classList.remove("hidden");
    }

    function clearAttachmentMessage() {
        if (!attachmentsMessage) return;

        attachmentsMessage.textContent = "";
        attachmentsMessage.classList.add("hidden");
    }

    function showAttachmentFormMessage(message) {
        if (!attachmentFormMessage) return;

        attachmentFormMessage.textContent = message;
        attachmentFormMessage.className = "message error";
        attachmentFormMessage.classList.remove("hidden");
    }

    function clearAttachmentFormMessage() {
        if (!attachmentFormMessage) return;

        attachmentFormMessage.textContent = "";
        attachmentFormMessage.classList.add("hidden");
    }

    // =========================================
    // LOAD MEDICAL RECORDS
    // =========================================

    async function loadMedicalRecords() {
        try {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="medical-record-loading">
                        Đang tải dữ liệu...
                    </td>
                </tr>
            `;

            const response = await window.api.get("/medical-records");
            const data = normalizeResponse(response);

            medicalRecords = Array.isArray(data) ? data : [];

            updateStatistics();
            populatePatientFilter();
            renderMedicalRecords();

        } catch (error) {
            console.error("Load medical records error:", error);

            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="medical-record-empty">
                        Không thể tải danh sách hồ sơ bệnh án.
                    </td>
                </tr>
            `;

            showPageMessage(getErrorMessage(error), "error");
        }
    }

    // =========================================
    // LOAD FORM OPTIONS
    // =========================================

    async function loadFormOptions() {
        const response = await window.api.get("/medical-records/options");
        const data = normalizeResponse(response);

        patients = data?.patients || [];
        appointments = data?.appointments || [];

        populatePatientSelect();
        populateAppointmentSelect();
    }

    // =========================================
    // STATISTICS
    // =========================================

    function updateStatistics() {
        const total = medicalRecords.length;

        const drafts = medicalRecords.filter(
            item => item.trang_thai === "Draft"
        ).length;

        const finalized = medicalRecords.filter(
            item => item.trang_thai === "Finalized"
        ).length;

        totalRecords.textContent = total;
        draftRecords.textContent = drafts;
        finalizedRecords.textContent = finalized;
    }

    // =========================================
    // FILTER PATIENT
    // =========================================

    function populatePatientFilter() {
        const currentValue = patientFilter.value;
        const uniquePatients = new Map();

        medicalRecords.forEach(record => {
            if (record.ma_benh_nhan) {
                uniquePatients.set(
                    record.ma_benh_nhan,
                    getPatientName(record)
                );
            }
        });

        patientFilter.innerHTML = `
            <option value="">Tất cả bệnh nhân</option>

            ${Array.from(uniquePatients.entries()).map(([id, name]) => `
                <option value="${escapeHTML(id)}">
                    ${escapeHTML(name)} (${escapeHTML(id)})
                </option>
            `).join("")}
        `;

        patientFilter.value = currentValue;
    }

    // =========================================
    // FILTER DATA
    // =========================================

    function getFilteredRecords() {
        const keyword = searchInput.value.trim().toLowerCase();
        const selectedStatus = statusFilter.value;
        const selectedPatient = patientFilter.value;

        return medicalRecords.filter(record => {
            const searchableValues = [
                record.ma_ho_so,
                record.ma_benh_nhan,
                getPatientName(record),
                record.ma_benh,
                record.chan_doan,
                record.trieu_chung
            ];

            const matchesKeyword = searchableValues.some(value =>
                String(value || "").toLowerCase().includes(keyword)
            );

            const matchesStatus = !selectedStatus ||
                record.trang_thai === selectedStatus;

            const matchesPatient = !selectedPatient ||
                record.ma_benh_nhan === selectedPatient;

            return matchesKeyword && matchesStatus && matchesPatient;
        });
    }

    // =========================================
    // RENDER MEDICAL RECORD TABLE
    // =========================================

    function renderMedicalRecords() {
        const filteredRecords = getFilteredRecords();

        resultCount.textContent =
            `Hiển thị ${filteredRecords.length} / ${medicalRecords.length} hồ sơ`;

        if (filteredRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="medical-record-empty">
                        Không tìm thấy hồ sơ bệnh án phù hợp.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredRecords.map((record, index) => `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <span class="medical-record-id">
                        ${escapeHTML(record.ma_ho_so)}
                    </span>
                </td>

                <td>
                    <div class="medical-record-patient">
                        ${escapeHTML(getPatientName(record))}
                    </div>
                    <small>${escapeHTML(record.ma_benh_nhan)}</small>
                </td>

                <td>${escapeHTML(record.ma_lich_hen || "—")}</td>

                <td>${escapeHTML(record.ma_benh || "—")}</td>

                <td>
                    <div class="medical-record-diagnosis"
                                               title="${escapeHTML(record.chan_doan || "")}">
                        ${escapeHTML(record.chan_doan || "Chưa có chẩn đoán")}
                    </div>
                </td>

                <td>${getStatusHTML(record.trang_thai)}</td>

                <td>
                    <div class="medical-record-actions">

                        <button type="button"
                                class="btn btn-info"
                                data-action="detail"
                                data-id="${escapeHTML(record.ma_ho_so)}">
                            Xem
                        </button>

                        <button type="button"
                                class="btn btn-primary"
                                data-action="attachments"
                                data-id="${escapeHTML(record.ma_ho_so)}">
                            Phụ lục
                        </button>

                        ${canManageRecords && record.trang_thai === "Draft" ? `
                            <button type="button"
                                    class="btn btn-warning"
                                    data-action="edit"
                                    data-id="${escapeHTML(record.ma_ho_so)}">
                                Sửa
                            </button>
                        ` : ""}

                        ${canDeleteRecords ? `
                            <button type="button"
                                    class="btn btn-danger"
                                    data-action="delete"
                                    data-id="${escapeHTML(record.ma_ho_so)}">
                                Xóa
                            </button>
                        ` : ""}

                    </div>
                </td>
            </tr>
        `).join("");
    }

    // =========================================
    // POPULATE FORM OPTIONS
    // =========================================

    function populatePatientSelect() {
        patientSelect.innerHTML = `
            <option value="">-- Chọn bệnh nhân --</option>

            ${patients.map(patient => `
                <option value="${escapeHTML(patient.ma_benh_nhan)}">
                    ${escapeHTML(patient.ho_va_ten)}
                    (${escapeHTML(patient.ma_benh_nhan)})
                </option>
            `).join("")}
        `;
    }

    function populateAppointmentSelect(patientId = "") {
        const filteredAppointments = patientId
            ? appointments.filter(item => item.ma_benh_nhan === patientId)
            : appointments;

        appointmentSelect.innerHTML = `
            <option value="">-- Chọn lịch hẹn --</option>

            ${filteredAppointments.map(item => {
                const label = [
                    item.ma_lich_hen,
                    item.ho_va_ten,
                    item.ten_bac_si,
                    item.thoi_gian_hen
                ].filter(Boolean).join(" - ");

                return `
                    <option value="${escapeHTML(item.ma_lich_hen)}">
                        ${escapeHTML(label)}
                    </option>
                `;
            }).join("")}
        `;
    }

    function ensureStatusOptions() {
        const hasFinalized = Array.from(statusSelect.options)
            .some(option => option.value === "Finalized");

        if (!hasFinalized) {
            statusSelect.add(
                new Option("Đã hoàn tất", "Finalized")
            );
        }
    }

    // =========================================
    // OPEN CREATE FORM
    // =========================================

    async function openCreateForm() {
        if (!canManageRecords) {
            denyPermission();
            return;
        }

        editingRecordId = null;

        medicalRecordForm.reset();
        clearFormMessage();

        formTitle.textContent = "Tạo hồ sơ bệnh án";

        recordIdInput.disabled = false;
        patientSelect.disabled = false;
        appointmentSelect.disabled = false;

        ensureStatusOptions();
        statusSelect.value = "Draft";

        try {
            await loadFormOptions();
            showModal(formModal);

        } catch (error) {
            showPageMessage(getErrorMessage(error), "error");
        }
    }

    // =========================================
    // OPEN EDIT FORM
    // =========================================

    async function openEditForm(recordId) {
        if (!canManageRecords) {
            denyPermission();
            return;
        }

        const selectedRecord = medicalRecords.find(
            item => item.ma_ho_so === recordId
        );

        if (!selectedRecord || selectedRecord.trang_thai !== "Draft") {
            showPageMessage(
                "Chỉ được chỉnh sửa hồ sơ bệnh án ở trạng thái bản nháp.",
                "warning"
            );
            return;
        }

        try {
            const response = await window.api.get(
                `/medical-records/${encodeURIComponent(recordId)}`
            );

            const record = normalizeResponse(response);

            if (!record) {
                throw new Error("Không tìm thấy hồ sơ bệnh án.");
            }

            editingRecordId = recordId;

            medicalRecordForm.reset();
            clearFormMessage();

            formTitle.textContent = "Chỉnh sửa hồ sơ bệnh án";

            await loadFormOptions();

            recordIdInput.value = record.ma_ho_so;
            recordIdInput.disabled = true;

            patientSelect.value = record.ma_benh_nhan || "";
            patientSelect.disabled = true;

            populateAppointmentSelect(record.ma_benh_nhan);

            if (record.ma_lich_hen &&
                !Array.from(appointmentSelect.options).some(
                    option => option.value === record.ma_lich_hen
                )) {
                appointmentSelect.add(
                    new Option(record.ma_lich_hen, record.ma_lich_hen)
                );
            }

            appointmentSelect.value = record.ma_lich_hen || "";
            appointmentSelect.disabled = true;

            diseaseCodeInput.value = record.ma_benh || "";
            symptomsInput.value = record.trieu_chung || "";
            diagnosisInput.value = record.chan_doan || "";

            ensureStatusOptions();
            statusSelect.value = record.trang_thai || "Draft";

            showModal(formModal);

        } catch (error) {
            console.error("Edit error:", error);
            showPageMessage(getErrorMessage(error), "error");
        }
    }

    // =========================================
    // SAVE MEDICAL RECORD
    // =========================================

    async function saveMedicalRecord(event) {
        event.preventDefault();

        if (!canManageRecords) {
            denyPermission();
            return;
        }

        clearFormMessage();

        const recordId = recordIdInput.value.trim();
        const patientId = patientSelect.value;
        const appointmentId = appointmentSelect.value;

        const diseaseCode = diseaseCodeInput.value.trim();
        const symptoms = symptomsInput.value.trim();
        const diagnosis = diagnosisInput.value.trim();
        const status = statusSelect.value || "Draft";

        if (!editingRecordId && !recordId) {
            showFormMessage("Vui lòng nhập mã hồ sơ.");
            return;
        }

        if (!editingRecordId && !patientId) {
            showFormMessage("Vui lòng chọn bệnh nhân.");
            return;
        }

        if (!editingRecordId && !appointmentId) {
            showFormMessage("Vui lòng chọn lịch hẹn.");
            return;
        }

        if (status === "Finalized") {
            if (!diseaseCode || !symptoms || !diagnosis) {
                showFormMessage(
                    "Hồ sơ hoàn tất cần có mã bệnh, triệu chứng và chẩn đoán."
                );
                return;
            }
        }

        const data = {
            ma_benh: diseaseCode,
            trieu_chung: symptoms,
            chan_doan: diagnosis,
            trang_thai: status
        };

        const saveButton = document.getElementById("save-medical-record");
        saveButton.disabled = true;

        try {
            if (editingRecordId) {
                await window.api.put(
                    `/medical-records/${encodeURIComponent(editingRecordId)}`,
                    data
                );

                showPageMessage("Cập nhật hồ sơ bệnh án thành công.");

            } else {
                data.ma_ho_so = recordId;
                data.ma_benh_nhan = patientId;
                data.ma_lich_hen = appointmentId;

                await window.api.post("/medical-records", data);

                showPageMessage("Tạo hồ sơ bệnh án thành công.");
            }

            hideModal(formModal);
            await loadMedicalRecords();

        } catch (error) {
            console.error("Save error:", error);
            showFormMessage(getErrorMessage(error));

        } finally {
            saveButton.disabled = false;
        }
    }

    // =========================================
    // VIEW MEDICAL RECORD DETAIL
    // =========================================

    async function openDetail(recordId) {
        showModal(detailModal);

        detailContent.innerHTML = `
            <div class="medical-record-loading">
                Đang tải thông tin hồ sơ...
            </div>
        `;

        try {
            const response = await window.api.get(
                `/medical-records/${encodeURIComponent(recordId)}`
            );

            const record = normalizeResponse(response);

            if (!record) {
                throw new Error("Không tìm thấy hồ sơ.");
            }

            let attachments = [];

            try {
                const attachmentResponse = await window.api.get(
                    `/medical-records/${encodeURIComponent(recordId)}/attachments`
                );

                const attachmentData = normalizeResponse(attachmentResponse);

                attachments = Array.isArray(attachmentData)
                    ? attachmentData
                    : [];

            } catch (attachmentError) {
                console.error("Load detail attachments error:", attachmentError);

                attachments = record.phu_luc ||
                    record.phu_luc_dinh_chinh ||
                    record.attachments ||
                    [];
            }

            detailContent.innerHTML = `
                <div class="medical-record-detail-grid">

                    <div class="medical-record-detail-item">
                        <span class="detail-label">Mã hồ sơ</span>
                        <div class="detail-value">
                            ${escapeHTML(record.ma_ho_so)}
                        </div>
                    </div>

                    <div class="medical-record-detail-item">
                        <span class="detail-label">Trạng thái</span>
                        <div class="detail-value">
                            ${getStatusHTML(record.trang_thai)}
                        </div>
                    </div>

                    <div class="medical-record-detail-item">
                        <span class="detail-label">Bệnh nhân</span>
                        <div class="detail-value">
                            ${escapeHTML(getPatientName(record))}
                        </div>
                    </div>

                    <div class="medical-record-detail-item">
                        <span class="detail-label">Mã bệnh nhân</span>
                        <div class="detail-value">
                            ${escapeHTML(record.ma_benh_nhan)}
                        </div>
                    </div>

                    <div class="medical-record-detail-item">
                        <span class="detail-label">Mã lịch hẹn</span>
                        <div class="detail-value">
                            ${escapeHTML(record.ma_lich_hen || "—")}
                        </div>
                    </div>

                    <div class="medical-record-detail-item">
                        <span class="detail-label">Mã bệnh</span>
                        <div class="detail-value">
                            ${escapeHTML(record.ma_benh || "—")}
                        </div>
                    </div>

                    <div class="medical-record-detail-item full-width">
                        <span class="detail-label">Triệu chứng</span>
                        <div class="detail-value">
                            ${escapeHTML(record.trieu_chung || "Chưa có thông tin")}
                        </div>
                    </div>

                    <div class="medical-record-detail-item full-width">
                        <span class="detail-label">Chẩn đoán</span>
                        <div class="detail-value">
                            ${escapeHTML(record.chan_doan || "Chưa có thông tin")}
                        </div>
                    </div>

                </div>

                <div class="medical-record-attachments">
                    <h4>Phụ lục đính chính (${attachments.length})</h4>

                    ${attachments.length > 0
                        ? attachments.map(item => `
                            <div class="medical-record-attachment-item">
                                <strong>
                                    ${escapeHTML(item.ma_phu_luc || "")}
                                    -
                                    ${escapeHTML(item.ly_do_dinh_chinh || "Phụ lục")}
                                </strong>
                                <p>${escapeHTML(item.noi_dung || "")}</p>
                            </div>
                        `).join("")
                        : `
                            <p class="medical-record-empty">
                                Chưa có phụ lục đính chính.
                            </p>
                        `
                    }
                </div>
            `;

        } catch (error) {
            console.error("Detail error:", error);

            detailContent.innerHTML = `
                <div class="medical-record-empty">
                    ${escapeHTML(getErrorMessage(error))}
                </div>
            `;
        }
    }

    // =========================================
    // DELETE MEDICAL RECORD
    // =========================================

    function openDeleteModal(recordId) {
        if (!canDeleteRecords) {
            denyPermission();
            return;
        }

        const record = medicalRecords.find(
            item => item.ma_ho_so === recordId
        );

        if (!record) return;

        deleteRecordId.value = recordId;

        deleteRecordName.textContent =
            `${record.ma_ho_so} - ${getPatientName(record)}`;

        showModal(deleteModal);
    }

    async function deleteMedicalRecord() {
        if (!canDeleteRecords) {
            denyPermission();
            return;
        }

        const recordId = deleteRecordId.value;

        if (!recordId) return;

        confirmDeleteButton.disabled = true;

        try {
            await window.api.delete(
                `/medical-records/${encodeURIComponent(recordId)}`
            );

            hideModal(deleteModal);

            showPageMessage("Xóa hồ sơ bệnh án thành công.");

            await loadMedicalRecords();

        } catch (error) {
            console.error("Delete error:", error);
            showPageMessage(getErrorMessage(error), "error");

        } finally {
            confirmDeleteButton.disabled = false;
        }
    }

    // =========================================
    // LOAD ATTACHMENTS
    // =========================================
        async function loadMedicalRecordAttachments(recordId) {
        attachmentsTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;">
                    Đang tải phụ lục...
                </td>
            </tr>
        `;

        clearAttachmentMessage();

        try {
            const response = await window.api.get(
                `/medical-records/${encodeURIComponent(recordId)}/attachments`
            );

            const data = normalizeResponse(response);

            medicalRecordAttachments = Array.isArray(data)
                ? data
                : [];

            renderMedicalRecordAttachments();

        } catch (error) {
            console.error("Load attachments error:", error);

            medicalRecordAttachments = [];

            attachmentsTable.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">
                        Không thể tải danh sách phụ lục.
                    </td>
                </tr>
            `;

            showAttachmentMessage(getErrorMessage(error));
        }
    }

    // =========================================
    // RENDER ATTACHMENTS TABLE
    // =========================================

    function renderMedicalRecordAttachments() {
        if (medicalRecordAttachments.length === 0) {
            attachmentsTable.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">
                        Hồ sơ này chưa có phụ lục đính chính.
                    </td>
                </tr>
            `;
            return;
        }

        attachmentsTable.innerHTML = medicalRecordAttachments.map(
            (attachment, index) => `
                <tr>
                    <td>${index + 1}</td>

                    <td>
                        <strong>
                            ${escapeHTML(attachment.ma_phu_luc)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(attachment.ly_do_dinh_chinh)}
                    </td>

                    <td>
                        ${escapeHTML(attachment.noi_dung)}
                    </td>

                    <td>
                        <div class="medical-record-actions">

                            ${canManageAttachments ? `
                                <button
                                    type="button"
                                    class="btn btn-warning"
                                    data-attachment-action="edit"
                                    data-id="${escapeHTML(attachment.ma_phu_luc)}">
                                    Sửa
                                </button>
                            ` : ""}

                            ${canDeleteAttachments ? `
                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    data-attachment-action="delete"
                                    data-id="${escapeHTML(attachment.ma_phu_luc)}">
                                    Xóa
                                </button>
                            ` : ""}

                        </div>
                    </td>
                </tr>
            `
        ).join("");
    }

    // =========================================
    // OPEN ATTACHMENTS MODAL
    // =========================================

    async function openAttachmentsModal(recordId) {
        const record = medicalRecords.find(
            item => item.ma_ho_so === recordId
        );

        currentAttachmentRecordId = recordId;

        attachmentParentRecordId.value = recordId;
        attachmentRecordLabel.textContent = record
            ? `Hồ sơ: ${record.ma_ho_so} - ${getPatientName(record)}`
            : `Hồ sơ: ${recordId}`;

        showModal(attachmentsModal);

        await loadMedicalRecordAttachments(recordId);
    }

    // =========================================
    // OPEN CREATE ATTACHMENT FORM
    // =========================================

    function openCreateAttachmentForm() {
        if (!canManageAttachments) {
            denyPermission();
            return;
        }

        if (!currentAttachmentRecordId) {
            showAttachmentMessage("Không xác định được hồ sơ bệnh án.");
            return;
        }

        editingAttachmentId = null;

        attachmentForm.reset();
        clearAttachmentFormMessage();

        attachmentFormTitle.textContent = "Thêm phụ lục đính chính";

        attachmentFormRecordId.value = currentAttachmentRecordId;

        attachmentIdInput.disabled = false;
        attachmentIdInput.value = "";

        showModal(attachmentFormModal);
    }

    // =========================================
    // OPEN EDIT ATTACHMENT FORM
    // =========================================

    function openEditAttachmentForm(attachmentId) {
        if (!canManageAttachments) {
            denyPermission();
            return;
        }

        const attachment = medicalRecordAttachments.find(
            item => item.ma_phu_luc === attachmentId
        );

        if (!attachment) {
            showAttachmentMessage("Không tìm thấy phụ lục.");
            return;
        }

        editingAttachmentId = attachmentId;

        attachmentForm.reset();
        clearAttachmentFormMessage();

        attachmentFormTitle.textContent = "Chỉnh sửa phụ lục";

        attachmentFormRecordId.value = currentAttachmentRecordId;

        attachmentIdInput.value = attachment.ma_phu_luc;
        attachmentIdInput.disabled = true;

        attachmentReasonInput.value = attachment.ly_do_dinh_chinh || "";
        attachmentContentInput.value = attachment.noi_dung || "";

        showModal(attachmentFormModal);
    }

    // =========================================
    // SAVE ATTACHMENT
    // =========================================

    async function saveMedicalRecordAttachment(event) {
        event.preventDefault();

        if (!canManageAttachments) {
            denyPermission();
            return;
        }

        clearAttachmentFormMessage();

        const attachmentId = attachmentIdInput.value.trim();
        const recordId = attachmentFormRecordId.value;

        const reason = attachmentReasonInput.value.trim();
        const content = attachmentContentInput.value.trim();

        if (!editingAttachmentId && !attachmentId) {
            showAttachmentFormMessage("Vui lòng nhập mã phụ lục.");
            return;
        }

        if (!recordId) {
            showAttachmentFormMessage("Không xác định được mã hồ sơ bệnh án.");
            return;
        }

        if (!reason) {
            showAttachmentFormMessage("Vui lòng nhập lý do đính chính.");
            return;
        }

        if (!content) {
            showAttachmentFormMessage("Vui lòng nhập nội dung đính chính.");
            return;
        }

        const data = {
            ly_do_dinh_chinh: reason,
            noi_dung: content
        };

        saveAttachmentButton.disabled = true;

        try {
            if (editingAttachmentId) {
                await window.api.put(
                    `/medical-record-attachments/${encodeURIComponent(editingAttachmentId)}`,
                    data
                );

                showPageMessage("Cập nhật phụ lục thành công.");

            } else {
                data.ma_phu_luc = attachmentId;
                data.ma_ho_so = recordId;

                await window.api.post(
                    "/medical-record-attachments",
                    data
                );

                showPageMessage("Thêm phụ lục thành công.");
            }

            hideModal(attachmentFormModal);

            await loadMedicalRecordAttachments(recordId);

        } catch (error) {
            console.error("Save attachment error:", error);

            showAttachmentFormMessage(getErrorMessage(error));

        } finally {
            saveAttachmentButton.disabled = false;
        }
    }

    // =========================================
    // OPEN DELETE ATTACHMENT MODAL
    // =========================================

    function openDeleteAttachmentModal(attachmentId) {
        if (!canDeleteAttachments) {
            denyPermission();
            return;
        }

        const attachment = medicalRecordAttachments.find(
            item => item.ma_phu_luc === attachmentId
        );

        if (!attachment) {
            showAttachmentMessage("Không tìm thấy phụ lục.");
            return;
        }

        deleteAttachmentId.value = attachmentId;

        deleteAttachmentName.textContent = attachmentId;

        showModal(deleteAttachmentModal);
    }

    // =========================================
    // DELETE ATTACHMENT
    // =========================================

    async function deleteMedicalRecordAttachment() {
        if (!canDeleteAttachments) {
            denyPermission();
            return;
        }

        const attachmentId = deleteAttachmentId.value;

        if (!attachmentId) return;

        confirmDeleteAttachmentButton.disabled = true;

        try {
            await window.api.delete(
                `/medical-record-attachments/${encodeURIComponent(attachmentId)}`
            );

            hideModal(deleteAttachmentModal);

            showPageMessage("Xóa phụ lục thành công.");

            await loadMedicalRecordAttachments(currentAttachmentRecordId);

        } catch (error) {
            console.error("Delete attachment error:", error);

            showAttachmentMessage(getErrorMessage(error));

        } finally {
            confirmDeleteAttachmentButton.disabled = false;
        }
    }

    // =========================================
    // ATTACHMENT TABLE EVENTS
    // =========================================

    attachmentsTable.addEventListener("click", event => {
        const button = event.target.closest(
            "button[data-attachment-action]"
        );

        if (!button) return;

        const action = button.dataset.attachmentAction;
        const attachmentId = button.dataset.id;

        if (action === "edit") {
            openEditAttachmentForm(attachmentId);
        }

        if (action === "delete") {
            openDeleteAttachmentModal(attachmentId);
        }
    });

    // =========================================
    // MAIN TABLE EVENTS
    // =========================================

    tableBody.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const recordId = button.dataset.id;

        if (action === "detail") {
            openDetail(recordId);
        }

        if (action === "attachments") {
            openAttachmentsModal(recordId);
        }

        if (action === "edit") {
            openEditForm(recordId);
        }

        if (action === "delete") {
            openDeleteModal(recordId);
        }
    });

    // =========================================
    // MEDICAL RECORD EVENTS
    // =========================================

    addButton.addEventListener("click", openCreateForm);

    medicalRecordForm.addEventListener("submit", saveMedicalRecord);

    closeFormButton.addEventListener("click", () => {
        hideModal(formModal);
    });

    cancelFormButton.addEventListener("click", () => {
        hideModal(formModal);
    });

    closeDetailButton.addEventListener("click", () => {
        hideModal(detailModal);
    });

    closeDeleteButton.addEventListener("click", () => {
        hideModal(deleteModal);
    });

    cancelDeleteButton.addEventListener("click", () => {
        hideModal(deleteModal);
    });

    confirmDeleteButton.addEventListener("click", deleteMedicalRecord);

    refreshButton.addEventListener("click", loadMedicalRecords);

    searchInput.addEventListener("input", renderMedicalRecords);
    statusFilter.addEventListener("change", renderMedicalRecords);
    patientFilter.addEventListener("change", renderMedicalRecords);

    patientSelect.addEventListener("change", () => {
        populateAppointmentSelect(patientSelect.value);
    });

    // =========================================
    // ATTACHMENT EVENTS
    // =========================================

    addAttachmentButton.addEventListener(
        "click",
        openCreateAttachmentForm
    );

    attachmentForm.addEventListener(
        "submit",
        saveMedicalRecordAttachment
    );

    closeAttachmentsButton.addEventListener("click", () => {
        hideModal(attachmentsModal);
    });

    closeAttachmentsFooterButton.addEventListener("click", () => {
        hideModal(attachmentsModal);
    });

    closeAttachmentFormButton.addEventListener("click", () => {
        hideModal(attachmentFormModal);
    });

    cancelAttachmentFormButton.addEventListener("click", () => {
        hideModal(attachmentFormModal);
    });

    closeDeleteAttachmentButton.addEventListener("click", () => {
        hideModal(deleteAttachmentModal);
    });

    cancelDeleteAttachmentButton.addEventListener("click", () => {
        hideModal(deleteAttachmentModal);
    });

    confirmDeleteAttachmentButton.addEventListener(
        "click",
        deleteMedicalRecordAttachment
    );

    // =========================================
    // MODAL BACKDROP EVENTS
    // =========================================

    [
        formModal,
        detailModal,
        deleteModal,
        attachmentsModal,
        attachmentFormModal,
        deleteAttachmentModal
    ].forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                hideModal(modal);
            }
        });
    });

    // =========================================
    // INITIALIZE
    // =========================================

    applyMedicalRecordPermissions();
    loadMedicalRecords();
});