
from flask import Blueprint, request

from mysql.connector import IntegrityError, Error

from app.services.medicine_service import (
    fetch_all_medicines,
    fetch_medicine_by_id,
    add_medicine,
    edit_medicine,
    remove_medicine
)

from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import roles_required


medicine_bp = Blueprint(
    "medicine",
    __name__,
    url_prefix="/api"
)


# ==========================================
# 1. KIỂM TRA DỮ LIỆU THUỐC
# ==========================================

def validate_medicine_data(data, is_update=False):

    if not isinstance(data, dict):
        return "Dữ liệu gửi lên không hợp lệ."

    required_fields = [
        "ten_biet_duoc",
        "hoat_chat"
    ]

    if not is_update:
        required_fields.insert(0, "ma_thuoc")

    for field in required_fields:
        value = data.get(field)

        if value is None or not str(value).strip():
            return f"Trường {field} không được để trống."

    # Kiểm tra độ dài theo cấu trúc MySQL
    if not is_update:
        if len(str(data["ma_thuoc"]).strip()) > 20:
            return "Mã thuốc không được vượt quá 20 ký tự."

    if len(str(data["ten_biet_duoc"]).strip()) > 100:
        return "Tên biệt dược không được vượt quá 100 ký tự."

    if len(str(data["hoat_chat"]).strip()) > 100:
        return "Hoạt chất không được vượt quá 100 ký tự."

    # Kiểm tra số lượng tồn kho
    if "so_luong_ton" in data:
        try:
            stock = int(data["so_luong_ton"])

            if isinstance(data["so_luong_ton"], bool):
                return "Số lượng tồn phải là số nguyên không âm."

            if str(data["so_luong_ton"]).strip() != str(stock):
                return "Số lượng tồn phải là số nguyên."

            if stock < 0:
                return "Số lượng tồn không được âm."

        except (ValueError, TypeError):
            return "Số lượng tồn phải là số nguyên hợp lệ."

    elif not is_update:
        data["so_luong_ton"] = 0

    return None


# ==========================================
# 2. GET: DANH SÁCH THUỐC
# GET /api/medicines
# Admin, Doctor, Pharmacist
# ==========================================

@medicine_bp.route("/medicines", methods=["GET"])
@roles_required("Admin", "Doctor", "Pharmacist")
def get_medicines():

    try:
        medicines = fetch_all_medicines()

        return success_response(
            "Lấy danh sách thuốc thành công.",
            medicines
        )

    except Error:
        return error_response(
            "Không thể lấy danh sách thuốc.",
            500
        )


# ==========================================
# 3. GET: CHI TIẾT THUỐC
# GET /api/medicines/<medicine_id>
# Admin, Doctor, Pharmacist
# ==========================================

@medicine_bp.route(
    "/medicines/<string:medicine_id>",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Pharmacist")
def get_medicine(medicine_id):

    try:
        medicine = fetch_medicine_by_id(medicine_id)

        if medicine is None:
            return error_response(
                "Không tìm thấy thuốc.",
                404
            )

        return success_response(
            "Lấy thông tin thuốc thành công.",
            medicine
        )

    except Error:
        return error_response(
            "Không thể lấy thông tin thuốc.",
            500
        )


# ==========================================
# 4. POST: THÊM THUỐC
# POST /api/medicines
# Admin, Pharmacist
# ==========================================

@medicine_bp.route("/medicines", methods=["POST"])
@roles_required("Admin", "Pharmacist")
def create_medicine_route():

    data = request.get_json(silent=True)

    validation_error = validate_medicine_data(data)

    if validation_error:
        return error_response(
            validation_error,
            400
        )

    medicine_data = {
        "ma_thuoc": str(data["ma_thuoc"]).strip(),
        "ten_biet_duoc": str(data["ten_biet_duoc"]).strip(),
        "hoat_chat": str(data["hoat_chat"]).strip(),
        "so_luong_ton": int(data.get("so_luong_ton", 0))
    }

    try:
        medicine = add_medicine(medicine_data)

        return success_response(
            "Thêm thuốc thành công.",
            medicine,
            201
        )

    except IntegrityError:
        return error_response(
            "Mã thuốc đã tồn tại hoặc dữ liệu vi phạm ràng buộc cơ sở dữ liệu.",
            409
        )

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi thêm thuốc.",
            500
        )


# ==========================================
# 5. PUT: CẬP NHẬT THUỐC
# PUT /api/medicines/<medicine_id>
# Admin, Pharmacist
# ==========================================

@medicine_bp.route(
    "/medicines/<string:medicine_id>",
    methods=["PUT"]
)
@roles_required("Admin", "Pharmacist")
def update_medicine_route(medicine_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return error_response(
            "Dữ liệu cập nhật không hợp lệ.",
            400
        )

    validation_error = validate_medicine_data(
        data,
        is_update=True
    )

    if validation_error:
        return error_response(
            validation_error,
            400
        )

    allowed_fields = [
        "ten_biet_duoc",
        "hoat_chat",
        "so_luong_ton"
    ]

    medicine_data = {}

    for field in allowed_fields:
        if field in data:
            value = data[field]

            if field in ["ten_biet_duoc", "hoat_chat"]:
                medicine_data[field] = str(value).strip()
            elif field == "so_luong_ton":
                medicine_data[field] = int(value)

    if not medicine_data:
        return error_response(
            "Không có thông tin hợp lệ để cập nhật.",
            400
        )

    try:
        medicine = edit_medicine(
            medicine_id,
            medicine_data
        )

        if medicine is None:
            return error_response(
                "Không tìm thấy thuốc cần cập nhật.",
                404
            )

        return success_response(
            "Cập nhật thuốc thành công.",
            medicine
        )

    except IntegrityError:
        return error_response(
            "Dữ liệu cập nhật vi phạm ràng buộc cơ sở dữ liệu.",
            409
        )

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi cập nhật thuốc.",
            500
        )


# ==========================================
# 6. DELETE: XÓA THUỐC
# DELETE /api/medicines/<medicine_id>
# Chỉ Admin
# ==========================================

@medicine_bp.route(
    "/medicines/<string:medicine_id>",
    methods=["DELETE"]
)
@roles_required("Admin")
def delete_medicine_route(medicine_id):

    try:
        medicine = fetch_medicine_by_id(medicine_id)

        if medicine is None:
            return error_response(
                "Không tìm thấy thuốc cần xóa.",
                404
            )

        deleted = remove_medicine(medicine_id)

        if not deleted:
            return error_response(
                "Không thể xóa thuốc.",
                400
            )

        return success_response(
            "Xóa thuốc thành công.",
            {
                "ma_thuoc": medicine_id
            }
        )

    except IntegrityError:
        return error_response(
            "Không thể xóa thuốc vì thuốc đang được sử dụng trong đơn thuốc.",
            409
        )

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi xóa thuốc.",
            500
        )
