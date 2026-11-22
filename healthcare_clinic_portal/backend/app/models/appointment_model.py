
from app.database.connection import get_db_connection


# ==========================================
# GET ALL APPOINTMENTS
# ==========================================

def get_all_appointments(doctor_id=None, patient_id=None):
    """
    Lấy danh sách lịch hẹn.

    doctor_id:
        Chỉ lấy lịch được phân công cho bác sĩ.

    patient_id:
        Chỉ lấy lịch của bệnh nhân tương ứng.

    Không truyền hai tham số:
        Lấy tất cả lịch hẹn (dành cho Admin/Receptionist).
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                ma_lich_hen,
                ma_benh_nhan,
                ten_benh_nhan,
                ma_bac_si,
                ten_bac_si,
                thoi_gian_hen,
                loai_hinh_kham,
                trang_thai
            FROM v_appointment_details
        """

        conditions = []
        params = []

        if doctor_id is not None:
            conditions.append("ma_bac_si = %s")
            params.append(doctor_id)

        if patient_id is not None:
            conditions.append("ma_benh_nhan = %s")
            params.append(patient_id)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY thoi_gian_hen DESC"

        cursor.execute(query, tuple(params))

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# GET APPOINTMENT BY ID
# ==========================================

def get_appointment_by_id(
    appointment_id,
    doctor_id=None,
    patient_id=None
):
    """
    Lấy chi tiết lịch hẹn.

    Có thể giới hạn theo bác sĩ hoặc bệnh nhân.
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                ma_lich_hen,
                ma_benh_nhan,
                ten_benh_nhan,
                ma_bac_si,
                ten_bac_si,
                thoi_gian_hen,
                loai_hinh_kham,
                trang_thai
            FROM v_appointment_details
            WHERE ma_lich_hen = %s
        """

        params = [appointment_id]

        if doctor_id is not None:
            query += " AND ma_bac_si = %s"
            params.append(doctor_id)

        if patient_id is not None:
            query += " AND ma_benh_nhan = %s"
            params.append(patient_id)

        cursor.execute(query, tuple(params))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# GET APPOINTMENT FORM OPTIONS
# ==========================================

def get_appointment_form_options(patient_only=False):
    """
    Lấy dữ liệu cho biểu mẫu đặt lịch.

    patient_only=True:
        Chỉ trả về danh sách bác sĩ.
        Không trả danh sách bệnh nhân cho tài khoản Patient.
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        patients = []

        if not patient_only:
            cursor.execute("""
                SELECT
                    ma_benh_nhan,
                    ho_va_ten
                FROM benh_nhan
                ORDER BY ho_va_ten
            """)

            patients = cursor.fetchall()

        cursor.execute("""
            SELECT
                ma_bac_si,
                ho_va_ten,
                loai_bac_si
            FROM bac_si
            ORDER BY ho_va_ten
        """)

        doctors = cursor.fetchall()

        return {
            "patients": patients,
            "doctors": doctors
        }

    finally:
        cursor.close()
        connection.close()


# ==========================================
# CREATE APPOINTMENT
# ==========================================

def create_appointment(data):
    """
    Đặt lịch khám bằng stored procedure sp_dat_lich_hen.

    In-clinic:
        Các trường thông tin phiên khám từ xa là NULL.

    Telemedicine:
        Bắt buộc có mã phiên, đường dẫn video
        và khóa mã hóa.
    """
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    appointment_id = data["ma_lich_hen"]

    try:
        cursor.execute("""
            CALL sp_dat_lich_hen(
                %s, %s, %s, %s,
                %s, %s, %s, %s
            )
        """, (
            appointment_id,
            data["ma_benh_nhan"],
            data["ma_bac_si"],
            data["thoi_gian_hen"],
            data["loai_hinh_kham"],
            data.get("ma_phien_kham"),
            data.get("duong_dan_video"),
            data.get("khoa_ma_hoa")
        ))

        # Đọc hết các result set của stored procedure.
        while cursor.nextset():
            pass

        cursor.execute("""
            SELECT
                ma_lich_hen,
                ma_benh_nhan,
                ten_benh_nhan,
                ma_bac_si,
                ten_bac_si,
                thoi_gian_hen,
                loai_hinh_kham,
                trang_thai
            FROM v_appointment_details
            WHERE ma_lich_hen = %s
        """, (appointment_id,))

        result = cursor.fetchone()

        connection.commit()

        return result

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# ==========================================
# UPDATE APPOINTMENT STATUS
# ==========================================


def update_appointment_status(
    appointment_id,
    new_status,
    doctor_id=None
):
    """
    Cập nhật trạng thái lịch hẹn.

    doctor_id:
        None: Admin được cập nhật theo mã lịch hẹn.
        Có mã bác sĩ: chỉ cập nhật lịch thuộc bác sĩ đó.

    Điều kiện bác sĩ được đưa thẳng vào câu UPDATE
    để tránh trường hợp kiểm tra quyền xong rồi dữ liệu
    bị thay đổi trước khi cập nhật.
    """
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        query = """
            UPDATE lich_hen_kham
            SET trang_thai = %s
            WHERE ma_lich_hen = %s
        """

        params = [new_status, appointment_id]

        if doctor_id is not None:
            query += " AND ma_bac_si = %s"
            params.append(doctor_id)

        cursor.execute(query, tuple(params))

        # rowcount có thể bằng 0 nếu trạng thái không đổi.
        # Vì vậy cần kiểm tra bản ghi còn tồn tại và đúng phạm vi.
        check_query = """
            SELECT ma_lich_hen
            FROM lich_hen_kham
            WHERE ma_lich_hen = %s
        """
        check_params = [appointment_id]

        if doctor_id is not None:
            check_query += " AND ma_bac_si = %s"
            check_params.append(doctor_id)

        cursor.execute(check_query, tuple(check_params))
        appointment_exists = cursor.fetchone()

        if appointment_exists is None:
            connection.rollback()
            return None

        connection.commit()

        return get_appointment_by_id(
            appointment_id,
            doctor_id=doctor_id
        )

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# ==========================================
# DELETE APPOINTMENT
# ==========================================

def delete_appointment(appointment_id):
    """Xóa lịch hẹn nếu không bị ràng buộc khóa ngoại."""
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            DELETE FROM lich_hen_kham
            WHERE ma_lich_hen = %s
        """, (appointment_id,))

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
