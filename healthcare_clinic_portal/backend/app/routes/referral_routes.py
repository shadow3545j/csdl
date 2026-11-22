
from flask import Blueprint, request, session

from mysql.connector import IntegrityError, Error

from app.middleware.auth_middleware import roles_required

from app.services.referral_service import (
    fetch_all_referrals,
    fetch_referral_by_id,
    fetch_referral_form_options,
    fetch_specialists_by_specialty,
    add_referral,
    change_referral_status
)

from app.utils.response import (
    success_response,
    error_response
)


referral_bp = Blueprint(
    "referral",
    __name__,
    url_prefix="/api"
)


# =========================================================
# 1. XÁC ĐỊNH PHẠM VI DỮ LIỆU
# =========================================================

def get_referral_scope():
    """
    Admin / Receptionist:
        Xem toàn bộ phiếu.

    Doctor:
        Chỉ xem phiếu do mình chuyển hoặc được chuyển đến.

    Patient:
        Chỉ xem phiếu thuộc lịch hẹn của mình.
    """

    role = session.get("vai_tro")

    if role == "Doctor":

        doctor_id = session.get("ma_bac_si")

        if not doctor_id:
            return None, None, False

        return doctor_id, None, True

    if role == "Patient":

        patient_id = session.get("ma_benh_nhan")

        if not patient_id:
            return None, None, False

        return None, patient_id, True

    return None, None, True


# =========================================================
# 2. KIỂM TRA DỮ LIỆU TẠO PHIẾU
# =========================================================

def validate_referral_data(data):

    if not isinstance(data, dict):
        return "Dữ liệu gửi lên không hợp lệ."

    required_fields = [
        "ma_lich_hen",
        "ma_chuyen_khoa",
        "ma_bac_si_nhan",
        "ly_do_chuyen"
    ]

    for field in required_fields:

        value = data.get(field)

        if value is None or not str(value).strip():
            return f"Trường {field} không được để trống."

    for field in [
        "ma_lich_hen",
        "ma_chuyen_khoa",
        "ma_bac_si_nhan"
    ]:

        value = str(data[field]).strip()

        if len(value) > 20:
            return f"Trường {field} không được vượt quá 20 ký tự."

    reason = str(data["ly_do_chuyen"]).strip()

    if not reason:
        return "Lý do chuyển tuyến không được để trống."

    return None


# =========================================================
# 3. GET DANH SÁCH PHIẾU CHUYỂN TUYẾN
# GET /api/referrals
#
# Admin, Doctor, Receptionist, Patient
# =========================================================

@referral_bp.route(
    "/referrals",
    methods=["GET"]
)
@roles_required(
    "Admin",
    "Doctor",
    "Receptionist",
    "Patient"
)
def get_referrals():

    try:

        doctor_id, patient_id, valid_scope = get_referral_scope()

        if not valid_scope:
            return error_response(
                "Tài khoản chưa được liên kết với hồ sơ tương ứng.",
                403
            )

        referrals = fetch_all_referrals(
            doctor_id=doctor_id,
            patient_id=patient_id
        )

        return success_response(
            "Lấy danh sách phiếu chuyển tuyến thành công.",
            referrals
        )

    except Error:
        return error_response(
            "Không thể lấy danh sách phiếu chuyển tuyến.",
            500
        )


# =========================================================
# 4. GET CHI TIẾT PHIẾU CHUYỂN TUYẾN
# GET /api/referrals/<referral_id>
#
# Admin, Doctor, Receptionist, Patient
# =========================================================

@referral_bp.route(
    "/referrals/<string:referral_id>",
    methods=["GET"]
)
@roles_required(
    "Admin",
    "Doctor",
    "Receptionist",
    "Patient"
)
def get_referral(referral_id):

    try:

        doctor_id, patient_id, valid_scope = get_referral_scope()

        if not valid_scope:
            return error_response(
                "Tài khoản chưa được liên kết với hồ sơ tương ứng.",
                403
            )

        referral = fetch_referral_by_id(
            referral_id,
            doctor_id=doctor_id,
            patient_id=patient_id
        )

        if referral is None:
            return error_response(
                "Không tìm thấy phiếu chuyển tuyến hoặc bạn không có quyền truy cập.",
                404
            )

        return success_response(
            "Lấy chi tiết phiếu chuyển tuyến thành công.",
            referral
        )

    except Error:
        return error_response(
            "Không thể lấy thông tin phiếu chuyển tuyến.",
            500
        )


# =========================================================
# 5. GET DỮ LIỆU BIỂU MẪU TẠO PHIẾU
# GET /api/referrals/options
#
# Doctor
# =========================================================

@referral_bp.route(
    "/referrals/options",
    methods=["GET"]
)
@roles_required("Doctor")
def get_referral_options():

    doctor_id = session.get("ma_bac_si")

    if not doctor_id:
        return error_response(
            "Tài khoản chưa được liên kết với hồ sơ bác sĩ.",
            403
        )

    try:

        options = fetch_referral_form_options(
            doctor_id
        )

        return success_response(
            "Lấy dữ liệu biểu mẫu chuyển tuyến thành công.",
            options
        )

    except ValueError as error:
        return error_response(
            str(error),
            403
        )

    except Error:
        return error_response(
            "Không thể lấy dữ liệu biểu mẫu chuyển tuyến.",
            500
        )


# =========================================================
# 6. GET BÁC SĨ THEO CHUYÊN KHOA
# GET /api/referrals/specialists?specialty_id=CK001
#
# Admin, Doctor
# =========================================================

@referral_bp.route(
    "/referrals/specialists",
    methods=["GET"]
)
@roles_required(
    "Admin",
    "Doctor"
)
def get_referral_specialists():

    specialty_id = request.args.get("specialty_id")

    if (
        specialty_id is None
        or not specialty_id.strip()
    ):
        return error_response(
            "Vui lòng chọn chuyên khoa.",
            400
        )

    specialty_id = specialty_id.strip()

    if len(specialty_id) > 20:
        return error_response(
            "Mã chuyên khoa không hợp lệ.",
            400
        )

    try:

        specialists = fetch_specialists_by_specialty(
            specialty_id
        )

        return success_response(
            "Lấy danh sách bác sĩ chuyên khoa thành công.",
            specialists
        )

    except Error:
        return error_response(
            "Không thể lấy danh sách bác sĩ chuyên khoa.",
            500
        )


# =========================================================
# 7. POST TẠO PHIẾU CHUYỂN TUYẾN
# POST /api/referrals
#
# Doctor
# Model tiếp tục xác minh người tạo là GP.
# =========================================================

@referral_bp.route(
    "/referrals",
    methods=["POST"]
)
@roles_required("Doctor")
def create_referral_route():

    data = request.get_json(silent=True)

    validation_error = validate_referral_data(data)

    if validation_error:
        return error_response(
            validation_error,
            400
        )

    doctor_id = session.get("ma_bac_si")

    if not doctor_id:
        return error_response(
            "Tài khoản chưa được liên kết với hồ sơ bác sĩ.",
            403
        )

    referral_data = {
        "ma_lich_hen": str(
            data["ma_lich_hen"]
        ).strip(),

        "ma_chuyen_khoa": str(
            data["ma_chuyen_khoa"]
        ).strip(),

        "ma_bac_si_nhan": str(
            data["ma_bac_si_nhan"]
        ).strip(),

        "ly_do_chuyen": str(
            data["ly_do_chuyen"]
        ).strip()
    }

    try:

        referral = add_referral(
            referral_data,
            doctor_id
        )

        return success_response(
            "Tạo phiếu chuyển tuyến thành công.",
            referral,
            201
        )

    except ValueError as error:
        return error_response(
            str(error),
            400
        )

    except IntegrityError:
        return error_response(
            "Dữ liệu không hợp lệ, bị trùng hoặc vi phạm ràng buộc chuyển tuyến. Vui lòng kiểm tra lịch hẹn, chuyên khoa và bác sĩ nhận.",
            409
        )

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi tạo phiếu chuyển tuyến.",
            500
        )

    except RuntimeError as error:
        return error_response(
            str(error),
            500
        )


# =========================================================
# 8. PUT CẬP NHẬT TRẠNG THÁI PHIẾU
# PUT /api/referrals/<referral_id>/status
#
# Admin, Doctor
# =========================================================

@referral_bp.route(
    "/referrals/<string:referral_id>/status",
    methods=["PUT"]
)
@roles_required(
    "Admin",
    "Doctor"
)
def update_referral_status_route(referral_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response(
            "Dữ liệu gửi lên không hợp lệ.",
            400
        )

    new_status = data.get("trang_thai")

    if (
        new_status is None
        or not str(new_status).strip()
    ):
        return error_response(
            "Trạng thái phiếu không được để trống.",
            400
        )

    new_status = str(new_status).strip()

    if new_status not in [
        "Accepted",
        "Completed"
    ]:
        return error_response(
            "Trạng thái chỉ được phép là Accepted hoặc Completed.",
            400
        )

    role = session.get("vai_tro")
    doctor_id = session.get("ma_bac_si")

    if role == "Doctor" and not doctor_id:
        return error_response(
            "Tài khoản chưa được liên kết với hồ sơ bác sĩ.",
            403
        )

    try:

        referral = change_referral_status(
            referral_id,
            new_status,
            doctor_id=doctor_id,
            is_admin=(role == "Admin")
        )

        if referral is None:
            return error_response(
                "Không tìm thấy phiếu chuyển tuyến.",
                404
            )

        return success_response(
            "Cập nhật trạng thái phiếu chuyển tuyến thành công.",
            referral
        )

    except PermissionError as error:
        return error_response(
            str(error),
            403
        )

    except ValueError as error:
        return error_response(
            str(error),
            400
        )

    except IntegrityError:
        return error_response(
            "Không thể cập nhật trạng thái do vi phạm ràng buộc dữ liệu.",
            409
        )

    except Error:
        return error_response(
            "Lỗi cơ sở dữ liệu khi cập nhật phiếu chuyển tuyến.",
            500
        )

    except RuntimeError as error:
        return error_response(
            str(error),
            500
        )
