
from flask import Blueprint, request, session

from app.services.prescription_service import (
    fetch_all_prescriptions,
    fetch_prescription_by_id,
    process_dispense_prescription,
    fetch_prescription_form_options,
    process_create_prescription
)

from app.middleware.auth_middleware import roles_required

from app.utils.response import success_response, error_response


prescription_bp = Blueprint("prescription", __name__)


def get_prescription_scope():
    """
    Xác định phạm vi dữ liệu theo tài khoản đăng nhập.
    """
    role = session.get("vai_tro")

    if role == "Doctor":
        doctor_id = session.get("ma_bac_si")

        if not doctor_id:
            return None, None, False

        return None, doctor_id, True

    if role == "Patient":
        patient_id = session.get("ma_benh_nhan")

        if not patient_id:
            return None, None, False

        return patient_id, None, True

    return None, None, True


@prescription_bp.route("/api/prescriptions", methods=["GET"])
@roles_required("Admin", "Doctor", "Pharmacist", "Patient")
def get_prescriptions():
    status = request.args.get("status")

    allowed_statuses = ["Active", "Dispensed", "Cancelled"]

    if status and status not in allowed_statuses:
        return error_response(
            "Trạng thái đơn thuốc không hợp lệ",
            400
        )

    patient_id, doctor_id, valid_scope = get_prescription_scope()

    if not valid_scope:
        return error_response(
            "Tài khoản chưa được liên kết với hồ sơ tương ứng",
            403
        )

    prescriptions = fetch_all_prescriptions(
        status=status,
        patient_id=patient_id,
        doctor_id=doctor_id
    )

    return success_response(
        "Lấy danh sách đơn thuốc thành công",
        prescriptions
    )


@prescription_bp.route(
    "/api/prescriptions/<string:prescription_id>",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Pharmacist", "Patient")
def get_prescription(prescription_id):
    patient_id, doctor_id, valid_scope = get_prescription_scope()

    if not valid_scope:
        return error_response(
            "Tài khoản chưa được liên kết với hồ sơ tương ứng",
            403
        )

    prescription = fetch_prescription_by_id(
        prescription_id,
        patient_id=patient_id,
        doctor_id=doctor_id
    )

    if prescription is None:
        return error_response(
            "Không tìm thấy đơn thuốc",
            404
        )

    return success_response(
        "Lấy thông tin đơn thuốc thành công",
        prescription
    )


@prescription_bp.route(
    "/api/prescriptions/<string:prescription_id>/dispense",
    methods=["POST"]
)
@roles_required("Admin", "Pharmacist")
def dispense_prescription_route(prescription_id):
    success, result = process_dispense_prescription(
        prescription_id
    )

    if not success:
        if result is None:
            return error_response(
                "Không tìm thấy đơn thuốc",
                404
            )

        return error_response(result, 400)

    return success_response(
        "Cấp phát thuốc thành công",
        result
    )
# ==========================================
# API KÊ ĐƠN THUỐC
# ==========================================

@prescription_bp.route(
    "/api/prescriptions/form-options",
    methods=["GET"]
)
@roles_required("Doctor")
def get_prescription_form_options_route():

    doctor_id = session.get("ma_bac_si")

    if not doctor_id:
        return error_response(
            "Tài khoản chưa được liên kết với bác sĩ.",
            403
        )

    data = fetch_prescription_form_options(doctor_id)

    return success_response(
        "Lấy dữ liệu kê đơn thành công.",
        data
    )


@prescription_bp.route(
    "/api/prescriptions",
    methods=["POST"]
)
@roles_required("Doctor")
def create_prescription_route():

    doctor_id = session.get("ma_bac_si")

    if not doctor_id:
        return error_response(
            "Tài khoản chưa được liên kết với bác sĩ.",
            403
        )

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response(
            "Dữ liệu gửi lên không hợp lệ.",
            400
        )

    try:
        prescription = process_create_prescription(
            data,
            doctor_id
        )

        return success_response(
            "Tạo đơn thuốc thành công.",
            prescription
        )

    except ValueError as exc:
        return error_response(str(exc), 400)

    except Exception as exc:
        message = str(exc).lower()

        if (
            "allerg" in message
            or "dị ứng" in message
            or "di ung" in message
        ):
            return error_response(
                "Không thể kê thuốc do vi phạm kiểm tra dị ứng của bệnh nhân.",
                400
            )

        if "duplicate entry" in message:
            return error_response(
                "Mã đơn hoặc mã chi tiết bị trùng. Vui lòng thử lại.",
                409
            )

        raise