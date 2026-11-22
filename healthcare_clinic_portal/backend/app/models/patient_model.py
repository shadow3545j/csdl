
from app.database.connection import get_db_connection


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

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


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

        connection.commit()
        return get_patient_by_id(data["ma_benh_nhan"])

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


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

    if not updates:
        return get_patient_by_id(patient_id)

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        columns = ", ".join(f"{column} = %s" for column in updates)

        query = f"""
            UPDATE benh_nhan
            SET {columns}
            WHERE ma_benh_nhan = %s
        """

        values = list(updates.values()) + [patient_id]

        cursor.execute(query, values)

        if cursor.rowcount == 0:
            connection.rollback()
            return None

        connection.commit()
        return get_patient_by_id(patient_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


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
