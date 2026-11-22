
from app.models.auth_model import authenticate_account


# ==========================================
# LOGIN SERVICE
# ==========================================

def login_account(username, password):
    """
    Xử lý đăng nhập tài khoản.

    Trả về:
    - success: True/False
    - message: Thông báo
    - account: Thông tin tài khoản nếu thành công
    """

    if not username or not password:
        return {
            "success": False,
            "message": "Vui lòng nhập tên đăng nhập và mật khẩu.",
            "account": None
        }

    username = username.strip()

    if not username:
        return {
            "success": False,
            "message": "Tên đăng nhập không hợp lệ.",
            "account": None
        }

    account = authenticate_account(username, password)

    if account is None:
        return {
            "success": False,
            "message": "Tên đăng nhập hoặc mật khẩu không chính xác, hoặc tài khoản đã bị khóa.",
            "account": None
        }

    return {
        "success": True,
        "message": "Đăng nhập thành công.",
        "account": account
    }


# ==========================================
# GET ACCOUNT PROFILE SERVICE
# ==========================================

def get_account_profile(account_id):
    """
    Lấy thông tin tài khoản hiện tại.
    """

    from app.models.auth_model import get_account_by_id

    if not account_id:
        return None

    return get_account_by_id(account_id)
