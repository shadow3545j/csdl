
from mysql.connector import IntegrityError, Error
from flask import Blueprint, request

from app.middleware.auth_middleware import roles_required
from app.utils.response import success_response, error_response
from app.services.demo_data_service import create_demo_people


demo_data_bp = Blueprint("demo_data", __name__)


@demo_data_bp.route(
    "/api/admin/demo-data/people",
    methods=["POST"]
)
@roles_required("Admin")
def create_demo_people_route():

    data = request.get_json(silent=True)

    # Yêu cầu xác nhận rõ ràng để tránh gọi nhầm API.
    if (
        not isinstance(data, dict)
        or data.get("confirm") != "CREATE_DEMO_PEOPLE"
    ):
        return error_response(
            "Thiếu xác nhận. Gửi JSON: "
            '{"confirm":"CREATE_DEMO_PEOPLE"}',
            400
        )

    try:
        result = create_demo_people()

        return success_response(
            "Đã tạo thành công bác sĩ, bệnh nhân và tài khoản demo.",
            result,
            201
        )

    except ValueError as error:
        return error_response(str(error), 409)

    except IntegrityError:
        return error_response(
            "Dữ liệu demo vi phạm ràng buộc UNIQUE hoặc khóa ngoại. "
            "Toàn bộ transaction đã được rollback.",
            409
        )

    except Error:
        return error_response(
            "Lỗi MySQL khi tạo dữ liệu demo. "
            "Toàn bộ transaction đã được rollback.",
            500
        )

    except Exception as error:
        print(f"[DEMO DATA ERROR] {error}")

        return error_response(
            "Không thể tạo dữ liệu demo. "
            "Toàn bộ transaction đã được rollback. "
            "Kiểm tra terminal backend để xem lỗi.",
            500
        )
