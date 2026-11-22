
from werkzeug.security import check_password_hash, generate_password_hash

from app.database.connection import get_db_connection


# ==========================================
# PASSWORD UTILITIES
# ==========================================

def hash_password(password):
    """
    Mã hóa mật khẩu trước khi lưu vào database.
    Tuyệt đối không lưu mật khẩu dạng văn bản thuần.
    """
    if not password:
        raise ValueError("Mật khẩu không được để trống.")

    return generate_password_hash(password)


def verify_password(password, password_hash):
    """
    Kiểm tra mật khẩu nhập vào với mật khẩu đã mã hóa.
    """
    if not password or not password_hash:
        return False

    try:
        return check_password_hash(password_hash, password)
    except (ValueError, TypeError):
        return False


# ==========================================
# GET ACCOUNT BY USERNAME
# ==========================================

def get_account_by_username(username):
    """
    Tìm tài khoản theo tên đăng nhập.

    Hàm nội bộ phục vụ xác thực.
    Có trả về mat_khau_hash nên không được
    sử dụng trực tiếp làm dữ liệu API response.
    """
    if not username:
        return None

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_tai_khoan,
                ten_dang_nhap,
                mat_khau_hash,
                vai_tro,
                ma_bac_si,
                ma_benh_nhan,
                trang_thai
            FROM tai_khoan
            WHERE ten_dang_nhap = %s
            LIMIT 1
        """, (username.strip(),))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# GET ACCOUNT BY ID
# ==========================================

def get_account_by_id(account_id):
    """
    Lấy thông tin tài khoản theo mã tài khoản.

    Không trả về mật khẩu đã mã hóa.
    """
    if not account_id:
        return None

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_tai_khoan,
                ten_dang_nhap,
                vai_tro,
                ma_bac_si,
                ma_benh_nhan,
                trang_thai,
                ngay_tao,
                ngay_cap_nhat
            FROM tai_khoan
            WHERE ma_tai_khoan = %s
            LIMIT 1
        """, (account_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# AUTHENTICATE ACCOUNT
# ==========================================

def authenticate_account(username, password):
    """
    Xác thực tài khoản đăng nhập.

    Điều kiện:
    1. Tài khoản tồn tại.
    2. Mật khẩu chính xác.
    3. Tài khoản đang Active.

    Trả về thông tin an toàn nếu đăng nhập thành công.
    Trả về None nếu xác thực thất bại.
    """
    if not username or not password:
        return None

    account = get_account_by_username(username)

    if account is None:
        return None

    if account["trang_thai"] != "Active":
        return None

    if not verify_password(
        password,
        account["mat_khau_hash"]
    ):
        return None

    # Không trả mật khẩu hash ra ngoài
    return {
        "ma_tai_khoan": account["ma_tai_khoan"],
        "ten_dang_nhap": account["ten_dang_nhap"],
        "vai_tro": account["vai_tro"],
        "ma_bac_si": account["ma_bac_si"],
        "ma_benh_nhan": account["ma_benh_nhan"],
        "trang_thai": account["trang_thai"]
    }
