
from app.models.referral_model import (
    get_all_referrals,
    get_referral_by_id,
    get_referral_form_options,
    get_specialists_by_specialty,
    create_referral,
    update_referral_status
)


# =========================================================
# 1. LẤY DANH SÁCH PHIẾU CHUYỂN TUYẾN
# =========================================================

def fetch_all_referrals(
    doctor_id=None,
    patient_id=None
):
    """
    Admin / Receptionist:
        Lấy toàn bộ phiếu.

    Doctor:
        Chỉ lấy phiếu do mình chuyển hoặc được chuyển đến.

    Patient:
        Chỉ lấy phiếu thuộc lịch hẹn của mình.
    """

    return get_all_referrals(
        doctor_id=doctor_id,
        patient_id=patient_id
    )


# =========================================================
# 2. LẤY CHI TIẾT PHIẾU CHUYỂN TUYẾN
# =========================================================

def fetch_referral_by_id(
    referral_id,
    doctor_id=None,
    patient_id=None
):
    """
    Lấy chi tiết phiếu chuyển tuyến theo mã.

    Có thể giới hạn dữ liệu theo bác sĩ
    hoặc bệnh nhân đang đăng nhập.
    """

    return get_referral_by_id(
        referral_id,
        doctor_id=doctor_id,
        patient_id=patient_id
    )


# =========================================================
# 3. LẤY DỮ LIỆU CHO FORM TẠO PHIẾU
# =========================================================

def fetch_referral_form_options(doctor_id):
    """
    Lấy:
    - Thông tin bác sĩ GP đang đăng nhập.
    - Lịch hẹn đủ điều kiện chuyển tuyến.
    - Danh sách chuyên khoa.
    """

    return get_referral_form_options(doctor_id)


# =========================================================
# 4. LẤY BÁC SĨ THEO CHUYÊN KHOA
# =========================================================

def fetch_specialists_by_specialty(specialty_id):
    """
    Chỉ trả về bác sĩ chuyên khoa
    thuộc chuyên khoa được chọn.
    """

    return get_specialists_by_specialty(specialty_id)


# =========================================================
# 5. TẠO PHIẾU CHUYỂN TUYẾN
# =========================================================

def add_referral(data, doctor_id):
    """
    Tạo phiếu chuyển tuyến.

    Model chịu trách nhiệm:
    - Kiểm tra lịch hẹn.
    - Kiểm tra bác sĩ GP.
    - Kiểm tra chuyên khoa.
    - Kiểm tra bác sĩ nhận.
    - Tạo phiếu.
    - Cập nhật trạng thái lịch hẹn.
    - Commit hoặc rollback transaction.
    """

    return create_referral(
        data,
        doctor_id
    )


# =========================================================
# 6. CẬP NHẬT TRẠNG THÁI PHIẾU
# =========================================================

def change_referral_status(
    referral_id,
    new_status,
    doctor_id=None,
    is_admin=False
):
    """
    Cập nhật trạng thái phiếu.

    Quy trình:
        Pending -> Accepted -> Completed

    Model kiểm tra quyền và trạng thái hợp lệ.
    """

    return update_referral_status(
        referral_id,
        new_status,
        doctor_id=doctor_id,
        is_admin=is_admin
    )
