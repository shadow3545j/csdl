
from datetime import date


REQUIRED_FIELDS = [
    "ma_benh_nhan",
    "ho_va_ten",
    "ngay_sinh",
    "gioi_tinh",
    "so_dien_thoai",
    "can_cuoc_cong_dan"
]


def validate_allergies(allergies):
    """
    Kiểm tra danh sách dị ứng gửi từ giao diện.
    Mỗi dị ứng gồm:
    - ten_di_nguyen
    - muc_do
    """

    if allergies is None:
        return True, None

    if not isinstance(allergies, list):
        return False, "Danh sách dị ứng không hợp lệ"

    for index, allergy in enumerate(allergies, start=1):

        if not isinstance(allergy, dict):
            return False, f"Dị ứng thứ {index} không hợp lệ"

        allergen = str(
            allergy.get("ten_di_nguyen") or ""
        ).strip()

        severity = str(
            allergy.get("muc_do") or ""
        ).strip()

        if not allergen:
            return False, f"Vui lòng nhập tên chất dị ứng thứ {index}"

        if not severity:
            return False, f"Vui lòng chọn mức độ dị ứng thứ {index}"

    return True, None


def validate_patient(data):
    if not isinstance(data, dict):
        return False, "Dữ liệu gửi lên không hợp lệ"

    for field in REQUIRED_FIELDS:
        value = data.get(field)

        if value is None or str(value).strip() == "":
            return False, f"Trường {field} không được để trống"

    if data["gioi_tinh"] not in ["Nam", "Nữ", "Khác"]:
        return False, "Giới tính phải là Nam, Nữ hoặc Khác"

    try:
        birth_date = date.fromisoformat(str(data["ngay_sinh"]))
    except ValueError:
        return False, "Ngày sinh phải có định dạng YYYY-MM-DD"

    if birth_date > date.today():
        return False, "Ngày sinh không được lớn hơn ngày hiện tại"

    if len(str(data["ma_benh_nhan"])) > 20:
        return False, "Mã bệnh nhân tối đa 20 ký tự"

    if len(str(data["ho_va_ten"])) > 100:
        return False, "Họ và tên tối đa 100 ký tự"

    if len(str(data["so_dien_thoai"])) > 15:
        return False, "Số điện thoại tối đa 15 ký tự"

    if len(str(data["can_cuoc_cong_dan"])) > 20:
        return False, "CCCD tối đa 20 ký tự"

    # Kiểm tra danh sách dị ứng nếu có gửi lên
    valid, message = validate_allergies(
        data.get("di_ung")
    )

    if not valid:
        return False, message

    return True, None
