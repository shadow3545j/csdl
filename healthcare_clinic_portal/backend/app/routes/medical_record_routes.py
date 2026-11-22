
from flask import Blueprint, request, jsonify, session, abort
from mysql.connector import IntegrityError, Error

from app.middleware.auth_middleware import roles_required

from app.services.medical_record_service import (
    fetch_all_medical_records,
    fetch_medical_record_by_id,
    fetch_medical_record_form_options,
    add_medical_record,
    edit_medical_record,
    remove_medical_record,
    fetch_medical_record_attachments,
    fetch_medical_record_attachment_by_id,
    add_medical_record_attachment,
    edit_medical_record_attachment,
    remove_medical_record_attachment
)


medical_record_bp = Blueprint(
    "medical_record",
    __name__,
    url_prefix="/api"
)


# ==========================================
# HELPER: GET CURRENT ACCOUNT SCOPE
# ==========================================


def get_record_scope():
    """
    Xác định phạm vi truy cập hồ sơ theo tài khoản.

    Doctor: bắt buộc có ma_bac_si.
    Patient: bắt buộc có ma_benh_nhan.
    Admin/Receptionist: không giới hạn theo hồ sơ cá nhân.
    """
    role = session.get("vai_tro")

    if role == "Doctor":
        doctor_id = session.get("ma_bac_si")

        if not doctor_id:
            abort(
                403,
                description="Tài khoản bác sĩ chưa được liên kết với hồ sơ bác sĩ."
            )

        return {
            "doctor_id": doctor_id,
            "patient_id": None
        }

    if role == "Patient":
        patient_id = session.get("ma_benh_nhan")

        if not patient_id:
            abort(
                403,
                description="Tài khoản bệnh nhân chưa được liên kết với hồ sơ bệnh nhân."
            )

        return {
            "doctor_id": None,
            "patient_id": patient_id
        }

    return {
        "doctor_id": None,
        "patient_id": None
    }



# ==========================================
# GET ALL MEDICAL RECORDS
# ==========================================

@medical_record_bp.route("/medical-records", methods=["GET"])
@roles_required("Admin", "Doctor", "Receptionist", "Patient")
def get_medical_records():
    try:
        status = request.args.get("status")
        scope = get_record_scope()

        # Patient không được tự chọn bệnh nhân khác
        patient_id = scope["patient_id"]

        if session.get("vai_tro") != "Patient":
            patient_id = request.args.get("patient_id")

        records = fetch_all_medical_records(
            status=status,
            patient_id=patient_id,
            doctor_id=scope["doctor_id"]
        )

        return jsonify({
            "success": True,
            "message": "Lấy danh sách hồ sơ bệnh án thành công.",
            "data": records
        }), 200

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ==========================================
# GET MEDICAL RECORD FORM OPTIONS
# ==========================================

@medical_record_bp.route("/medical-records/options", methods=["GET"])
@roles_required("Admin", "Doctor")
def get_medical_record_options():
    try:
        scope = get_record_scope()

        options = fetch_medical_record_form_options(
            doctor_id=scope["doctor_id"]
        )

        return jsonify({
            "success": True,
            "message": "Lấy dữ liệu biểu mẫu hồ sơ bệnh án thành công.",
            "data": options
        }), 200

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ==========================================
# GET MEDICAL RECORD BY ID
# ==========================================

@medical_record_bp.route(
    "/medical-records/<string:record_id>",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Receptionist", "Patient")
def get_medical_record(record_id):
    try:
        scope = get_record_scope()

        record = fetch_medical_record_by_id(
            record_id,
            doctor_id=scope["doctor_id"],
            patient_id=scope["patient_id"]
        )

        if record is None:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy hồ sơ bệnh án hoặc bạn không có quyền truy cập."
            }), 404

        return jsonify({
            "success": True,
            "message": "Lấy thông tin hồ sơ bệnh án thành công.",
            "data": record
        }), 200

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ==========================================
# CREATE MEDICAL RECORD
# ==========================================

@medical_record_bp.route(
    "/medical-records",
    methods=["POST"]
)
@roles_required("Admin", "Doctor")
def create_medical_record_route():
    data = request.get_json(silent=True) or {}

    required_fields = [
        "ma_ho_so",
        "ma_benh_nhan",
        "ma_lich_hen"
    ]

    for field in required_fields:
        if not data.get(field):
            return jsonify({
                "success": False,
                "message": f"Thiếu trường bắt buộc: {field}"
            }), 400

    if data.get("trang_thai", "Draft") not in ["Draft", "Finalized"]:
        return jsonify({
            "success": False,
            "message": "Trạng thái hồ sơ không hợp lệ."
        }), 400

    try:
        scope = get_record_scope()
        doctor_id = scope["doctor_id"]

        record = add_medical_record(
            data,
            doctor_id=doctor_id
        )

        if record is None:
            return jsonify({
                "success": False,
                "message": "Lịch hẹn không thuộc bác sĩ đang đăng nhập, không hợp lệ hoặc đã có hồ sơ bệnh án."
            }), 403

        return jsonify({
            "success": True,
            "message": "Tạo hồ sơ bệnh án thành công.",
            "data": record
        }), 201

    except IntegrityError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 409

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


# ==========================================
# UPDATE MEDICAL RECORD
# ==========================================

@medical_record_bp.route(
    "/medical-records/<string:record_id>",
    methods=["PUT"]
)
@roles_required("Admin", "Doctor")
def update_medical_record_route(record_id):
    data = request.get_json(silent=True) or {}

    if "trang_thai" in data and data["trang_thai"] not in [
        "Draft", "Finalized"
    ]:
        return jsonify({
            "success": False,
            "message": "Trạng thái hồ sơ không hợp lệ."
        }), 400

    try:
        scope = get_record_scope()
        doctor_id = scope["doctor_id"]

        record = edit_medical_record(
            record_id,
            data,
            doctor_id=doctor_id
        )

        if record is None:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy hồ sơ hoặc bạn không có quyền chỉnh sửa."
            }), 404

        return jsonify({
            "success": True,
            "message": "Cập nhật hồ sơ bệnh án thành công.",
            "data": record
        }), 200

    except IntegrityError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 409

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


# ==========================================
# DELETE MEDICAL RECORD
# ==========================================

@medical_record_bp.route(
    "/medical-records/<string:record_id>",
    methods=["DELETE"]
)
@roles_required("Admin")
def delete_medical_record_route(record_id):
    try:
        result = remove_medical_record(record_id)

        if not result:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy hồ sơ bệnh án."
            }), 404

        return jsonify({
            "success": True,
            "message": "Xóa hồ sơ bệnh án thành công."
        }), 200

    except IntegrityError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 409

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


# ==========================================
# GET MEDICAL RECORD ATTACHMENTS
# ==========================================

@medical_record_bp.route(
    "/medical-records/<string:record_id>/attachments",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Receptionist", "Patient")
def get_medical_record_attachments_route(record_id):
    try:
        scope = get_record_scope()

        # Kiểm tra quyền truy cập hồ sơ trước
        record = fetch_medical_record_by_id(
            record_id,
            doctor_id=scope["doctor_id"],
            patient_id=scope["patient_id"]
        )

        if record is None:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy hồ sơ hoặc bạn không có quyền truy cập."
            }), 404

        attachments = fetch_medical_record_attachments(
            record_id,
            doctor_id=scope["doctor_id"],
            patient_id=scope["patient_id"]
        )

        return jsonify({
            "success": True,
            "message": "Lấy danh sách phụ lục thành công.",
            "data": attachments
        }), 200

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ==========================================
# GET ATTACHMENT BY ID
# ==========================================

@medical_record_bp.route(
    "/medical-record-attachments/<string:attachment_id>",
    methods=["GET"]
)
@roles_required("Admin", "Doctor", "Receptionist", "Patient")
def get_medical_record_attachment_route(attachment_id):
    try:
        scope = get_record_scope()

        attachment = fetch_medical_record_attachment_by_id(
            attachment_id,
            doctor_id=scope["doctor_id"],
            patient_id=scope["patient_id"]
        )

        if attachment is None:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy phụ lục hoặc bạn không có quyền truy cập."
            }), 404

        return jsonify({
            "success": True,
            "message": "Lấy thông tin phụ lục thành công.",
            "data": attachment
        }), 200

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 500


# ==========================================
# CREATE ATTACHMENT
# ==========================================

@medical_record_bp.route(
    "/medical-record-attachments",
    methods=["POST"]
)
@roles_required("Admin", "Doctor")
def create_medical_record_attachment_route():
    data = request.get_json(silent=True) or {}

    required_fields = [
        "ma_phu_luc",
        "ma_ho_so",
        "ly_do_dinh_chinh",
        "noi_dung"
    ]

    for field in required_fields:
        if not data.get(field):
            return jsonify({
                "success": False,
                "message": f"Thiếu trường bắt buộc: {field}"
            }), 400

    try:
        scope = get_record_scope()
        doctor_id = scope["doctor_id"]

        attachment = add_medical_record_attachment(
            data,
            doctor_id=doctor_id
        )

        if attachment is None:
            return jsonify({
                "success": False,
                "message": "Hồ sơ không tồn tại hoặc không thuộc bác sĩ đang đăng nhập."
            }), 403

        return jsonify({
            "success": True,
            "message": "Thêm phụ lục đính chính thành công.",
            "data": attachment
        }), 201

    except IntegrityError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 409

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


# ==========================================
# UPDATE ATTACHMENT
# ==========================================

@medical_record_bp.route(
    "/medical-record-attachments/<string:attachment_id>",
    methods=["PUT"]
)
@roles_required("Admin", "Doctor")
def update_medical_record_attachment_route(attachment_id):
    data = request.get_json(silent=True) or {}

    required_fields = [
        "ly_do_dinh_chinh",
        "noi_dung"
    ]

    for field in required_fields:
        if not data.get(field):
            return jsonify({
                "success": False,
                "message": f"Thiếu trường bắt buộc: {field}"
            }), 400

    try:
        scope = get_record_scope()
        doctor_id = scope["doctor_id"]

        attachment = edit_medical_record_attachment(
            attachment_id,
            data,
            doctor_id=doctor_id
        )

        if attachment is None:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy phụ lục hoặc bạn không có quyền chỉnh sửa."
            }), 404

        return jsonify({
            "success": True,
            "message": "Cập nhật phụ lục thành công.",
            "data": attachment
        }), 200

    except IntegrityError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 409

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


# ==========================================
# DELETE ATTACHMENT
# ==========================================

@medical_record_bp.route(
    "/medical-record-attachments/<string:attachment_id>",
    methods=["DELETE"]
)
@roles_required("Admin")
def delete_medical_record_attachment_route(attachment_id):
    try:
        result = remove_medical_record_attachment(attachment_id)

        if not result:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy phụ lục đính chính."
            }), 404

        return jsonify({
            "success": True,
            "message": "Xóa phụ lục đính chính thành công."
        }), 200

    except IntegrityError as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 409

    except Error as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400
