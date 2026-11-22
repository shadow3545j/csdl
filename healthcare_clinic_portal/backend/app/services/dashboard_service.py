
from app.database.connection import get_db_connection


def format_datetime(value):
    if value is None:
        return None

    return value.strftime("%Y-%m-%d %H:%M:%S")


def get_dashboard_statistics(
    role,
    doctor_id=None,
    patient_id=None
):
    allowed_roles = (
        "Admin",
        "Doctor",
        "Receptionist",
        "Pharmacist",
        "Patient"
    )

    if role not in allowed_roles:
        raise ValueError("Vai trò tài khoản không hợp lệ.")

    if role == "Doctor" and not doctor_id:
        raise ValueError("Tài khoản bác sĩ chưa được liên kết.")

    if role == "Patient" and not patient_id:
        raise ValueError("Tài khoản bệnh nhân chưa được liên kết.")

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        statistics = {
            "role": role,
            "total_patients": 0,
            "total_doctors": 0,
            "total_appointments": 0,
            "total_prescriptions": 0,
            "appointment_status": [],
            "appointment_types": [],
            "prescription_status": [],
            "recent_appointments": []
        }

        # ==========================================
        # 1. THỐNG KÊ BỆNH NHÂN
        # ==========================================

        if role in ("Admin", "Receptionist"):
            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM benh_nhan
            """)

        elif role == "Doctor":
            cursor.execute("""
                SELECT COUNT(DISTINCT lh.ma_benh_nhan) AS total
                FROM lich_hen_kham AS lh
                WHERE lh.ma_bac_si = %s
            """, (doctor_id,))

        elif role == "Patient":
            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM benh_nhan
                WHERE ma_benh_nhan = %s
            """, (patient_id,))

        elif role == "Pharmacist":
            cursor.execute("SELECT 0 AS total")

        statistics["total_patients"] = cursor.fetchone()["total"]

        # ==========================================
        # 2. THỐNG KÊ BÁC SĨ
        # ==========================================

        if role in ("Admin", "Receptionist"):
            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM bac_si
            """)

        elif role == "Doctor":
            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM bac_si
                WHERE ma_bac_si = %s
            """, (doctor_id,))

        elif role == "Patient":
            cursor.execute("""
                SELECT COUNT(DISTINCT lh.ma_bac_si) AS total
                FROM lich_hen_kham AS lh
                WHERE lh.ma_benh_nhan = %s
            """, (patient_id,))

        elif role == "Pharmacist":
            cursor.execute("SELECT 0 AS total")

        statistics["total_doctors"] = cursor.fetchone()["total"]

        # ==========================================
        # 3. THỐNG KÊ LỊCH HẸN
        # ==========================================

        appointment_condition = ""
        appointment_params = []

        if role == "Doctor":
            appointment_condition = "WHERE lh.ma_bac_si = %s"
            appointment_params.append(doctor_id)

        elif role == "Patient":
            appointment_condition = "WHERE lh.ma_benh_nhan = %s"
            appointment_params.append(patient_id)

        elif role == "Pharmacist":
            appointment_condition = "WHERE 1 = 0"

        cursor.execute(f"""
            SELECT COUNT(*) AS total
            FROM lich_hen_kham AS lh
            {appointment_condition}
        """, tuple(appointment_params))

        statistics["total_appointments"] = cursor.fetchone()["total"]

        # Thống kê trạng thái lịch hẹn
        cursor.execute(f"""
            SELECT
                lh.trang_thai,
                COUNT(*) AS total
            FROM lich_hen_kham AS lh
            {appointment_condition}
            GROUP BY lh.trang_thai
        """, tuple(appointment_params))

        statistics["appointment_status"] = cursor.fetchall()

        # Thống kê loại hình khám
        cursor.execute(f"""
            SELECT
                lh.loai_hinh_kham,
                COUNT(*) AS total
            FROM lich_hen_kham AS lh
            {appointment_condition}
            GROUP BY lh.loai_hinh_kham
        """, tuple(appointment_params))

        statistics["appointment_types"] = cursor.fetchall()

        # ==========================================
        # 4. THỐNG KÊ ĐƠN THUỐC
        # ==========================================

        prescription_condition = ""
        prescription_params = []

        if role == "Doctor":
            prescription_condition = """
                WHERE EXISTS (
                    SELECT 1
                    FROM ho_so_benh_an AS hs
                    JOIN lich_hen_kham AS lh
                        ON lh.ma_lich_hen = hs.ma_lich_hen
                    WHERE hs.ma_ho_so = dt.ma_ho_so
                      AND lh.ma_bac_si = %s
                )
            """
            prescription_params.append(doctor_id)

        elif role == "Patient":
            prescription_condition = """
                JOIN ho_so_benh_an AS hs
                    ON hs.ma_ho_so = dt.ma_ho_so
                WHERE hs.ma_benh_nhan = %s
            """
            prescription_params.append(patient_id)

        elif role == "Receptionist":
            prescription_condition = "WHERE 1 = 0"

        # Admin và Pharmacist được xem toàn bộ đơn thuốc
        cursor.execute(f"""
            SELECT COUNT(*) AS total
            FROM don_thuoc AS dt
            {prescription_condition}
        """, tuple(prescription_params))

        statistics["total_prescriptions"] = cursor.fetchone()["total"]

        cursor.execute(f"""
            SELECT
                dt.trang_thai,
                COUNT(*) AS total
            FROM don_thuoc AS dt
            {prescription_condition}
            GROUP BY dt.trang_thai
        """, tuple(prescription_params))

        statistics["prescription_status"] = cursor.fetchall()

        # ==========================================
        # 5. LỊCH HẸN GẦN ĐÂY
        # ==========================================

        if role != "Pharmacist":
            cursor.execute(f"""
                SELECT
                    lh.ma_lich_hen,
                    bn.ho_va_ten AS ten_benh_nhan,
                    bs.ho_va_ten AS ten_bac_si,
                    lh.thoi_gian_hen,
                    lh.loai_hinh_kham,
                    lh.trang_thai
                FROM lich_hen_kham AS lh
                JOIN benh_nhan AS bn
                    ON bn.ma_benh_nhan = lh.ma_benh_nhan
                JOIN bac_si AS bs
                    ON bs.ma_bac_si = lh.ma_bac_si
                {appointment_condition}
                ORDER BY lh.thoi_gian_hen DESC
                LIMIT 10
            """, tuple(appointment_params))

            recent_appointments = cursor.fetchall()

            for appointment in recent_appointments:
                appointment["thoi_gian_hen"] = format_datetime(
                    appointment["thoi_gian_hen"]
                )

            statistics["recent_appointments"] = recent_appointments

        return statistics

    finally:
        cursor.close()
        connection.close()
