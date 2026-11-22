
from app.models.medicine_model import (
    get_all_medicines,
    get_medicine_by_id,
    create_medicine,
    update_medicine,
    delete_medicine
)


# ==========================================
# 1. LẤY DANH SÁCH THUỐC
# ==========================================

def fetch_all_medicines():
    """Lấy danh sách thuốc trong danh mục."""
    return get_all_medicines()


# ==========================================
# 2. LẤY CHI TIẾT THUỐC
# ==========================================

def fetch_medicine_by_id(medicine_id):
    """Lấy thông tin một thuốc theo mã."""
    return get_medicine_by_id(medicine_id)


# ==========================================
# 3. THÊM THUỐC
# ==========================================

def add_medicine(data):
    """Thêm thuốc mới vào danh mục."""
    return create_medicine(data)


# ==========================================
# 4. CẬP NHẬT THUỐC
# ==========================================

def edit_medicine(medicine_id, data):
    """Cập nhật thông tin thuốc."""
    return update_medicine(
        medicine_id,
        data
    )


# ==========================================
# 5. XÓA THUỐC
# ==========================================

def remove_medicine(medicine_id):
    """Xóa thuốc khỏi danh mục."""
    return delete_medicine(medicine_id)
