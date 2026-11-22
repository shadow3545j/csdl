
from flask import Blueprint, request, session

from app.services.patient_service import (
    fetch_all_patients,
    fetch_patient_by_id,
    add_patient,
    edit_patient,
    remove_patient
)

from app.validators.patient_validator import validate_patient
from app.utils.response import success_response, error_response

from app.middleware.auth_middleware import (
    login_required,
    roles_required,
    is_own_patient
)


patient_bp = Blueprint("patient", __name__)


# ==========================================
# GET ALL PATIENTS
# Admin, Doctor, Receptionist
# ==========================================

@patient_bp.route("/api/patients", methods=["GET"])
@roles_required("Admin", "Doctor", "Receptionist")
def get_patients():

    patients = fetch_all_patients()

    return success_response(
        "Lấy danh sách bệnh nhân thành công",
        patients
    )


# ==========================================
# GET PATIENT BY ID
# Admin, Doctor, Receptionist, Patient (own)
# ==========================================

@patient_bp.route("/api/patients/<string:patient_id>", methods=["GET"])
@roles_required("Admin", "Doctor", "Receptionist", "Patient")
def get_patient(patient_id):

    current_role = session.get("vai_tro")

    # Bệnh nhân chỉ được xem hồ sơ của chính mình
    if current_role == "Patient" and not is_own_patient(patient_id):
        return error_response(
            "Bạn không có quyền xem hồ sơ bệnh nhân này",
            403
        )

    patient = fetch_patient_by_id(patient_id)

    if patient is None:
        return error_response(
            "Không tìm thấy bệnh nhân",
            404
        )

    return success_response(
        "Lấy thông tin bệnh nhân thành công",
        patient
    )


# ==========================================
# CREATE PATIENT
# Admin, Receptionist
# ==========================================

@patient_bp.route("/api/patients", methods=["POST"])
@roles_required("Admin", "Receptionist")
def create_patient_route():

    data = request.get_json(silent=True)

    valid, message = validate_patient(data)

    if not valid:
        return error_response(message, 400)

    patient = add_patient(data)

    return success_response(
        "Thêm bệnh nhân thành công",
        patient,
        201
    )


# ==========================================
# UPDATE PATIENT
# Admin, Receptionist
# ==========================================

@patient_bp.route("/api/patients/<string:patient_id>", methods=["PUT"])
@roles_required("Admin", "Receptionist")
def update_patient_route(patient_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or not data:
        return error_response(
            "Dữ liệu cập nhật không hợp lệ",
            400
        )

    patient = edit_patient(patient_id, data)

    if patient is None:
        return error_response(
            "Không tìm thấy bệnh nhân",
            404
        )

    return success_response(
        "Cập nhật bệnh nhân thành công",
        patient
    )


# ==========================================
# DELETE PATIENT
# Admin only
# ==========================================

@patient_bp.route("/api/patients/<string:patient_id>", methods=["DELETE"])
@roles_required("Admin")
def delete_patient_route(patient_id):

    deleted = remove_patient(patient_id)

    if not deleted:
        return error_response(
            "Không tìm thấy bệnh nhân",
            404
        )

    return success_response(
        "Xóa bệnh nhân thành công"
    )
