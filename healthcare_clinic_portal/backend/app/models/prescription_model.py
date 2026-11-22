
from app.database.connection import get_db_connection


def format_datetime(value):
    """
    Chuyển MySQL DATETIME thành chuỗi thuần,
    tránh Flask tự chuyển sang GMT.
    """
    if value is None:
        return None

    return value.strftime("%Y-%m-%d %H:%M:%S")


def get_all_prescriptions(
    status=None,
    patient_id=None,
    doctor_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                dt.ma_don_thuoc,
                dt.ma_ho_so,
                hs.ma_benh_nhan,
                bn.ho_va_ten,
                dt.thoi_gian_ke,
                dt.trang_thai
            FROM don_thuoc AS dt
            JOIN ho_so_benh_an AS hs
                ON hs.ma_ho_so = dt.ma_ho_so
            JOIN benh_nhan AS bn
                ON bn.ma_benh_nhan = hs.ma_benh_nhan
            WHERE 1 = 1
        """

        params = []

        if status:
            query += " AND dt.trang_thai = %s"
            params.append(status)

        # Giới hạn theo bệnh nhân
        if patient_id:
            query += " AND hs.ma_benh_nhan = %s"
            params.append(patient_id)

        # Giới hạn theo bác sĩ phụ trách lịch hẹn
        if doctor_id:
            query += """
                AND EXISTS (
                    SELECT 1
                    FROM lich_hen_kham AS lh
                    WHERE lh.ma_lich_hen = hs.ma_lich_hen
                      AND lh.ma_bac_si = %s
                )
            """
            params.append(doctor_id)

        query += " ORDER BY dt.thoi_gian_ke DESC"

        cursor.execute(query, tuple(params))

        prescriptions = cursor.fetchall()

        for prescription in prescriptions:
            prescription["thoi_gian_ke"] = format_datetime(
                prescription["thoi_gian_ke"]
            )

        return prescriptions

    finally:
        cursor.close()
        connection.close()


def get_prescription_by_id(
    prescription_id,
    patient_id=None,
    doctor_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                dt.ma_don_thuoc,
                dt.ma_ho_so,
                hs.ma_benh_nhan,
                bn.ho_va_ten,
                dt.thoi_gian_ke,
                dt.trang_thai
            FROM don_thuoc AS dt
            JOIN ho_so_benh_an AS hs
                ON hs.ma_ho_so = dt.ma_ho_so
            JOIN benh_nhan AS bn
                ON bn.ma_benh_nhan = hs.ma_benh_nhan
            WHERE dt.ma_don_thuoc = %s
        """

        params = [prescription_id]

        # Giới hạn theo bệnh nhân
        if patient_id:
            query += " AND hs.ma_benh_nhan = %s"
            params.append(patient_id)

        # Giới hạn theo bác sĩ phụ trách lịch hẹn
        if doctor_id:
            query += """
                AND EXISTS (
                    SELECT 1
                    FROM lich_hen_kham AS lh
                    WHERE lh.ma_lich_hen = hs.ma_lich_hen
                      AND lh.ma_bac_si = %s
                )
            """
            params.append(doctor_id)

        cursor.execute(query, tuple(params))

        prescription = cursor.fetchone()

        if prescription is None:
            return None

        prescription["thoi_gian_ke"] = format_datetime(
            prescription["thoi_gian_ke"]
        )

        cursor.execute(
            """
            SELECT
                ct.ma_chi_tiet,
                ct.ma_thuoc,
                dm.ten_biet_duoc,
                dm.hoat_chat,
                dm.so_luong_ton,
                ct.so_luong,
                ct.lieu_dung,
                ct.duong_dung
            FROM chi_tiet_don_thuoc AS ct
            JOIN danh_muc_thuoc AS dm
                ON dm.ma_thuoc = ct.ma_thuoc
            WHERE ct.ma_don_thuoc = %s
            ORDER BY ct.ma_chi_tiet
            """,
            (prescription_id,)
        )

        prescription["chi_tiet"] = cursor.fetchall()

        return prescription

    finally:
        cursor.close()
        connection.close()


def dispense_prescription(prescription_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.callproc(
            "sp_cap_phat_thuoc",
            (prescription_id,)
        )

        connection.commit()
        return True

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
