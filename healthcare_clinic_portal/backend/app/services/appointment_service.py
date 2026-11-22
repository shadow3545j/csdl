
from app.models.appointment_model import (
    get_all_appointments,
    get_appointment_by_id,
    get_appointment_form_options,
    create_appointment,
    update_appointment_status,
    delete_appointment
)


# ==========================================
# GET ALL APPOINTMENTS
# ==========================================

def fetch_all_appointments(doctor_id=None, patient_id=None):
    """
    Lấy danh sách lịch hẹn.

    Admin / Receptionist:
        Không truyền điều kiện lọc.

    Doctor:
        Chỉ lấy lịch được phân công.

    Patient:
        Chỉ lấy lịch của chính mình.
    """
    return get_all_appointments(
        doctor_id=doctor_id,
        patient_id=patient_id
    )


# ==========================================
# GET APPOINTMENT BY ID
# ==========================================

def fetch_appointment_by_id(
    appointment_id,
    doctor_id=None,
    patient_id=None
):
    """
    Lấy chi tiết lịch hẹn.

    Có thể giới hạn dữ liệu theo bác sĩ
    hoặc bệnh nhân đang đăng nhập.
    """
    return get_appointment_by_id(
        appointment_id,
        doctor_id=doctor_id,
        patient_id=patient_id
    )


# ==========================================
# GET FORM OPTIONS
# ==========================================

def fetch_appointment_form_options(patient_only=False):
    """
    Lấy dữ liệu cho biểu mẫu đặt lịch.

    patient_only=True:
        Không trả danh sách bệnh nhân.
    """
    return get_appointment_form_options(
        patient_only=patient_only
    )


# ==========================================
# CREATE APPOINTMENT
# ==========================================

def add_appointment(data):
    """Tạo lịch hẹn mới."""
    return create_appointment(data)


# ==========================================
# UPDATE APPOINTMENT STATUS
# ==========================================


def change_appointment_status(
    appointment_id,
    new_status,
    doctor_id=None
):
    """Thay đổi trạng thái lịch hẹn theo phạm vi được cấp quyền."""
    return update_appointment_status(
        appointment_id,
        new_status,
        doctor_id=doctor_id
    )


# ==========================================
# DELETE APPOINTMENT
# ==========================================

def remove_appointment(appointment_id):
    """Xóa lịch hẹn."""
    return delete_appointment(appointment_id)
