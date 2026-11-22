
from flask import Blueprint, request, session
from mysql.connector import IntegrityError, Error

from app.services.appointment_service import (
    fetch_all_appointments,
    fetch_appointment_by_id,
    fetch_appointment_form_options,
    add_appointment,
    change_appointment_status,
    remove_appointment
)

from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import roles_required


appointment_bp = Blueprint(
    "appointment",
    __name__,
    url_prefix="/api"
)


# ==========================================
# HELPER: LẤY PHẠM VI DỮ LIỆU
# ==========================================

def get_appointment_scope():
    """
    Lấy điều kiện giới hạn dữ liệu từ session.

    Admin / Receptionist:
        Không giới hạn.

    Doctor:
        Chỉ xem lịch được phân công.

    Patient:
        Chỉ xem lịch của chính mình.
    """
    role = session.get("vai_tro")

    if role == "Doctor":
        doctor_id = session.get("ma_bac_si")

        if not doctor_id:
            return None, None, error_response(
                "Tài khoản chưa được liên kết với bác sĩ.",
                403
            )

        return doctor_id, None, None

    if role == "Patient":
        patient_id = session.get("ma_benh_nhan")

        if not patient_id:
            return None, None, error_response(
                "Tài khoản chưa được liên kết với bệnh nhân.",
                403
            )

        return None, patient_id, None

    return None, None, None


# ==========================================
# GET: DANH SÁCH LỊCH HẸN
# Admin, Receptionist, Doctor, Patient
# ==========================================

@appointment_bp.route("/appointments", methods=["GET"])
@roles_required(
    "Admin",
    "Receptionist",
    "Doctor",
    "Patient"
)
def get_appointments():
    try:
        doctor_id, patient_id, error = get_appointment_scope()

        if error:
            return error

        appointments = fetch_all_appointments(
            doctor_id=doctor_id,
            patient_id=patient_id
        )

        return success_response(
            "Lấy danh sách lịch hẹn thành công.",
            appointments
        )

    except Error as e:
        return error_response(
            f"Lỗi truy vấn lịch hẹn: {str(e)}",
            500
        )


# ==========================================
# GET: CHI TIẾT LỊCH HẸN
# Admin, Receptionist, Doctor, Patient
# ==========================================

@appointment_bp.route(
    "/appointments/<string:appointment_id>",
    methods=["GET"]
)
@roles_required(
    "Admin",
    "Receptionist",
    "Doctor",
    "Patient"
)
def get_appointment(appointment_id):
    try:
        doctor_id, patient_id, error = get_appointment_scope()

        if error:
            return error

        appointment = fetch_appointment_by_id(
            appointment_id,
            doctor_id=doctor_id,
            patient_id=patient_id
        )

        if not appointment:
            return error_response(
                "Không tìm thấy lịch hẹn hoặc bạn không có quyền truy cập.",
                404
            )

        return success_response(
            "Lấy thông tin lịch hẹn thành công.",
            appointment
        )

    except Error as e:
        return error_response(
            f"Lỗi truy vấn lịch hẹn: {str(e)}",
            500
        )


# ==========================================
# GET: DỮ LIỆU CHO BIỂU MẪU ĐẶT LỊCH
# Admin, Receptionist, Patient
# ==========================================

@appointment_bp.route(
    "/appointments/options",
    methods=["GET"]
)
@roles_required(
    "Admin",
    "Receptionist",
    "Patient"
)
def get_appointment_options():
    try:
        patient_only = session.get("vai_tro") == "Patient"

        options = fetch_appointment_form_options(
            patient_only=patient_only
        )

        return success_response(
            "Lấy dữ liệu biểu mẫu đặt lịch thành công.",
            options
        )

    except Error as e:
        return error_response(
            f"Lỗi lấy dữ liệu biểu mẫu: {str(e)}",
            500
        )


# ==========================================
# POST: ĐẶT LỊCH KHÁM
# Admin, Receptionist, Patient
# ==========================================

@appointment_bp.route(
    "/appointments",
    methods=["POST"]
)
@roles_required(
    "Admin",
    "Receptionist",
    "Patient"
)
def create_appointment_route():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response(
            "Dữ liệu gửi lên không hợp lệ.",
            400
        )

    role = session.get("vai_tro")

    # Patient chỉ được đặt lịch cho chính mình.
    if role == "Patient":
        patient_id = session.get("ma_benh_nhan")

        if not patient_id:
            return error_response(
                "Tài khoản chưa được liên kết với bệnh nhân.",
                403
            )

    else:
        patient_id = data.get("ma_benh_nhan")

        if patient_id is None or not str(patient_id).strip():
            return error_response(
                "Mã bệnh nhân không được để trống.",
                400
            )

        patient_id = str(patient_id).strip()

    required_fields = [
        "ma_lich_hen",
        "ma_bac_si",
        "thoi_gian_hen",
        "loai_hinh_kham"
    ]

    for field in required_fields:
        value = data.get(field)

        if value is None or not str(value).strip():
            return error_response(
                f"Trường {field} không được để trống.",
                400
            )

    appointment_id = str(data["ma_lich_hen"]).strip()
    doctor_id = str(data["ma_bac_si"]).strip()
    appointment_time = str(data["thoi_gian_hen"]).strip()
    appointment_type = str(data["loai_hinh_kham"]).strip()

    if len(appointment_id) > 20:
        return error_response(
            "Mã lịch hẹn không được vượt quá 20 ký tự.",
            400
        )

    if len(patient_id) > 20:
        return error_response(
            "Mã bệnh nhân không được vượt quá 20 ký tự.",
            400
        )

    if len(doctor_id) > 20:
        return error_response(
            "Mã bác sĩ không được vượt quá 20 ký tự.",
            400
        )

    if appointment_type not in [
        "In-clinic",
        "Telemedicine"
    ]:
        return error_response(
            "Loại hình khám phải là In-clinic hoặc Telemedicine.",
            400
        )

    appointment_data = {
        "ma_lich_hen": appointment_id,
        "ma_benh_nhan": patient_id,
        "ma_bac_si": doctor_id,
        "thoi_gian_hen": appointment_time,
        "loai_hinh_kham": appointment_type,
        "ma_phien_kham": data.get("ma_phien_kham"),
        "duong_dan_video": data.get("duong_dan_video"),
        "khoa_ma_hoa": data.get("khoa_ma_hoa")
    }

    if appointment_type == "Telemedicine":
        telemedicine_fields = [
            "ma_phien_kham",
            "duong_dan_video",
            "khoa_ma_hoa"
        ]

        for field in telemedicine_fields:
            value = appointment_data.get(field)

            if value is None or not str(value).strip():
                return error_response(
                    f"Trường {field} bắt buộc đối với khám từ xa.",
                    400
                )

    else:
        appointment_data["ma_phien_kham"] = None
        appointment_data["duong_dan_video"] = None
        appointment_data["khoa_ma_hoa"] = None

    try:
        appointment = add_appointment(appointment_data)

        return success_response(
            "Đặt lịch khám thành công.",
            appointment,
            201
        )

    except IntegrityError as e:
        return error_response(
            f"Dữ liệu bị trùng hoặc vi phạm ràng buộc: {str(e)}",
            409
        )

    except Error as e:
        return error_response(
            f"Không thể đặt lịch khám: {str(e)}",
            400
        )


# ==========================================
# PUT: CẬP NHẬT TRẠNG THÁI LỊCH HẸN
# Admin, Doctor (lịch được phân công)
# ==========================================

@appointment_bp.route(
    "/appointments/<string:appointment_id>/status",
    methods=["PUT"]
)
@roles_required("Admin", "Doctor")
def update_appointment_status_route(appointment_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response(
            "Dữ liệu gửi lên không hợp lệ.",
            400
        )

    new_status = data.get("trang_thai")

    if new_status is None or not str(new_status).strip():
        return error_response(
            "Trạng thái lịch hẹn không được để trống.",
            400
        )

    allowed_statuses = [
        "Scheduled",
        "In-Consultation",
        "Referred",
        "Completed",
        "Cancelled",
        "No-Show"
    ]

    new_status = str(new_status).strip()

    if new_status not in allowed_statuses:
        return error_response(
            "Trạng thái lịch hẹn không hợp lệ.",
            400
        )

    try:
        # Mặc định Admin không bị giới hạn theo bác sĩ.
        doctor_id = None

        # Doctor chỉ được cập nhật lịch hẹn của chính mình.
        if session.get("vai_tro") == "Doctor":
            doctor_id = session.get("ma_bac_si")

            if not doctor_id:
                return error_response(
                    "Tài khoản chưa được liên kết với bác sĩ.",
                    403
                )

        # Kiểm tra lịch hẹn có tồn tại và thuộc phạm vi được phép.
        appointment = fetch_appointment_by_id(
            appointment_id,
            doctor_id=doctor_id
        )

        if not appointment:
            return error_response(
                "Không tìm thấy lịch hẹn hoặc bạn không có quyền cập nhật.",
                404
            )

        # Truyền doctor_id xuống Service và Model.
        # Model phải dùng doctor_id trong điều kiện UPDATE
        # để tránh cập nhật lịch của bác sĩ khác.
        updated_appointment = change_appointment_status(
            appointment_id,
            new_status,
            doctor_id=doctor_id
        )

        if not updated_appointment:
            return error_response(
                "Không thể cập nhật trạng thái lịch hẹn.",
                400
            )

        return success_response(
            "Cập nhật trạng thái lịch hẹn thành công.",
            updated_appointment
        )

    except Error as e:
        return error_response(
            f"Không thể cập nhật trạng thái lịch hẹn: {str(e)}",
            400
        )


# ==========================================
# DELETE: XÓA LỊCH HẸN
# Admin, Receptionist
# ==========================================

@appointment_bp.route(
    "/appointments/<string:appointment_id>",
    methods=["DELETE"]
)
@roles_required("Admin", "Receptionist")
def delete_appointment_route(appointment_id):
    try:
        appointment = fetch_appointment_by_id(
            appointment_id
        )

        if not appointment:
            return error_response(
                "Không tìm thấy lịch hẹn cần xóa.",
                404
            )

        deleted = remove_appointment(appointment_id)

        if not deleted:
            return error_response(
                "Không thể xóa lịch hẹn.",
                400
            )

        return success_response(
            "Xóa lịch hẹn thành công.",
            None
        )

    except IntegrityError:
        return error_response(
            "Không thể xóa lịch hẹn vì đang được hồ sơ bệnh án hoặc dữ liệu khác sử dụng.",
            409
        )

    except Error as e:
        return error_response(
            f"Lỗi khi xóa lịch hẹn: {str(e)}",
            500
        )
