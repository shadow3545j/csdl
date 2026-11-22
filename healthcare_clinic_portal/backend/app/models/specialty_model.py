
from app.database.connection import get_db_connection


def get_all_specialties():
    """Lấy danh sách tất cả chuyên khoa."""
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_chuyen_khoa,
                ma_dinh_danh,
                ten_chuyen_khoa
            FROM chuyen_khoa
            ORDER BY ma_chuyen_khoa
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


def get_specialty_by_id(specialty_id):
    """Lấy thông tin một chuyên khoa."""
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_chuyen_khoa,
                ma_dinh_danh,
                ten_chuyen_khoa
            FROM chuyen_khoa
            WHERE ma_chuyen_khoa = %s
        """, (specialty_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


def create_specialty(data):
    """Thêm chuyên khoa mới."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            INSERT INTO chuyen_khoa (
                ma_chuyen_khoa,
                ma_dinh_danh,
                ten_chuyen_khoa
            )
            VALUES (%s, %s, %s)
        """, (
            data["ma_chuyen_khoa"],
            data["ma_dinh_danh"],
            data["ten_chuyen_khoa"]
        ))

        connection.commit()

        return get_specialty_by_id(data["ma_chuyen_khoa"])

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def update_specialty(specialty_id, data):
    """Cập nhật thông tin chuyên khoa."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            UPDATE chuyen_khoa
            SET
                ma_dinh_danh = %s,
                ten_chuyen_khoa = %s
            WHERE ma_chuyen_khoa = %s
        """, (
            data["ma_dinh_danh"],
            data["ten_chuyen_khoa"],
            specialty_id
        ))

        if cursor.rowcount == 0:
            cursor.execute("""
                SELECT ma_chuyen_khoa
                FROM chuyen_khoa
                WHERE ma_chuyen_khoa = %s
            """, (specialty_id,))

            if cursor.fetchone() is None:
                connection.rollback()
                return None

        connection.commit()

        return get_specialty_by_id(specialty_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


def delete_specialty(specialty_id):
    """Xóa chuyên khoa."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            DELETE FROM chuyen_khoa
            WHERE ma_chuyen_khoa = %s
        """, (specialty_id,))

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
