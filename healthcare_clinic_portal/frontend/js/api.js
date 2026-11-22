
(() => {

    const API_BASE_URL = "/api";

    // ======================================
    // 1. CHUẨN HÓA ĐƯỜNG DẪN
    // ======================================

    function buildUrl(endpoint) {

        let path = String(endpoint || "");

        if (path.startsWith("/api/")) {
            path = path.substring(4);
        } else if (path === "/api") {
            path = "";
        }

        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        return API_BASE_URL + path;
    }

    // ======================================
    // 2. GỌI API
    // ======================================

    async function apiRequest(endpoint, options = {}) {

        const url = buildUrl(endpoint);

        const config = {
            method: options.method || "GET",
            headers: {
                "Accept": "application/json",
                ...(options.headers || {})
            }
        };

        if (options.body !== undefined) {
            config.headers["Content-Type"] = "application/json";
            config.body = JSON.stringify(options.body);
        }

        let response;

        try {
            response = await fetch(url, config);
        } catch (error) {
            throw new Error(
                "Không thể kết nối Flask. Hãy kiểm tra máy chủ."
            );
        }

        let result;

        try {
            result = await response.json();
        } catch (error) {
            throw new Error(
                "Máy chủ trả về dữ liệu không hợp lệ."
            );
        }

        if (!response.ok || result.success === false) {

            const error = new Error(
                result.message || `Lỗi HTTP ${response.status}`
            );

            error.status = response.status;
            error.data = result.data ?? null;

            throw error;
        }

        return result.data;
    }

    // ======================================
    // 3. CÁC PHƯƠNG THỨC HTTP
    // ======================================

    const api = {

        get(endpoint) {
            return apiRequest(endpoint);
        },

        post(endpoint, data = {}) {
            return apiRequest(endpoint, {
                method: "POST",
                body: data
            });
        },

        put(endpoint, data = {}) {
            return apiRequest(endpoint, {
                method: "PUT",
                body: data
            });
        },

        patch(endpoint, data = {}) {
            return apiRequest(endpoint, {
                method: "PATCH",
                body: data
            });
        },

        delete(endpoint) {
            return apiRequest(endpoint, {
                method: "DELETE"
            });
        }
    };

    // ======================================
    // 4. EXPORT
    // ======================================

    window.api = api;
    window.API = api;

})();
