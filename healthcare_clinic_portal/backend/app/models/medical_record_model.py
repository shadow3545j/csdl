
from app.database.connection import get_db_connection


# ==========================================
# HELPER: BUILD RECORD ACCESS CONDITION
# ==========================================

def _add_record_scope(query, params, doctor_id=None, patient_id=None):
    """
    Giới hạn hồ sơ theo bác sĩ hoặc bệnh nhân.
    Doctor: chỉ hồ sơ thuộc lịch hẹn của bác sĩ.
    Patient: chỉ hồ sơ của chính bệnh nhân.
    """
    if doctor_id:
        query += """
            AND EXISTS (
                SELECT 1
                FROM lich_hen_kham lh
                WHERE lh.ma_lich_hen = hs.ma_lich_hen
                  AND lh.ma_bac_si = %s
            )
        """
        params.append(doctor_id)

    if patient_id:
        query += " AND hs.ma_benh_nhan = %s"
        params.append(patient_id)

    return query, params


# ==========================================
# GET ALL MEDICAL RECORDS
# ==========================================

def get_all_medical_records(
    status=None,
    patient_id=None,
    doctor_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                hs.ma_ho_so,
                hs.ma_benh_nhan,
                bn.ho_va_ten,
                hs.ma_lich_hen,
                hs.ma_benh,
                hs.trieu_chung,
                hs.chan_doan,
                hs.trang_thai
            FROM ho_so_benh_an hs
            JOIN benh_nhan bn
                ON hs.ma_benh_nhan = bn.ma_benh_nhan
            WHERE 1 = 1
        """

        params = []

        if status:
            query += " AND hs.trang_thai = %s"
            params.append(status)

        query, params = _add_record_scope(
            query, params, doctor_id, patient_id
        )

        query += " ORDER BY hs.ma_ho_so DESC"

        cursor.execute(query, tuple(params))
        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# GET MEDICAL RECORD BY ID
# ==========================================

def get_medical_record_by_id(
    record_id,
    doctor_id=None,
    patient_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                hs.ma_ho_so,
                hs.ma_benh_nhan,
                bn.ho_va_ten,
                hs.ma_lich_hen,
                hs.ma_benh,
                hs.trieu_chung,
                hs.chan_doan,
                hs.trang_thai
            FROM ho_so_benh_an hs
            JOIN benh_nhan bn
                ON hs.ma_benh_nhan = bn.ma_benh_nhan
            WHERE hs.ma_ho_so = %s
        """

        params = [record_id]

        query, params = _add_record_scope(
            query, params, doctor_id, patient_id
        )

        cursor.execute(query, tuple(params))
        record = cursor.fetchone()

        if record is None:
            return None

        attachment_query = """
            SELECT
                ma_phu_luc,
                ma_ho_so,
                ly_do_dinh_chinh,
                noi_dung
            FROM phu_luc_dinh_chinh_benh_an
            WHERE ma_ho_so = %s
            ORDER BY ma_phu_luc
        """

        cursor.execute(attachment_query, (record_id,))
        record["phu_luc_dinh_chinh"] = cursor.fetchall()

        return record

    finally:
        cursor.close()
        connection.close()


# ==========================================
# GET FORM OPTIONS
# ==========================================

def get_medical_record_form_options(doctor_id=None):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        if doctor_id:
            patient_query = """
                SELECT DISTINCT
                    bn.ma_benh_nhan,
                    bn.ho_va_ten
                FROM benh_nhan bn
                JOIN lich_hen_kham lh
                    ON bn.ma_benh_nhan = lh.ma_benh_nhan
                WHERE lh.ma_bac_si = %s
                  AND lh.trang_thai = 'In-Consultation'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ho_so_benh_an hs
                      WHERE hs.ma_lich_hen = lh.ma_lich_hen
                  )
                ORDER BY bn.ho_va_ten
            """
            cursor.execute(patient_query, (doctor_id,))
        else:
            patient_query = """
                SELECT
                    ma_benh_nhan,
                    ho_va_ten
                FROM benh_nhan
                ORDER BY ho_va_ten
            """
            cursor.execute(patient_query)

        patients = cursor.fetchall()

        appointment_query = """
            SELECT
                lh.ma_lich_hen,
                lh.ma_benh_nhan,
                bn.ho_va_ten,
                lh.ma_bac_si,
                bs.ho_va_ten AS ten_bac_si,
                lh.thoi_gian_hen,
                lh.trang_thai
            FROM lich_hen_kham lh
            JOIN benh_nhan bn
                ON lh.ma_benh_nhan = bn.ma_benh_nhan
            JOIN bac_si bs
                ON lh.ma_bac_si = bs.ma_bac_si
            WHERE lh.trang_thai = 'In-Consultation'
              AND NOT EXISTS (
                  SELECT 1
                  FROM ho_so_benh_an hs
                  WHERE hs.ma_lich_hen = lh.ma_lich_hen
              )
        """

        params = []

        if doctor_id:
            appointment_query += " AND lh.ma_bac_si = %s"
            params.append(doctor_id)

        appointment_query += " ORDER BY lh.thoi_gian_hen DESC"

        cursor.execute(appointment_query, tuple(params))
        appointments = cursor.fetchall()

        return {
            "patients": patients,
            "appointments": appointments
        }

    finally:
        cursor.close()
        connection.close()


# ==========================================
# CREATE MEDICAL RECORD
# ==========================================

def create_medical_record(data, doctor_id=None):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        if doctor_id:
            query = """
                INSERT INTO ho_so_benh_an (
                    ma_ho_so,
                    ma_benh_nhan,
                    ma_lich_hen,
                    ma_benh,
                    trieu_chung,
                    chan_doan,
                    trang_thai
                )
                SELECT
                    %s, %s, lh.ma_lich_hen,
                    %s, %s, %s, %s
                FROM lich_hen_kham lh
                WHERE lh.ma_lich_hen = %s
                  AND lh.ma_benh_nhan = %s
                  AND lh.ma_bac_si = %s
                  AND lh.trang_thai = 'In-Consultation'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ho_so_benh_an hs
                      WHERE hs.ma_lich_hen = lh.ma_lich_hen
                  )
            """

            values = (
                data["ma_ho_so"],
                data["ma_benh_nhan"],
                data.get("ma_benh"),
                data.get("trieu_chung"),
                data.get("chan_doan"),
                data.get("trang_thai", "Draft"),
                data["ma_lich_hen"],
                data["ma_benh_nhan"],
                doctor_id
            )

            cursor.execute(query, values)

            if cursor.rowcount == 0:
                connection.rollback()
                return None

        else:
            query = """
                INSERT INTO ho_so_benh_an (
                    ma_ho_so,
                    ma_benh_nhan,
                    ma_lich_hen,
                    ma_benh,
                    trieu_chung,
                    chan_doan,
                    trang_thai
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """

            values = (
                data["ma_ho_so"],
                data["ma_benh_nhan"],
                data["ma_lich_hen"],
                data.get("ma_benh"),
                data.get("trieu_chung"),
                data.get("chan_doan"),
                data.get("trang_thai", "Draft")
            )

            cursor.execute(query, values)

        connection.commit()
        record_id = data["ma_ho_so"]

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()

    return get_medical_record_by_id(
        record_id,
        doctor_id=doctor_id
    )


# ==========================================
# UPDATE MEDICAL RECORD
# ==========================================


def update_medical_record(record_id, data, doctor_id=None):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        # Chỉ cập nhật những trường được gửi lên
        allowed_fields = [
            "ma_benh",
            "trieu_chung",
            "chan_doan",
            "trang_thai"
        ]

        update_fields = []
        values = []

        for field in allowed_fields:
            if field in data:
                update_fields.append(f"hs.{field} = %s")
                values.append(data[field])

        # Không có trường hợp lệ để cập nhật
        if not update_fields:
            return get_medical_record_by_id(
                record_id,
                doctor_id=doctor_id
            )

        query = f"""
            UPDATE ho_so_benh_an hs
            SET {", ".join(update_fields)}
            WHERE hs.ma_ho_so = %s
        """
        query += """
            AND hs.trang_thai = 'Draft'
        """
        values.append(record_id)

        # Giới hạn bác sĩ chỉ sửa hồ sơ thuộc lịch hẹn của mình
        if doctor_id:
            query += """
                AND EXISTS (
                    SELECT 1
                    FROM lich_hen_kham lh
                    WHERE lh.ma_lich_hen = hs.ma_lich_hen
                      AND lh.ma_bac_si = %s
                )
            """
            values.append(doctor_id)

        cursor.execute(query, tuple(values))

        if cursor.rowcount == 0:
            connection.rollback()
            return None

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()

    return get_medical_record_by_id(
        record_id,
        doctor_id=doctor_id
    )



# ==========================================
# DELETE MEDICAL RECORD
# ==========================================

def delete_medical_record(record_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        query = """
            DELETE FROM ho_so_benh_an
            WHERE ma_ho_so = %s
        """

        cursor.execute(query, (record_id,))

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


# ==========================================
# GET ALL CORRECTION ATTACHMENTS
# ==========================================

def get_medical_record_attachments(
    record_id,
    doctor_id=None,
    patient_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                pl.ma_phu_luc,
                pl.ma_ho_so,
                pl.ly_do_dinh_chinh,
                pl.noi_dung
            FROM phu_luc_dinh_chinh_benh_an pl
            JOIN ho_so_benh_an hs
                ON pl.ma_ho_so = hs.ma_ho_so
            WHERE pl.ma_ho_so = %s
        """

        params = [record_id]

        query, params = _add_record_scope(
            query, params, doctor_id, patient_id
        )

        query += " ORDER BY pl.ma_phu_luc"

        cursor.execute(query, tuple(params))
        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# GET CORRECTION ATTACHMENT BY ID
# ==========================================

def get_medical_record_attachment_by_id(
    attachment_id,
    doctor_id=None,
    patient_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = """
            SELECT
                pl.ma_phu_luc,
                pl.ma_ho_so,
                pl.ly_do_dinh_chinh,
                pl.noi_dung
            FROM phu_luc_dinh_chinh_benh_an pl
            JOIN ho_so_benh_an hs
                ON pl.ma_ho_so = hs.ma_ho_so
            WHERE pl.ma_phu_luc = %s
        """

        params = [attachment_id]

        query, params = _add_record_scope(
            query, params, doctor_id, patient_id
        )

        cursor.execute(query, tuple(params))
        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# ==========================================
# CREATE CORRECTION ATTACHMENT
# ==========================================

def create_medical_record_attachment(data, doctor_id=None):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        if doctor_id:
            query = """
                INSERT INTO phu_luc_dinh_chinh_benh_an (
                    ma_phu_luc,
                    ma_ho_so,
                    ly_do_dinh_chinh,
                    noi_dung
                )
                SELECT %s, hs.ma_ho_so, %s, %s
                FROM ho_so_benh_an hs
                JOIN lich_hen_kham lh
                    ON hs.ma_lich_hen = lh.ma_lich_hen
                WHERE hs.ma_ho_so = %s
                  AND lh.ma_bac_si = %s
            """

            values = (
                data["ma_phu_luc"],
                data["ly_do_dinh_chinh"],
                data["noi_dung"],
                data["ma_ho_so"],
                doctor_id
            )

        else:
            query = """
                INSERT INTO phu_luc_dinh_chinh_benh_an (
                    ma_phu_luc,
                    ma_ho_so,
                    ly_do_dinh_chinh,
                    noi_dung
                )
                VALUES (%s, %s, %s, %s)
            """

            values = (
                data["ma_phu_luc"],
                data["ma_ho_so"],
                data["ly_do_dinh_chinh"],
                data["noi_dung"]
            )

        cursor.execute(query, values)

        if cursor.rowcount == 0:
            connection.rollback()
            return None

        connection.commit()
        attachment_id = data["ma_phu_luc"]

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()

    return get_medical_record_attachment_by_id(
        attachment_id,
        doctor_id=doctor_id
    )


# ==========================================
# UPDATE CORRECTION ATTACHMENT
# ==========================================

def update_medical_record_attachment(
    attachment_id,
    data,
    doctor_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        allowed_fields = [
            "ly_do_dinh_chinh",
            "noi_dung"
        ]

        update_fields = []
        values = []

        for field in allowed_fields:
            if field in data:
                update_fields.append(f"pl.{field} = %s")
                values.append(data[field])

        if not update_fields:
            return get_medical_record_attachment_by_id(
                attachment_id,
                doctor_id=doctor_id
            )

        query = f"""
            UPDATE phu_luc_dinh_chinh_benh_an pl
            JOIN ho_so_benh_an hs
                ON pl.ma_ho_so = hs.ma_ho_so
            SET {", ".join(update_fields)}
            WHERE pl.ma_phu_luc = %s
        """

        values.append(attachment_id)

        if doctor_id:
            query += """
                AND EXISTS (
                    SELECT 1
                    FROM lich_hen_kham lh
                    WHERE lh.ma_lich_hen = hs.ma_lich_hen
                      AND lh.ma_bac_si = %s
                )
            """
            values.append(doctor_id)

        cursor.execute(query, tuple(values))

        if cursor.rowcount == 0:
            connection.rollback()
            return None

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()

    return get_medical_record_attachment_by_id(
        attachment_id,
        doctor_id=doctor_id
    )



# ==========================================
# DELETE CORRECTION ATTACHMENT
# ==========================================

def delete_medical_record_attachment(attachment_id):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        query = """
            DELETE FROM phu_luc_dinh_chinh_benh_an
            WHERE ma_phu_luc = %s
        """

        cursor.execute(query, (attachment_id,))

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
