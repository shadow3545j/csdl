
from flask import Blueprint, request, jsonify, session

from app.services.auth_service import (
    login_account,
    get_account_profile
)


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ==========================================
# LOGIN
# ==========================================

@auth_bp.route("/login", methods=["POST"])
def login_route():
    data = request.get_json(silent=True) or {}

    username = data.get("ten_dang_nhap")
    password = data.get("mat_khau")

    result = login_account(username, password)

    if not result["success"]:
        return jsonify({
            "success": False,
            "message": result["message"]
        }), 401

    account = result["account"]

    # Xóa session cũ trước khi tạo phiên mới
    session.clear()

    session["ma_tai_khoan"] = account["ma_tai_khoan"]
    session["ten_dang_nhap"] = account["ten_dang_nhap"]
    session["vai_tro"] = account["vai_tro"]
    session["ma_bac_si"] = account["ma_bac_si"]
    session["ma_benh_nhan"] = account["ma_benh_nhan"]

    session.permanent = True

    return jsonify({
        "success": True,
        "message": "Đăng nhập thành công.",
        "data": account
    }), 200


# ==========================================
# LOGOUT
# ==========================================

@auth_bp.route("/logout", methods=["POST"])
def logout_route():
    session.clear()

    return jsonify({
        "success": True,
        "message": "Đăng xuất thành công."
    }), 200


# ==========================================
# CHECK CURRENT LOGIN
# ==========================================

@auth_bp.route("/me", methods=["GET"])
def get_current_account_route():
    account_id = session.get("ma_tai_khoan")

    if not account_id:
        return jsonify({
            "success": False,
            "message": "Bạn chưa đăng nhập."
        }), 401

    account = get_account_profile(account_id)

    if account is None or account["trang_thai"] != "Active":
        session.clear()

        return jsonify({
            "success": False,
            "message": "Tài khoản không tồn tại hoặc đã bị khóa."
        }), 401

    return jsonify({
        "success": True,
        "data": account
    }), 200
