
from flask import Blueprint, session, jsonify

from app.services.dashboard_service import get_dashboard_statistics
from app.utils.response import success_response
from app.middleware.auth_middleware import roles_required


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/api/dashboard", methods=["GET"])
@roles_required(
    "Admin",
    "Doctor",
    "Receptionist",
    "Pharmacist",
    "Patient"
)
def get_dashboard():
    role = session.get("vai_tro")
    doctor_id = session.get("ma_bac_si")
    patient_id = session.get("ma_benh_nhan")

    try:
        statistics = get_dashboard_statistics(
            role=role,
            doctor_id=doctor_id,
            patient_id=patient_id
        )

        return success_response(
            "Lấy dữ liệu Dashboard thành công",
            statistics
        )

    except ValueError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 403
