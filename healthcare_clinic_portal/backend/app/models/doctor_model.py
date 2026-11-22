
from app.database.connection import get_db_connection


# =========================================================
# 1. LẤY DANH SÁCH BÁC SĨ
# =========================================================

def get_all_doctors(doctor_type=None, specialty_id=None):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                d.ma_bac_si,
                d.ho_va_ten,
                d.thu_dien_tu,
                d.so_dien_thoai,
                d.loai_bac_si,
                CASE
                    WHEN d.loai_bac_si = 'GP'
                        THEN 'Đa khoa'
                    ELSE COALESCE(s.ten_chuyen_khoa, 'Chưa xác định')
                END AS ten_chuyen_khoa,
                sp.ma_chuyen_khoa,
                sp.phi_kham,
                sp.so_chung_nhan,
                gp.so_phong_kham,
                gp.cap_do_cham_soc
            FROM bac_si AS d
            LEFT JOIN bac_si_da_khoa AS gp
                ON gp.ma_bac_si = d.ma_bac_si
            LEFT JOIN bac_si_chuyen_khoa AS sp
                ON sp.ma_bac_si = d.ma_bac_si
            LEFT JOIN chuyen_khoa AS s
                ON s.ma_chuyen_khoa = sp.ma_chuyen_khoa
            WHERE 1 = 1
        """

        params = []

        if doctor_type:
            query += " AND d.loai_bac_si = %s"
            params.append(doctor_type)

        if specialty_id:
            query += " AND sp.ma_chuyen_khoa = %s"
            params.append(specialty_id)

        query += " ORDER BY d.ma_bac_si"

        cursor.execute(query, tuple(params))

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 2. LẤY CHI TIẾT BÁC SĨ
# =========================================================

def get_doctor_by_id(doctor_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                d.ma_bac_si,
                d.ho_va_ten,
                d.thu_dien_tu,
                d.so_dien_thoai,
                d.loai_bac_si,
                CASE
                    WHEN d.loai_bac_si = 'GP'
                        THEN 'Đa khoa'
                    ELSE COALESCE(s.ten_chuyen_khoa, 'Chưa xác định')
                END AS ten_chuyen_khoa,
                sp.ma_chuyen_khoa,
                sp.so_chung_nhan,
                sp.phi_kham,
                gp.so_phong_kham,
                gp.cap_do_cham_soc
            FROM bac_si AS d
            LEFT JOIN bac_si_da_khoa AS gp
                ON gp.ma_bac_si = d.ma_bac_si
            LEFT JOIN bac_si_chuyen_khoa AS sp
                ON sp.ma_bac_si = d.ma_bac_si
            LEFT JOIN chuyen_khoa AS s
                ON s.ma_chuyen_khoa = sp.ma_chuyen_khoa
            WHERE d.ma_bac_si = %s
        """, (doctor_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 3. LẤY DANH SÁCH CHUYÊN KHOA
# =========================================================

def get_all_specialties():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                ma_chuyen_khoa,
                ma_dinh_danh,
                ten_chuyen_khoa
            FROM chuyen_khoa
            ORDER BY ten_chuyen_khoa
        """)

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 4. THÊM BÁC SĨ
# =========================================================

def create_doctor(data):
    connection = get_db_connection()
    cursor = connection.cursor()

    doctor_id = data["ma_bac_si"]
    doctor_type = data["loai_bac_si"]

    try:
        connection.start_transaction()

        cursor.execute("""
            INSERT INTO bac_si (
                ma_bac_si,
                ho_va_ten,
                thu_dien_tu,
                so_dien_thoai,
                loai_bac_si
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            doctor_id,
            data["ho_va_ten"],
            data["thu_dien_tu"],
            data["so_dien_thoai"],
            doctor_type
        ))

        if doctor_type == "GP":

            cursor.execute("""
                INSERT INTO bac_si_da_khoa (
                    ma_bac_si,
                    so_phong_kham,
                    cap_do_cham_soc
                )
                VALUES (%s, %s, %s)
            """, (
                doctor_id,
                data.get("so_phong_kham") or None,
                data.get("cap_do_cham_soc") or None
            ))

        elif doctor_type == "Specialist":

            cursor.execute("""
                INSERT INTO bac_si_chuyen_khoa (
                    ma_bac_si,
                    ma_chuyen_khoa,
                    so_chung_nhan,
                    phi_kham
                )
                VALUES (%s, %s, %s, %s)
            """, (
                doctor_id,
                data["ma_chuyen_khoa"],
                data["so_chung_nhan"],
                data["phi_kham"]
            ))

        else:
            raise ValueError("Loại bác sĩ không hợp lệ")

        connection.commit()

        return get_doctor_by_id(doctor_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 5. CẬP NHẬT BÁC SĨ
# =========================================================


def update_doctor(doctor_id, data):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        connection.start_transaction()

        # 1. Khóa bản ghi và lấy loại bác sĩ hiện tại
        cursor.execute("""
            SELECT loai_bac_si
            FROM bac_si
            WHERE ma_bac_si = %s
            FOR UPDATE
        """, (doctor_id,))

        doctor_row = cursor.fetchone()

        if not doctor_row:
            connection.rollback()
            return None

        old_type = doctor_row[0]
        new_type = data["loai_bac_si"]

        if new_type not in ["GP", "Specialist"]:
            raise ValueError("Loại bác sĩ không hợp lệ")

        # 2. Nếu đổi loại bác sĩ:
        # Xóa bảng phụ cũ TRƯỚC KHI cập nhật bảng BAC_SI.
        if old_type != new_type:

            cursor.execute("""
                DELETE FROM bac_si_da_khoa
                WHERE ma_bac_si = %s
            """, (doctor_id,))

            cursor.execute("""
                DELETE FROM bac_si_chuyen_khoa
                WHERE ma_bac_si = %s
            """, (doctor_id,))

        # 3. Cập nhật thông tin bác sĩ chính.
        # Trigger trg_bac_si_type_before_update vẫn được giữ nguyên.
        cursor.execute("""
            UPDATE bac_si
            SET
                ho_va_ten = %s,
                thu_dien_tu = %s,
                so_dien_thoai = %s,
                loai_bac_si = %s
            WHERE ma_bac_si = %s
        """, (
            data["ho_va_ten"],
            data["thu_dien_tu"],
            data["so_dien_thoai"],
            new_type,
            doctor_id
        ))

        # 4. Tạo hoặc cập nhật thông tin bảng phụ.

        if new_type == "GP":

            cursor.execute("""
                SELECT ma_bac_si
                FROM bac_si_da_khoa
                WHERE ma_bac_si = %s
            """, (doctor_id,))

            subtype_exists = cursor.fetchone()

            if subtype_exists:
                cursor.execute("""
                    UPDATE bac_si_da_khoa
                    SET
                        so_phong_kham = %s,
                        cap_do_cham_soc = %s
                    WHERE ma_bac_si = %s
                """, (
                    data.get("so_phong_kham") or None,
                    data.get("cap_do_cham_soc") or None,
                    doctor_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO bac_si_da_khoa (
                        ma_bac_si,
                        so_phong_kham,
                        cap_do_cham_soc
                    )
                    VALUES (%s, %s, %s)
                """, (
                    doctor_id,
                    data.get("so_phong_kham") or None,
                    data.get("cap_do_cham_soc") or None
                ))

        else:

            cursor.execute("""
                SELECT ma_bac_si
                FROM bac_si_chuyen_khoa
                WHERE ma_bac_si = %s
            """, (doctor_id,))

            subtype_exists = cursor.fetchone()

            if subtype_exists:
                cursor.execute("""
                    UPDATE bac_si_chuyen_khoa
                    SET
                        ma_chuyen_khoa = %s,
                        so_chung_nhan = %s,
                        phi_kham = %s
                    WHERE ma_bac_si = %s
                """, (
                    data["ma_chuyen_khoa"],
                    data["so_chung_nhan"],
                    data["phi_kham"],
                    doctor_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO bac_si_chuyen_khoa (
                        ma_bac_si,
                        ma_chuyen_khoa,
                        so_chung_nhan,
                        phi_kham
                    )
                    VALUES (%s, %s, %s, %s)
                """, (
                    doctor_id,
                    data["ma_chuyen_khoa"],
                    data["so_chung_nhan"],
                    data["phi_kham"]
                ))

        # 5. Hoàn tất toàn bộ thao tác
        connection.commit()

        return get_doctor_by_id(doctor_id)

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 6. XÓA BÁC SĨ
# =========================================================

def delete_doctor(doctor_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        connection.start_transaction()

        cursor.execute("""
            SELECT ma_bac_si
            FROM bac_si
            WHERE ma_bac_si = %s
            FOR UPDATE
        """, (doctor_id,))

        if not cursor.fetchone():
            connection.rollback()
            return False

        # Xóa dữ liệu bảng phụ trước.

        cursor.execute("""
            DELETE FROM bac_si_da_khoa
            WHERE ma_bac_si = %s
        """, (doctor_id,))

        cursor.execute("""
            DELETE FROM bac_si_chuyen_khoa
            WHERE ma_bac_si = %s
        """, (doctor_id,))

        # Xóa dữ liệu bác sĩ chính.

        cursor.execute("""
            DELETE FROM bac_si
            WHERE ma_bac_si = %s
        """, (doctor_id,))

        connection.commit()

        return True

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
