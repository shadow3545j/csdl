
from app.database.connection import get_db_connection


# ==========================================
# 1. LẤY DANH SÁCH THUỐC
# ==========================================

def get_all_medicines():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            FROM danh_muc_thuoc
            ORDER BY ma_thuoc
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# 2. LẤY THÔNG TIN MỘT THUỐC
# ==========================================

def get_medicine_by_id(medicine_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            FROM danh_muc_thuoc
            WHERE ma_thuoc = %s
        """, (medicine_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# 3. THÊM THUỐC
# ==========================================

def create_medicine(data):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            INSERT INTO danh_muc_thuoc (
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            )
            VALUES (%s, %s, %s, %s)
        """, (
            data["ma_thuoc"],
            data["ten_biet_duoc"],
            data["hoat_chat"],
            data.get("so_luong_ton", 0)
        ))

        connection.commit()

        cursor.execute("""
            SELECT
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            FROM danh_muc_thuoc
            WHERE ma_thuoc = %s
        """, (data["ma_thuoc"],))

        return cursor.fetchone()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# ==========================================
# 4. CẬP NHẬT THUỐC
# ==========================================

def update_medicine(medicine_id, data):
    allowed_fields = {
        "ten_biet_duoc",
        "hoat_chat",
        "so_luong_ton"
    }

    updates = {
        key: value
        for key, value in data.items()
        if key in allowed_fields
    }

    if not updates:
        return get_medicine_by_id(medicine_id)

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        columns = ", ".join(
            f"{column} = %s"
            for column in updates
        )

        query = f"""
            UPDATE danh_muc_thuoc
            SET {columns}
            WHERE ma_thuoc = %s
        """

        values = list(updates.values()) + [medicine_id]

        cursor.execute(query, values)

        # Kiểm tra thuốc có tồn tại hay không.
        cursor.execute("""
            SELECT
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            FROM danh_muc_thuoc
            WHERE ma_thuoc = %s
        """, (medicine_id,))

        medicine = cursor.fetchone()

        if medicine is None:
            connection.rollback()
            return None

        connection.commit()

        return medicine

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# ==========================================
# 5. XÓA THUỐC
# ==========================================

def delete_medicine(medicine_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            DELETE FROM danh_muc_thuoc
            WHERE ma_thuoc = %s
        """, (medicine_id,))

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
