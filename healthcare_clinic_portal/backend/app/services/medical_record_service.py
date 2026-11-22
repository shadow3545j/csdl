
from app.models.medical_record_model import (
    get_all_medical_records,
    get_medical_record_by_id,
    get_medical_record_form_options,
    create_medical_record,
    update_medical_record,
    delete_medical_record,
    get_medical_record_attachments,
    get_medical_record_attachment_by_id,
    create_medical_record_attachment,
    update_medical_record_attachment,
    delete_medical_record_attachment
)


# ==========================================
# MEDICAL RECORD SERVICES
# ==========================================

def fetch_all_medical_records(
    status=None,
    patient_id=None,
    doctor_id=None
):
    return get_all_medical_records(
        status=status,
        patient_id=patient_id,
        doctor_id=doctor_id
    )


def fetch_medical_record_by_id(
    record_id,
    doctor_id=None,
    patient_id=None
):
    return get_medical_record_by_id(
        record_id,
        doctor_id=doctor_id,
        patient_id=patient_id
    )


def fetch_medical_record_form_options(doctor_id=None):
    return get_medical_record_form_options(
        doctor_id=doctor_id
    )


def add_medical_record(data, doctor_id=None):
    return create_medical_record(
        data,
        doctor_id=doctor_id
    )


def edit_medical_record(record_id, data, doctor_id=None):
    return update_medical_record(
        record_id,
        data,
        doctor_id=doctor_id
    )


def remove_medical_record(record_id):
    return delete_medical_record(record_id)


# ==========================================
# CORRECTION ATTACHMENT SERVICES
# ==========================================

def fetch_medical_record_attachments(
    record_id,
    doctor_id=None,
    patient_id=None
):
    return get_medical_record_attachments(
        record_id,
        doctor_id=doctor_id,
        patient_id=patient_id
    )


def fetch_medical_record_attachment_by_id(
    attachment_id,
    doctor_id=None,
    patient_id=None
):
    return get_medical_record_attachment_by_id(
        attachment_id,
        doctor_id=doctor_id,
        patient_id=patient_id
    )


def add_medical_record_attachment(data, doctor_id=None):
    return create_medical_record_attachment(
        data,
        doctor_id=doctor_id
    )


def edit_medical_record_attachment(
    attachment_id,
    data,
    doctor_id=None
):
    return update_medical_record_attachment(
        attachment_id,
        data,
        doctor_id=doctor_id
    )


def remove_medical_record_attachment(attachment_id):
    return delete_medical_record_attachment(attachment_id)
