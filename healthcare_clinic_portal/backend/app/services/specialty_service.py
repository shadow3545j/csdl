
from app.models.specialty_model import (
    get_all_specialties,
    get_specialty_by_id,
    create_specialty,
    update_specialty,
    delete_specialty
)


def fetch_all_specialties():
    """Lấy danh sách chuyên khoa."""
    return get_all_specialties()


def fetch_specialty_by_id(specialty_id):
    """Lấy chi tiết chuyên khoa."""
    return get_specialty_by_id(specialty_id)


def add_specialty(data):
    """Thêm chuyên khoa."""
    return create_specialty(data)


def edit_specialty(specialty_id, data):
    """Cập nhật chuyên khoa."""
    return update_specialty(specialty_id, data)


def remove_specialty(specialty_id):
    """Xóa chuyên khoa."""
    return delete_specialty(specialty_id)
