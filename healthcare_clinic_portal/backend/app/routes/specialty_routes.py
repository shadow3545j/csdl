
from flask import Blueprint, request
from mysql.connector import IntegrityError, Error

from app.services.specialty_service import (
    fetch_all_specialties,
    fetch_specialty_by_id,
    add_specialty,
    edit_specialty,
    remove_specialty
)

from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import roles_required


specialty_bp = Blueprint(
    "specialty",
    __name__,
    url_prefix="/api"
)


# ==========================================
# GET: DANH SÁCH CHUYÊN KHOA
# Admin, Doctor, Receptionist
# ==========================================

@specialty_bp.route("/specialties", methods=["GET"])
@roles_required("Admin", "Doctor", "Receptionist")
def get_specialties():
    try:
        specialties = fetch_all_specialties()

        return success_response(
            "Lấy danh sách chuyên khoa thành công.",
            specialties
        )

    except Error:
        return error_response(
            "Không thể lấy danh sách chuyên khoa.",
            500
        )


# ==========================================
# GET: CHI TIẾT CHUYÊN KHOA
# Admin, Doctor, Receptionist
# ==========================================

@specialty_bp.route(
    "/specialties/<string:specialty_id>",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Receptionist")
def get_specialty(specialty_id):
    try:
        specialty = fetch_specialty_by_id(specialty_id)

        if not specialty:
            return error_response(
                "Không tìm thấy chuyên khoa.",
                404
            )

        return success_response(
            "Lấy thông tin chuyên khoa thành công.",
            specialty
        )

    except Error:
        return error_response(
            "Không thể lấy thông tin chuyên khoa.",
            500
        )


# ==========================================
# POST: THÊM CHUYÊN KHOA
# Chỉ Admin
# ==========================================

@specialty_bp.route("/specialties", methods=["POST"])
@roles_required("Admin")
def create_specialty_route():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response(
            "Dữ liệu gửi lên không hợp lệ.",
            400
        )

    required_fields = [
        "ma_chuyen_khoa",
        "ma_dinh_danh",
        "ten_chuyen_khoa"
    ]

    for field in required_fields:
        value = data.get(field)

        if value is None or not str(value).strip():
            return error_response(
                f"Trường {field} không được để trống.",
                400
            )

    if len(str(data["ma_chuyen_khoa"]).strip()) > 20:
        return error_response(
            "Mã chuyên khoa không được vượt quá 20 ký tự.",
            400
        )

    if len(str(data["ma_dinh_danh"]).strip()) > 20:
        return error_response(
            "Mã định danh không được vượt quá 20 ký tự.",
            400
        )

    if len(str(data["ten_chuyen_khoa"]).strip()) > 100:
        return error_response(
            "Tên chuyên khoa không được vượt quá 100 ký tự.",
            400
        )

    specialty_data = {
        "ma_chuyen_khoa": str(data["ma_chuyen_khoa"]).strip(),
        "ma_dinh_danh": str(data["ma_dinh_danh"]).strip(),
        "ten_chuyen_khoa": str(data["ten_chuyen_khoa"]).strip()
    }

    try:
        specialty = add_specialty(specialty_data)

        return success_response(
            "Thêm chuyên khoa thành công.",
            specialty,
            201
        )

    except IntegrityError:
        return error_response(
            "Mã chuyên khoa hoặc mã định danh đã tồn tại.",
            409
        )

    except Error:
        return error_response(
            "Lỗi khi thêm chuyên khoa.",
            500
        )


# ==========================================
# PUT: CẬP NHẬT CHUYÊN KHOA
# Chỉ Admin
# ==========================================

@specialty_bp.route(
    "/specialties/<string:specialty_id>",
    methods=["PUT"]
)
@roles_required("Admin")
def update_specialty_route(specialty_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response(
            "Dữ liệu gửi lên không hợp lệ.",
            400
        )

    required_fields = [
        "ma_dinh_danh",
        "ten_chuyen_khoa"
    ]

    for field in required_fields:
        value = data.get(field)

        if value is None or not str(value).strip():
            return error_response(
                f"Trường {field} không được để trống.",
                400
            )

    if len(str(data["ma_dinh_danh"]).strip()) > 20:
        return error_response(
            "Mã định danh không được vượt quá 20 ký tự.",
            400
        )

    if len(str(data["ten_chuyen_khoa"]).strip()) > 100:
        return error_response(
            "Tên chuyên khoa không được vượt quá 100 ký tự.",
            400
        )

    specialty_data = {
        "ma_dinh_danh": str(data["ma_dinh_danh"]).strip(),
        "ten_chuyen_khoa": str(data["ten_chuyen_khoa"]).strip()
    }

    try:
        specialty = edit_specialty(
            specialty_id,
            specialty_data
        )

        if not specialty:
            return error_response(
                "Không tìm thấy chuyên khoa cần cập nhật.",
                404
            )

        return success_response(
            "Cập nhật chuyên khoa thành công.",
            specialty
        )

    except IntegrityError:
        return error_response(
            "Mã định danh đã được sử dụng.",
            409
        )

    except Error:
        return error_response(
            "Lỗi khi cập nhật chuyên khoa.",
            500
        )


# ==========================================
# DELETE: XÓA CHUYÊN KHOA
# Chỉ Admin
# ==========================================

@specialty_bp.route(
    "/specialties/<string:specialty_id>",
    methods=["DELETE"]
)
@roles_required("Admin")
def delete_specialty_route(specialty_id):
    try:
        specialty = fetch_specialty_by_id(specialty_id)

        if not specialty:
            return error_response(
                "Không tìm thấy chuyên khoa cần xóa.",
                404
            )

        deleted = remove_specialty(specialty_id)

        if not deleted:
            return error_response(
                "Không thể xóa chuyên khoa.",
                400
            )

        return success_response(
            "Xóa chuyên khoa thành công.",
            None
        )

    except IntegrityError:
        return error_response(
            "Không thể xóa chuyên khoa vì đang được bác sĩ sử dụng.",
            409
        )

    except Error:
        return error_response(
            "Lỗi khi xóa chuyên khoa.",
            500
        )
