
from app.models.prescription_model import (
    get_all_prescriptions,
    get_prescription_by_id,
    dispense_prescription
)


def fetch_all_prescriptions(
    status=None,
    patient_id=None,
    doctor_id=None
):
    return get_all_prescriptions(
        status=status,
        patient_id=patient_id,
        doctor_id=doctor_id
    )


def fetch_prescription_by_id(
    prescription_id,
    patient_id=None,
    doctor_id=None
):
    return get_prescription_by_id(
        prescription_id,
        patient_id=patient_id,
        doctor_id=doctor_id
    )


def process_dispense_prescription(prescription_id):
    prescription = get_prescription_by_id(prescription_id)

    if prescription is None:
        return False, None

    if prescription["trang_thai"] != "Active":
        return False, (
            "Chỉ có thể cấp phát đơn thuốc đang ở trạng thái Active"
        )

    dispense_prescription(prescription_id)

    updated_prescription = get_prescription_by_id(prescription_id)

    return True, updated_prescription
# ==========================================
# KÊ ĐƠN THUỐC
# ==========================================

def fetch_prescription_form_options(doctor_id):
    from app.models.prescription_model import (
        get_prescription_form_options
    )

    return get_prescription_form_options(doctor_id)


def process_create_prescription(data, doctor_id):
    from app.models.prescription_model import (
        create_prescription
    )

    prescription_id = create_prescription(
        data,
        doctor_id
    )

    return get_prescription_by_id(
        prescription_id,
        doctor_id=doctor_id
    )