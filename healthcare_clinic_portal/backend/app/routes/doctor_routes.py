
from flask import Blueprint, request

from mysql.connector import IntegrityError, Error
import re
from app.services.doctor_service import (
    fetch_all_doctors,
    fetch_doctor_by_id,
    add_doctor,
    edit_doctor,
    remove_doctor
)

from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import roles_required


doctor_bp = Blueprint("doctor", __name__)


# =========================================================
# 1. KIỂM TRA DỮ LIỆU ĐẦU VÀO
# =========================================================


def validate_doctor_data(data, is_update=False):

    if not isinstance(data, dict):
        return "Dữ liệu gửi lên không hợp lệ"

    required_fields = [
        "ho_va_ten",
        "thu_dien_tu",
        "so_dien_thoai",
        "loai_bac_si"
    ]

    if not is_update:
        required_fields.append("ma_bac_si")

    for field in required_fields:
        value = data.get(field)

        if value is None or str(value).strip() == "":
            return f"Vui lòng nhập đầy đủ trường {field}"

    # Kiểm tra email
    email = str(data.get("thu_dien_tu", "")).strip()

    if len(email) > 254:
        return "Email không được vượt quá 254 ký tự"

    email_pattern = (
        r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
        r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
        r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
    )

    if not re.fullmatch(email_pattern, email):
        return "Địa chỉ email không đúng định dạng"

    doctor_type = data.get("loai_bac_si")

    if doctor_type not in ["GP", "Specialist"]:
        return "Loại bác sĩ phải là GP hoặc Specialist"

    if doctor_type == "Specialist":

        specialist_fields = [
            "ma_chuyen_khoa",
            "so_chung_nhan",
            "phi_kham"
        ]

        for field in specialist_fields:
            value = data.get(field)

            if value is None or str(value).strip() == "":
                return f"Vui lòng nhập {field}"

        try:
            fee = float(data["phi_kham"])

            if fee < 0:
                return "Phí khám không được âm"

        except (ValueError, TypeError):
            return "Phí khám phải là một số hợp lệ"

    return None


# =========================================================
# 2. LẤY DANH SÁCH BÁC SĨ
# GET /api/doctors
# Admin, Doctor, Receptionist
# =========================================================

@doctor_bp.route("/api/doctors", methods=["GET"])
@roles_required("Admin", "Doctor", "Receptionist")
def get_doctors():

    doctor_type = request.args.get("type")
    specialty_id = request.args.get("specialty")

    if doctor_type and doctor_type not in ["GP", "Specialist"]:
        return error_response(
            "Loại bác sĩ phải là GP hoặc Specialist",
            400
        )

    try:
        doctors = fetch_all_doctors(
            doctor_type,
            specialty_id
        )

        return success_response(
            "Lấy danh sách bác sĩ thành công",
            doctors
        )

    except Error:
        return error_response(
            "Không thể lấy danh sách bác sĩ",
            500
        )


# =========================================================
# 3. LẤY CHI TIẾT BÁC SĨ
# GET /api/doctors/<doctor_id>
# Admin, Doctor, Receptionist
# =========================================================

@doctor_bp.route(
    "/api/doctors/<string:doctor_id>",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Receptionist")
def get_doctor(doctor_id):

    try:
        doctor = fetch_doctor_by_id(doctor_id)

        if doctor is None:
            return error_response(
                "Không tìm thấy bác sĩ",
                404
            )

        return success_response(
            "Lấy thông tin bác sĩ thành công",
            doctor
        )

    except Error:
        return error_response(
            "Không thể lấy thông tin bác sĩ",
            500
        )
# =========================================================
# 5. THÊM BÁC SĨ
# POST /api/doctors
# Chỉ Admin
# =========================================================

@doctor_bp.route(
    "/api/doctors",
    methods=["POST"]
)
@roles_required("Admin")
def create_doctor():

    data = request.get_json(silent=True)

    validation_error = validate_doctor_data(data)

    if validation_error:
        return error_response(
            validation_error,
            400
        )

    try:
        doctor = add_doctor(data)

        return success_response(
            "Thêm bác sĩ thành công",
            doctor,
            201
        )

    except IntegrityError:
        return error_response(
            "Mã bác sĩ, email, số điện thoại, số chứng nhận hoặc chuyên khoa đã tồn tại hoặc không hợp lệ",
            409
        )

    except ValueError as error:
        return error_response(str(error), 400)

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi thêm bác sĩ",
            500
        )


# =========================================================
# 6. CẬP NHẬT BÁC SĨ
# PUT /api/doctors/<doctor_id>
# Chỉ Admin
# =========================================================

@doctor_bp.route(
    "/api/doctors/<string:doctor_id>",
    methods=["PUT"]
)
@roles_required("Admin")
def update_doctor(doctor_id):

    data = request.get_json(silent=True)

    validation_error = validate_doctor_data(
        data,
        is_update=True
    )

    if validation_error:
        return error_response(
            validation_error,
            400
        )

    try:
        doctor = edit_doctor(
            doctor_id,
            data
        )

        if doctor is None:
            return error_response(
                "Không tìm thấy bác sĩ cần cập nhật",
                404
            )

        return success_response(
            "Cập nhật bác sĩ thành công",
            doctor
        )

    except IntegrityError:
        return error_response(
            "Email, số điện thoại, số chứng nhận hoặc chuyên khoa đã tồn tại hoặc không hợp lệ",
            409
        )

    except ValueError as error:
        return error_response(str(error), 400)

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi cập nhật bác sĩ",
            500
        )


# =========================================================
# 7. XÓA BÁC SĨ
# DELETE /api/doctors/<doctor_id>
# Chỉ Admin
# =========================================================

@doctor_bp.route(
    "/api/doctors/<string:doctor_id>",
    methods=["DELETE"]
)
@roles_required("Admin")
def delete_doctor(doctor_id):

    try:
        deleted = remove_doctor(doctor_id)

        if not deleted:
            return error_response(
                "Không tìm thấy bác sĩ cần xóa",
                404
            )

        return success_response(
            "Xóa bác sĩ thành công",
            {
                "ma_bac_si": doctor_id
            }
        )

    except IntegrityError:
        return error_response(
            "Không thể xóa bác sĩ vì đang được sử dụng trong dữ liệu liên quan",
            409
        )

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi xóa bác sĩ",
            500
        )
