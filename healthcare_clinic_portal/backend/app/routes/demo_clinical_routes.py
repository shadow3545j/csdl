
from mysql.connector import Error
from flask import Blueprint, request

from app.middleware.auth_middleware import roles_required
from app.utils.response import success_response, error_response
from app.services.demo_clinical_service import (
    create_demo_clinical_data
)


demo_clinical_bp = Blueprint("demo_clinical", __name__)


@demo_clinical_bp.route(
    "/api/admin/demo-data/clinical",
    methods=["POST"]
)
@roles_required("Admin")
def create_demo_clinical_route():

    data = request.get_json(silent=True)

    if (
        not isinstance(data, dict)
        or data.get("confirm") != "CREATE_DEMO_CLINICAL"
    ):
        return error_response(
            "Thiếu xác nhận tạo dữ liệu nghiệp vụ demo.",
            400
        )

    try:
        result = create_demo_clinical_data()

        return success_response(
            "Đã tạo dữ liệu nghiệp vụ demo.",
            result,
            201
        )

    except ValueError as error:
        return error_response(str(error), 409)

    except Error as error:
        print(f"[DEMO CLINICAL MYSQL ERROR] {error}")

        return error_response(
            "Lỗi MySQL khi tạo dữ liệu nghiệp vụ demo.",
            500
        )

    except Exception as error:
        print(f"[DEMO CLINICAL ERROR] {error}")

        return error_response(
            "Không thể tạo dữ liệu nghiệp vụ demo. "
            "Kiểm tra terminal backend.",
            500
        )
