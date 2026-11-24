
from app.database.connection import get_db_connection


# =========================================================
# 1. SINH MÃ DỊ ỨNG TIẾP THEO
# =========================================================

def _generate_allergy_id(cursor):
    """
    Sinh mã dị ứng theo định dạng:
    DMDU0001, DMDU0002, ...
    """

    cursor.execute("""
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(ma_di_ung, 5) AS UNSIGNED)),
            0
        ) AS max_number
        FROM di_ung_benh_nhan
        WHERE ma_di_ung LIKE 'DMDU%'
    """)

    result = cursor.fetchone()
    next_number = int(result[0] or 0) + 1

    return f"DMDU{next_number:04d}"


# =========================================================
# 2. LẤY DANH SÁCH DỊ ỨNG CỦA BỆNH NHÂN
# =========================================================

def _get_patient_allergies(cursor, patient_id):

    cursor.execute("""
        SELECT
            ma_di_ung,
            ma_benh_nhan,
            ten_di_nguyen,
            muc_do
        FROM di_ung_benh_nhan
        WHERE ma_benh_nhan = %s
        ORDER BY ma_di_ung
    """, (patient_id,))

    return cursor.fetchall()


# =========================================================
# 3. CẬP NHẬT DANH SÁCH DỊ ỨNG
# =========================================================

def _replace_patient_allergies(cursor, patient_id, allergies):
    """
    Thay thế danh sách dị ứng hiện tại bằng danh sách mới.

    - Xóa danh sách dị ứng cũ của bệnh nhân.
    - Thêm lại các dị ứng được gửi từ giao diện.
    - Không thay đổi cấu trúc bảng MySQL.
    """

    cursor.execute("""
        DELETE FROM di_ung_benh_nhan
        WHERE ma_benh_nhan = %s
    """, (patient_id,))

    if not allergies:
        return

    for allergy in allergies:

        if not isinstance(allergy, dict):
            continue

        allergen = str(
            allergy.get("ten_di_nguyen") or ""
        ).strip()

        severity = str(
            allergy.get("muc_do") or ""
        ).strip()

        # Bỏ qua dòng trống
        if not allergen:
            continue

        allergy_id = _generate_allergy_id(cursor)

        cursor.execute("""
            INSERT INTO di_ung_benh_nhan (
                ma_di_ung,
                ma_benh_nhan,
                ten_di_nguyen,
                muc_do
            )
            VALUES (%s, %s, %s, %s)
        """, (
            allergy_id,
            patient_id,
            allergen,
            severity
        ))


# =========================================================
# 4. LẤY TẤT CẢ BỆNH NHÂN
# =========================================================

def get_all_patients():

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                ma_benh_nhan,
                ho_va_ten,
                ngay_sinh,
                gioi_tinh,
                so_dien_thoai,
                can_cuoc_cong_dan,
                tom_tat_tien_su
            FROM benh_nhan
            ORDER BY ma_benh_nhan
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 5. LẤY THÔNG TIN CHI TIẾT BỆNH NHÂN
# =========================================================

def get_patient_by_id(patient_id):

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                ma_benh_nhan,
                ho_va_ten,
                ngay_sinh,
                gioi_tinh,
                so_dien_thoai,
                can_cuoc_cong_dan,
                tom_tat_tien_su
            FROM benh_nhan
            WHERE ma_benh_nhan = %s
        """, (patient_id,))

        patient = cursor.fetchone()

        if patient:

            patient["di_ung"] = _get_patient_allergies(
                cursor,
                patient_id
            )

        return patient

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 6. THÊM BỆNH NHÂN
# =========================================================

def create_patient(data):

    connection = get_db_connection()
    cursor = connection.cursor()

    try:

        cursor.execute("""
            INSERT INTO benh_nhan (
                ma_benh_nhan,
                ho_va_ten,
                ngay_sinh,
                gioi_tinh,
                so_dien_thoai,
                can_cuoc_cong_dan,
                tom_tat_tien_su
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            data["ma_benh_nhan"],
            data["ho_va_ten"],
            data["ngay_sinh"],
            data["gioi_tinh"],
            data["so_dien_thoai"],
            data["can_cuoc_cong_dan"],
            data.get("tom_tat_tien_su")
        ))

        # Nếu giao diện gửi danh sách dị ứng
        if "di_ung" in data:

            _replace_patient_allergies(
                cursor,
                data["ma_benh_nhan"],
                data["di_ung"]
            )

        connection.commit()

        return get_patient_by_id(
            data["ma_benh_nhan"]
        )

    except Exception:

        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 7. CẬP NHẬT BỆNH NHÂN
# =========================================================

def update_patient(patient_id, data):

    allowed_fields = {
        "ho_va_ten",
        "ngay_sinh",
        "gioi_tinh",
        "so_dien_thoai",
        "can_cuoc_cong_dan",
        "tom_tat_tien_su"
    }

    updates = {
        key: value
        for key, value in data.items()
        if key in allowed_fields
    }

    connection = get_db_connection()
    cursor = connection.cursor()

    try:

        # Kiểm tra bệnh nhân có tồn tại không
        cursor.execute("""
            SELECT 1
            FROM benh_nhan
            WHERE ma_benh_nhan = %s
        """, (patient_id,))

        if cursor.fetchone() is None:
            connection.rollback()
            return None

        # Cập nhật thông tin cơ bản nếu có
        if updates:

            columns = ", ".join(
                f"{column} = %s"
                for column in updates
            )

            query = f"""
                UPDATE benh_nhan
                SET {columns}
                WHERE ma_benh_nhan = %s
            """

            values = list(updates.values()) + [patient_id]

            cursor.execute(query, values)

        # Chỉ thay đổi dị ứng khi request có trường di_ung
        # Nếu không gửi trường này thì giữ nguyên dữ liệu cũ
        if "di_ung" in data:

            _replace_patient_allergies(
                cursor,
                patient_id,
                data["di_ung"]
            )

        connection.commit()

        return get_patient_by_id(patient_id)

    except Exception:

        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 8. XÓA BỆNH NHÂN
# =========================================================

def delete_patient(patient_id):

    connection = get_db_connection()
    cursor = connection.cursor()

    try:

        cursor.execute("""
            DELETE FROM benh_nhan
            WHERE ma_benh_nhan = %s
        """, (patient_id,))

        if cursor.rowcount == 0:

            connection.rollback()
            return False

        connection.commit()

        return True

    except Exception:

        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
