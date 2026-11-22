
from app.models.patient_model import (
    get_all_patients,
    get_patient_by_id,
    create_patient,
    update_patient,
    delete_patient
)


def fetch_all_patients():
    return get_all_patients()


def fetch_patient_by_id(patient_id):
    return get_patient_by_id(patient_id)


def add_patient(data):
    return create_patient(data)


def edit_patient(patient_id, data):
    return update_patient(patient_id, data)


def remove_patient(patient_id):
    return delete_patient(patient_id)
