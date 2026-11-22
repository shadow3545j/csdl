
from app.models.doctor_model import (
    get_all_doctors,
    get_doctor_by_id,
    get_all_specialties,
    create_doctor,
    update_doctor,
    delete_doctor
)


# =========================================================
# 1. LẤY DANH SÁCH BÁC SĨ
# =========================================================

def fetch_all_doctors(doctor_type=None, specialty_id=None):
    return get_all_doctors(
        doctor_type=doctor_type,
        specialty_id=specialty_id
    )


# =========================================================
# 2. LẤY CHI TIẾT BÁC SĨ
# =========================================================

def fetch_doctor_by_id(doctor_id):
    return get_doctor_by_id(doctor_id)


# =========================================================
# 3. LẤY DANH SÁCH CHUYÊN KHOA
# =========================================================

def fetch_all_specialties():
    return get_all_specialties()


# =========================================================
# 4. THÊM BÁC SĨ
# =========================================================

def add_doctor(data):
    return create_doctor(data)


# =========================================================
# 5. CẬP NHẬT BÁC SĨ
# =========================================================

def edit_doctor(doctor_id, data):
    return update_doctor(
        doctor_id,
        data
    )


# =========================================================
# 6. XÓA BÁC SĨ
# =========================================================

def remove_doctor(doctor_id):
    return delete_doctor(doctor_id)
