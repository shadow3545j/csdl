
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
    lh.ma_bac_si,
    bs.ho_va_ten AS ten_bac_si,
    dt.thoi_gian_ke,
    dt.trang_thai
FROM don_thuoc AS dt
JOIN ho_so_benh_an AS hs
    ON hs.ma_ho_so = dt.ma_ho_so
JOIN benh_nhan AS bn
    ON bn.ma_benh_nhan = hs.ma_benh_nhan
LEFT JOIN lich_hen_kham AS lh
    ON lh.ma_lich_hen = hs.ma_lich_hen
LEFT JOIN bac_si AS bs
    ON bs.ma_bac_si = lh.ma_bac_si
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
        lh.ma_bac_si,
        bs.ho_va_ten AS ten_bac_si,
        dt.thoi_gian_ke,
        dt.trang_thai
    FROM don_thuoc AS dt
    JOIN ho_so_benh_an AS hs
        ON hs.ma_ho_so = dt.ma_ho_so
    JOIN benh_nhan AS bn
        ON bn.ma_benh_nhan = hs.ma_benh_nhan
    LEFT JOIN lich_hen_kham AS lh
        ON lh.ma_lich_hen = hs.ma_lich_hen
    LEFT JOIN bac_si AS bs
        ON bs.ma_bac_si = lh.ma_bac_si
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
# ==========================================
# 4. DỮ LIỆU FORM KÊ ĐƠN VÀ TẠO ĐƠN THUỐC
# ==========================================

def get_prescription_form_options(doctor_id):
    """
    Lấy hồ sơ bệnh án thuộc bác sĩ đăng nhập
    và danh mục thuốc để hiển thị trên form kê đơn.
    """

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                hs.ma_ho_so,
                hs.ma_benh_nhan,
                bn.ho_va_ten,
                hs.chan_doan
            FROM ho_so_benh_an hs
            JOIN benh_nhan bn
                ON bn.ma_benh_nhan = hs.ma_benh_nhan
            JOIN lich_hen_kham lh
                ON lh.ma_lich_hen = hs.ma_lich_hen
            WHERE lh.ma_bac_si = %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM don_thuoc dt
                  WHERE dt.ma_ho_so = hs.ma_ho_so
              )
            ORDER BY hs.ma_ho_so DESC
        """, (doctor_id,))

        records = cursor.fetchall()

        cursor.execute("""
            SELECT
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            FROM danh_muc_thuoc
            ORDER BY ten_biet_duoc
        """)

        medicines = cursor.fetchall()

        return {
            "ho_so": records,
            "thuoc": medicines
        }

    finally:
        cursor.close()
        connection.close()


def _generate_next_code(cursor, table_name, column_name, prefix):
    """
    Sinh mã tiếp theo theo định dạng:
    DT001, DT002...
    CTDT001, CTDT002...
    """

    # Chỉ sử dụng các tên bảng/cột cố định bên dưới.
    cursor.execute(f"""
        SELECT COALESCE(
            MAX(
                CAST(
                    SUBSTRING({column_name}, %s)
                    AS UNSIGNED
                )
            ),
            0
        ) AS max_no
        FROM {table_name}
        WHERE {column_name} REGEXP %s
    """, (
        len(prefix) + 1,
        f"^{prefix}[0-9]+$"
    ))

    row = cursor.fetchone()

    next_no = int(row["max_no"] or 0) + 1

    return f"{prefix}{next_no:03d}"


def create_prescription(data, doctor_id):
    """
    Tạo đơn thuốc và nhiều chi tiết đơn thuốc
    trong cùng một transaction.
    """

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        record_id = str(
            data.get("ma_ho_so") or ""
        ).strip()

        details = data.get("chi_tiet")

        if not record_id:
            raise ValueError("Vui lòng chọn hồ sơ bệnh án.")

        if not isinstance(details, list) or not details:
            raise ValueError("Vui lòng thêm ít nhất một thuốc.")

        # Kiểm tra hồ sơ thuộc bác sĩ đăng nhập.
        # Đồng thời khóa dòng hồ sơ trong transaction.
        cursor.execute("""
            SELECT hs.ma_ho_so
            FROM ho_so_benh_an hs
            JOIN lich_hen_kham lh
                ON lh.ma_lich_hen = hs.ma_lich_hen
            WHERE hs.ma_ho_so = %s
              AND lh.ma_bac_si = %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM don_thuoc dt
                  WHERE dt.ma_ho_so = hs.ma_ho_so
              )
            FOR UPDATE
        """, (record_id, doctor_id))

        if cursor.fetchone() is None:
            raise ValueError(
                "Hồ sơ không tồn tại, không thuộc bác sĩ "
                "hoặc đã có đơn thuốc."
            )

        normalized = []
        seen_medicines = set()

        # Kiểm tra dữ liệu từng thuốc.
        for item in details:

            if not isinstance(item, dict):
                raise ValueError("Chi tiết thuốc không hợp lệ.")

            medicine_id = str(
                item.get("ma_thuoc") or ""
            ).strip()

            dose = str(
                item.get("lieu_dung") or ""
            ).strip()

            route = str(
                item.get("duong_dung") or ""
            ).strip()

            quantity_raw = item.get("so_luong")

            try:
                quantity = int(quantity_raw)
            except (TypeError, ValueError):
                raise ValueError(
                    "Số lượng thuốc phải là số nguyên dương."
                )

            if (
                not medicine_id
                or not dose
                or not route
                or quantity <= 0
            ):
                raise ValueError(
                    "Vui lòng nhập đầy đủ thuốc, số lượng, "
                    "liều dùng và đường dùng."
                )

            if len(dose) > 100:
                raise ValueError(
                    "Liều dùng không được vượt quá 100 ký tự."
                )

            if len(route) > 50:
                raise ValueError(
                    "Đường dùng không được vượt quá 50 ký tự."
                )

            if medicine_id in seen_medicines:
                raise ValueError(
                    "Một thuốc chỉ được thêm một lần trong cùng đơn."
                )

            seen_medicines.add(medicine_id)

            normalized.append((
                medicine_id,
                quantity,
                dose,
                route
            ))

        # Kiểm tra thuốc có tồn tại trong danh mục.
        for medicine_id, _, _, _ in normalized:

            cursor.execute("""
                SELECT ma_thuoc
                FROM danh_muc_thuoc
                WHERE ma_thuoc = %s
            """, (medicine_id,))

            if cursor.fetchone() is None:
                raise ValueError(
                    f"Không tìm thấy thuốc có mã {medicine_id}."
                )

        # Sinh mã đơn thuốc.
        prescription_id = _generate_next_code(
            cursor,
            "don_thuoc",
            "ma_don_thuoc",
            "DT"
        )

        # Tạo đơn thuốc.
        cursor.execute("""
            INSERT INTO don_thuoc (
                ma_don_thuoc,
                ma_ho_so,
                trang_thai
            )
            VALUES (%s, %s, 'Active')
        """, (
            prescription_id,
            record_id
        ))

        # Thêm các thuốc vào chi tiết đơn.
        for medicine_id, quantity, dose, route in normalized:

            detail_id = _generate_next_code(
                cursor,
                "chi_tiet_don_thuoc",
                "ma_chi_tiet",
                "CTDT"
            )

            cursor.execute("""
                INSERT INTO chi_tiet_don_thuoc (
                    ma_chi_tiet,
                    ma_don_thuoc,
                    ma_thuoc,
                    so_luong,
                    lieu_dung,
                    duong_dung
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                detail_id,
                prescription_id,
                medicine_id,
                quantity,
                dose,
                route
            ))

        connection.commit()

        return prescription_id

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()