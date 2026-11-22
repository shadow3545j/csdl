
(() => {
    "use strict";

    const loginForm = document.getElementById("login-form");
    const loginMessage = document.getElementById("login-message");
    const loginButton = document.getElementById("login-submit");

    let currentAccount = null;
    let accountPromise = null;

    // ==========================================
    // 1. MA TRẬN QUYỀN THEO BACKEND
    // ==========================================

    const ROLE_PERMISSIONS = {
        Admin: [
            "dashboard.view",

            "patients.view",
            "patients.create",
            "patients.update",
            "patients.delete",

            "doctors.view",
            "doctors.create",
            "doctors.update",
            "doctors.delete",

            "specialties.view",
            "specialties.create",
            "specialties.update",
            "specialties.delete",

            "appointments.view",
            "appointments.create",
            "appointments.update_status",
            "appointments.delete",

            "medical_records.view",
            "medical_records.options",
            "medical_records.create",
            "medical_records.update",
            "medical_records.delete",
            "medical_records.attachments.create",
            "medical_records.attachments.update",
            "medical_records.attachments.delete",

            "prescriptions.view",
            "prescriptions.dispense"
        ],

        Doctor: [
            "dashboard.view",
            "patients.view",
            "doctors.view",
            "specialties.view",

            "appointments.view",
            "appointments.update_status",

            "medical_records.view",
            "medical_records.options",
            "medical_records.create",
            "medical_records.update",
            "medical_records.attachments.create",
            "medical_records.attachments.update",

            "prescriptions.view"
        ],

        Receptionist: [
            "dashboard.view",
            "patients.view",
            "patients.create",
            "patients.update",

            "doctors.view",
            "specialties.view",

            "appointments.view",
            "appointments.create",
            "appointments.delete",

            "medical_records.view"
        ],

        Pharmacist: [
            "dashboard.view",
            "prescriptions.view",
            "prescriptions.dispense"
        ],

        Patient: [
            "dashboard.view",
            "patients.own_view",
            "appointments.view",
            "appointments.create",
            "medical_records.view",
            "prescriptions.view"
        ]
    };

    // ==========================================
    // 2. THÔNG TIN VAI TRÒ
    // ==========================================

    function normalizeRole(role) {
        return String(role || "").trim().toLowerCase();
    }

    function getRoleName(role) {
        const names = {
            admin: "Quản trị viên",
            doctor: "Bác sĩ",
            receptionist: "Lễ tân",
            pharmacist: "Dược sĩ",
            patient: "Bệnh nhân"
        };

        return names[normalizeRole(role)] || "Người dùng";
    }

    function getRole() {
        return currentAccount?.vai_tro || null;
    }

    function getAccount() {
        return currentAccount;
    }

    // ==========================================
    // 3. KIỂM TRA QUYỀN
    // ==========================================

    function can(permission) {
        const role = getRole();

        if (!role || !ROLE_PERMISSIONS[role]) {
            return false;
        }

        return ROLE_PERMISSIONS[role].includes(permission);
    }

    // ==========================================
    // 4. THÔNG BÁO ĐĂNG NHẬP
    // ==========================================

    function showLoginMessage(message, type = "error") {
        if (!loginMessage) return;

        loginMessage.textContent = message;
        loginMessage.className = `auth-message ${type}`;
    }

    function hideLoginMessage() {
        if (!loginMessage) return;

        loginMessage.textContent = "";
        loginMessage.className = "auth-message hidden";
    }

    function setLoading(loading) {
        if (!loginButton) return;

        loginButton.disabled = loading;
        loginButton.textContent = loading
            ? "Đang đăng nhập..."
            : "Đăng nhập";
    }

    // ==========================================
    // 5. ĐĂNG NHẬP
    // ==========================================

    async function handleLogin(event) {
        event.preventDefault();
        hideLoginMessage();

        const username = document
            .getElementById("ten_dang_nhap")
            ?.value.trim();

        const password = document
            .getElementById("mat_khau")
            ?.value;

        if (!username || !password) {
            showLoginMessage(
                "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."
            );
            return;
        }

        try {
            setLoading(true);

            await window.api.post("/auth/login", {
                ten_dang_nhap: username,
                mat_khau: password
            });

            window.location.replace("/dashboard");

        } catch (error) {
            console.error("Login error:", error);

            showLoginMessage(
                error.message || "Đăng nhập thất bại."
            );

            setLoading(false);
        }
    }

    // ==========================================
    // 6. ĐĂNG XUẤT
    // ==========================================

    async function logout() {
        try {
            await window.api.post("/auth/logout");
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            currentAccount = null;
            accountPromise = null;
            window.location.replace("/login");
        }
    }

    // ==========================================
    // 7. LẤY TÀI KHOẢN HIỆN TẠI
    // ==========================================

    async function getCurrentAccount(forceRefresh = false) {
        if (currentAccount && !forceRefresh) {
            return currentAccount;
        }

        if (accountPromise && !forceRefresh) {
            return accountPromise;
        }

        accountPromise = (async () => {
            try {
                const account = await window.api.get("/auth/me");

                if (
                    !account ||
                    !account.vai_tro ||
                    !ROLE_PERMISSIONS[account.vai_tro]
                ) {
                    throw new Error("Thông tin vai trò không hợp lệ.");
                }

                currentAccount = account;

                updateAccountInterface();
                applyRolePermissions();

                return account;

            } catch (error) {
                console.error("Get current account error:", error);
                currentAccount = null;

                if (error.status === 401) {
                    window.location.replace("/login");
                }

                return null;

            } finally {
                accountPromise = null;
            }
        })();

        return accountPromise;
    }

    // ==========================================
    // 8. CẬP NHẬT THÔNG TIN TÀI KHOẢN
    // ==========================================

    function updateAccountInterface() {
        if (!currentAccount) return;

        const username =
            currentAccount.ten_dang_nhap || "Người dùng";

        const roleName = getRoleName(currentAccount.vai_tro);

        const avatar =
            username.charAt(0).toUpperCase() || "U";

        const updateText = (selector, value) => {
            document.querySelectorAll(selector).forEach(element => {
                if (element.textContent !== value) {
                    element.textContent = value;
                }
            });
        };

        updateText(
            "#navbar-username, .sidebar-user .user-info strong",
            username
        );

        updateText(
            "#navbar-role, .sidebar-user .user-info span",
            roleName
        );

        updateText(
            "#navbar-avatar, .sidebar-user .user-avatar",
            avatar
        );
    }

    // ==========================================
    // 9. ÁP DỤNG PHÂN QUYỀN GIAO DIỆN
    // ==========================================

    function applyRolePermissions() {
        if (!currentAccount) return;

        // Phân quyền theo danh sách vai trò
        document.querySelectorAll("[data-role-allow]").forEach(element => {
            const roles = element.dataset.roleAllow
                .split(",")
                .map(role => role.trim());

            element.hidden = !roles.includes(currentAccount.vai_tro);
        });

        // Phân quyền theo từng thao tác
        document.querySelectorAll("[data-permission]").forEach(element => {
            element.hidden = !can(element.dataset.permission);
        });

        // Ẩn nhóm Sidebar nếu không còn menu nào
        document.querySelectorAll(".sidebar-section").forEach(section => {
            const links = section.querySelectorAll(
                ".sidebar-link[data-role-allow]"
            );

            if (links.length) {
                section.hidden = !Array.from(links).some(
                    link => !link.hidden
                );
            }
        });
    }

    // ==========================================
    // 10. SỰ KIỆN ĐĂNG XUẤT
    // ==========================================

    document.addEventListener("click", event => {
        const button = event.target.closest("[data-logout]");

        if (!button) return;

        event.preventDefault();
        logout();
    });

    // ==========================================
    // 11. KHỞI TẠO
    // ==========================================

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    // Không gọi /auth/me tại đây.
    // initializeLayout() sẽ gọi sau khi tải Sidebar và Navbar.

    window.logout = logout;
    window.getCurrentAccount = getCurrentAccount;
    window.getCurrentRole = getRole;
    window.getCurrentAccountData = getAccount;
    window.can = can;
    window.applyRolePermissions = applyRolePermissions;

})();
