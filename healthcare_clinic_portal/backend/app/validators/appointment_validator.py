
from datetime import datetime


def validate_appointment(data):
    if not isinstance(data, dict):
        return False, "Dữ liệu gửi lên không hợp lệ"

    required_fields = [
        "ma_lich_hen",
        "ma_benh_nhan",
        "ma_bac_si",
        "thoi_gian_hen",
        "loai_hinh_kham"
    ]

    for field in required_fields:
        if not data.get(field):
            return False, f"Thiếu trường {field}"

    if data["loai_hinh_kham"] not in ["In-clinic", "Telemedicine"]:
        return False, "Loại hình khám không hợp lệ"

    try:
        datetime.fromisoformat(
            str(data["thoi_gian_hen"]).replace("Z", "+00:00")
        )
    except ValueError:
        return False, "Thời gian hẹn không hợp lệ"

    if len(str(data["ma_lich_hen"])) > 20:
        return False, "Mã lịch hẹn tối đa 20 ký tự"

    if data["loai_hinh_kham"] == "Telemedicine":
        required_telemedicine_fields = [
            "ma_phien_kham",
            "duong_dan_video",
            "khoa_ma_hoa"
        ]

        for field in required_telemedicine_fields:
            if not data.get(field):
                return False, f"Khám từ xa cần có {field}"

    return True, None
