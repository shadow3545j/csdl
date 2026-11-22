
from functools import wraps

from flask import session, jsonify

from app.models.auth_model import get_account_by_id


# ==========================================
# LOGIN REQUIRED
# ==========================================

def login_required(func):
    """
    Chỉ cho phép tài khoản đã đăng nhập truy cập.

    Đồng thời kiểm tra trạng thái tài khoản trong database
    để tài khoản bị khóa không thể tiếp tục sử dụng session cũ.
    """

    @wraps(func)
    def decorated_function(*args, **kwargs):

        account_id = session.get("ma_tai_khoan")

        if not account_id:
            return jsonify({
                "success": False,
                "message": "Bạn cần đăng nhập để sử dụng chức năng này."
            }), 401

        account = get_account_by_id(account_id)

        if not account or account["trang_thai"] != "Active":
            session.clear()

            return jsonify({
                "success": False,
                "message": "Tài khoản không tồn tại hoặc đã bị khóa."
            }), 401

        # Đồng bộ thông tin mới nhất từ database
        session["ma_tai_khoan"] = account["ma_tai_khoan"]
        session["ten_dang_nhap"] = account["ten_dang_nhap"]
        session["vai_tro"] = account["vai_tro"]
        session["ma_bac_si"] = account["ma_bac_si"]
        session["ma_benh_nhan"] = account["ma_benh_nhan"]

        return func(*args, **kwargs)

    return decorated_function


# ==========================================
# ROLE REQUIRED
# ==========================================

def roles_required(*allowed_roles):
    """
    Chỉ cho phép những vai trò được chỉ định truy cập.

    Ví dụ:
        @roles_required("Admin", "Receptionist")
    """

    def decorator(func):

        @wraps(func)
        @login_required
        def decorated_function(*args, **kwargs):

            current_role = session.get("vai_tro")

            if current_role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "message": "Bạn không có quyền thực hiện chức năng này."
                }), 403

            return func(*args, **kwargs)

        return decorated_function

    return decorator


# ==========================================
# CHECK PATIENT OWNERSHIP
# ==========================================

def is_own_patient(patient_id):
    """
    Kiểm tra bệnh nhân đang đăng nhập có đang truy cập
    đúng hồ sơ của chính mình hay không.
    """

    return (
        session.get("vai_tro") == "Patient"
        and session.get("ma_benh_nhan") == patient_id
    )
