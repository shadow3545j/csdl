
from datetime import date


REQUIRED_FIELDS = [
    "ma_benh_nhan",
    "ho_va_ten",
    "ngay_sinh",
    "gioi_tinh",
    "so_dien_thoai",
    "can_cuoc_cong_dan"
]


def validate_patient(data):
    if not isinstance(data, dict):
        return False, "Dữ liệu gửi lên không hợp lệ"

    for field in REQUIRED_FIELDS:
        value = data.get(field)

        if value is None or str(value).strip() == "":
            return False, f"Trường {field} không được để trống"

    if data["gioi_tinh"] not in ["Nam", "Nữ"]:
        return False, "Giới tính phải là Nam, Nữ "

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

    return True, None
