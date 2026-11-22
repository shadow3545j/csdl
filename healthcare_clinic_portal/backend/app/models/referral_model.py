
import secrets
from datetime import datetime

from app.database.connection import get_db_connection


# =========================================================
# 1. TẠO MÃ PHIẾU CHUYỂN TUYẾN
# =========================================================

def generate_referral_id(cursor):
    """
    Sinh mã phiếu chuyển tuyến.
    Ví dụ: CT2611211530451234
    """

    for _ in range(20):
        referral_id = (
            "CT"
            + datetime.now().strftime("%y%m%d%H%M%S")
            + str(secrets.randbelow(10000)).zfill(4)
        )

        cursor.execute("""
            SELECT ma_chuyen_tuyen
            FROM phieu_chuyen_tuyen
            WHERE ma_chuyen_tuyen = %s
        """, (referral_id,))

        if cursor.fetchone() is None:
            return referral_id

    raise RuntimeError(
        "Không thể tạo mã phiếu chuyển tuyến duy nhất."
    )


# =========================================================
# 2. CÂU TRUY VẤN CHI TIẾT PHIẾU
# =========================================================

REFERRAL_SELECT = """
    SELECT
        p.ma_chuyen_tuyen,
        p.ma_lich_hen,
        lh.ma_benh_nhan,
        bn.ho_va_ten AS ten_benh_nhan,

        p.ma_bac_si_gp,
        gp.ho_va_ten AS ten_bac_si_gp,

        p.ma_chuyen_khoa,
        ck.ten_chuyen_khoa,

        p.ma_bac_si_nhan,
        bs.ho_va_ten AS ten_bac_si_nhan,

        p.ly_do_chuyen,
        p.trang_thai,

        lh.thoi_gian_hen,
        lh.loai_hinh_kham,
        lh.trang_thai AS trang_thai_lich_hen

    FROM phieu_chuyen_tuyen p

    INNER JOIN lich_hen_kham lh
        ON lh.ma_lich_hen = p.ma_lich_hen

    INNER JOIN benh_nhan bn
        ON bn.ma_benh_nhan = lh.ma_benh_nhan

    INNER JOIN bac_si gp
        ON gp.ma_bac_si = p.ma_bac_si_gp

    INNER JOIN chuyen_khoa ck
        ON ck.ma_chuyen_khoa = p.ma_chuyen_khoa

    LEFT JOIN bac_si bs
        ON bs.ma_bac_si = p.ma_bac_si_nhan
"""


# =========================================================
# 3. HÀM LẤY CHI TIẾT BẰNG CURSOR HIỆN TẠI
# =========================================================

def _get_referral_with_cursor(cursor, referral_id):
    """
    Lấy phiếu bằng cursor hiện tại.

    Dùng trong transaction để tránh tình trạng:
    - Dữ liệu đã commit thành công.
    - Nhưng truy vấn lại bằng kết nối mới bị lỗi.
    """

    cursor.execute(
        REFERRAL_SELECT + """
            WHERE p.ma_chuyen_tuyen = %s
        """,
        (referral_id,)
    )

    return cursor.fetchone()


# =========================================================
# 4. LẤY DANH SÁCH PHIẾU CHUYỂN TUYẾN
# =========================================================

def get_all_referrals(
    doctor_id=None,
    patient_id=None
):
    """
    Admin / Receptionist:
        Lấy toàn bộ phiếu.

    Doctor:
        Chỉ lấy phiếu do mình chuyển hoặc được chuyển đến.

    Patient:
        Chỉ lấy phiếu thuộc lịch hẹn của mình.
    """

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = REFERRAL_SELECT

        conditions = []
        params = []

        if doctor_id is not None:
            conditions.append("""
                (
                    p.ma_bac_si_gp = %s
                    OR p.ma_bac_si_nhan = %s
                )
            """)
            params.extend([
                doctor_id,
                doctor_id
            ])

        if patient_id is not None:
            conditions.append(
                "lh.ma_benh_nhan = %s"
            )
            params.append(patient_id)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += """
            ORDER BY
                CASE p.trang_thai
                    WHEN 'Pending' THEN 1
                    WHEN 'Accepted' THEN 2
                    WHEN 'Completed' THEN 3
                    ELSE 4
                END,
                lh.thoi_gian_hen DESC
        """

        cursor.execute(query, tuple(params))

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 5. LẤY CHI TIẾT PHIẾU CHUYỂN TUYẾN
# =========================================================

def get_referral_by_id(
    referral_id,
    doctor_id=None,
    patient_id=None
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        query = REFERRAL_SELECT + """
            WHERE p.ma_chuyen_tuyen = %s
        """

        params = [referral_id]

        if doctor_id is not None:
            query += """
                AND (
                    p.ma_bac_si_gp = %s
                    OR p.ma_bac_si_nhan = %s
                )
            """

            params.extend([
                doctor_id,
                doctor_id
            ])

        if patient_id is not None:
            query += """
                AND lh.ma_benh_nhan = %s
            """

            params.append(patient_id)

        cursor.execute(query, tuple(params))

        return cursor.fetchone()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 6. LẤY DỮ LIỆU CHO FORM TẠO PHIẾU
# =========================================================

def get_referral_form_options(doctor_id):
    """
    Chỉ lấy lịch hẹn:
    - Được phân công cho bác sĩ GP đang đăng nhập.
    - Đang ở trạng thái In-Consultation.
    - Chưa có phiếu chuyển tuyến.
    """

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # Kiểm tra bác sĩ có đúng là GP không.
        cursor.execute("""
            SELECT
                bs.ma_bac_si,
                bs.ho_va_ten

            FROM bac_si bs

            INNER JOIN bac_si_da_khoa gp
                ON gp.ma_bac_si = bs.ma_bac_si

            WHERE bs.ma_bac_si = %s
              AND bs.loai_bac_si = 'GP'
        """, (doctor_id,))

        doctor = cursor.fetchone()

        if not doctor:
            raise ValueError(
                "Chỉ bác sĩ đa khoa mới được tạo phiếu chuyển tuyến."
            )

        # Lịch hẹn đủ điều kiện chuyển tuyến.
        cursor.execute("""
            SELECT
                lh.ma_lich_hen,
                lh.ma_benh_nhan,
                bn.ho_va_ten AS ten_benh_nhan,
                lh.thoi_gian_hen,
                lh.loai_hinh_kham,
                lh.trang_thai

            FROM lich_hen_kham lh

            INNER JOIN benh_nhan bn
                ON bn.ma_benh_nhan = lh.ma_benh_nhan

            LEFT JOIN phieu_chuyen_tuyen p
                ON p.ma_lich_hen = lh.ma_lich_hen

            WHERE lh.ma_bac_si = %s
              AND lh.trang_thai = 'In-Consultation'
              AND p.ma_chuyen_tuyen IS NULL

            ORDER BY lh.thoi_gian_hen DESC
        """, (doctor_id,))

        appointments = cursor.fetchall()

        # Danh sách chuyên khoa.
        cursor.execute("""
            SELECT
                ma_chuyen_khoa,
                ma_dinh_danh,
                ten_chuyen_khoa

            FROM chuyen_khoa

            ORDER BY ten_chuyen_khoa
        """)

        specialties = cursor.fetchall()

        return {
            "doctor": doctor,
            "appointments": appointments,
            "specialties": specialties
        }

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 7. LẤY BÁC SĨ THEO CHUYÊN KHOA
# =========================================================

def get_specialists_by_specialty(specialty_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                bs.ma_bac_si,
                bs.ho_va_ten,
                bs.thu_dien_tu,
                bs.so_dien_thoai,

                sp.ma_chuyen_khoa,
                sp.so_chung_nhan,
                sp.phi_kham,

                ck.ten_chuyen_khoa

            FROM bac_si_chuyen_khoa sp

            INNER JOIN bac_si bs
                ON bs.ma_bac_si = sp.ma_bac_si

            INNER JOIN chuyen_khoa ck
                ON ck.ma_chuyen_khoa = sp.ma_chuyen_khoa

            WHERE sp.ma_chuyen_khoa = %s
              AND bs.loai_bac_si = 'Specialist'

            ORDER BY bs.ho_va_ten
        """, (specialty_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 8. TẠO PHIẾU CHUYỂN TUYẾN
# =========================================================

def create_referral(data, doctor_id):
    """
    Tạo phiếu chuyển tuyến và cập nhật lịch hẹn
    trong cùng một transaction.

    Điều kiện:
    - Người tạo phải là bác sĩ GP.
    - Lịch hẹn phải thuộc bác sĩ GP đang đăng nhập.
    - Lịch hẹn phải ở trạng thái In-Consultation.
    - Lịch hẹn chưa có phiếu chuyển tuyến.
    - Bác sĩ nhận phải thuộc đúng chuyên khoa.
    """

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()

        appointment_id = data["ma_lich_hen"]
        specialty_id = data["ma_chuyen_khoa"]
        recipient_id = data["ma_bac_si_nhan"]
        reason = data["ly_do_chuyen"]

        # -------------------------------------------------
        # 8.1. Khóa lịch hẹn và xác nhận GP
        # -------------------------------------------------

        cursor.execute("""
            SELECT
                lh.ma_lich_hen,
                lh.ma_bac_si,
                lh.trang_thai

            FROM lich_hen_kham lh

            INNER JOIN bac_si_da_khoa gp
                ON gp.ma_bac_si = lh.ma_bac_si

            INNER JOIN bac_si bs
                ON bs.ma_bac_si = gp.ma_bac_si

            WHERE lh.ma_lich_hen = %s
              AND lh.ma_bac_si = %s
              AND bs.loai_bac_si = 'GP'

            FOR UPDATE
        """, (
            appointment_id,
            doctor_id
        ))

        appointment = cursor.fetchone()

        if not appointment:
            raise ValueError(
                "Lịch hẹn không tồn tại, không thuộc bạn "
                "hoặc bạn không phải bác sĩ đa khoa."
            )

        if appointment["trang_thai"] != "In-Consultation":
            raise ValueError(
                "Chỉ được chuyển tuyến khi lịch hẹn đang khám."
            )

        # -------------------------------------------------
        # 8.2. Kiểm tra lịch hẹn đã có phiếu chưa
        # -------------------------------------------------

        cursor.execute("""
            SELECT ma_chuyen_tuyen

            FROM phieu_chuyen_tuyen

            WHERE ma_lich_hen = %s

            FOR UPDATE
        """, (appointment_id,))

        if cursor.fetchone():
            raise ValueError(
                "Lịch hẹn này đã có phiếu chuyển tuyến."
            )

        # -------------------------------------------------
        # 8.3. Kiểm tra chuyên khoa
        # -------------------------------------------------

        cursor.execute("""
            SELECT ma_chuyen_khoa

            FROM chuyen_khoa

            WHERE ma_chuyen_khoa = %s
        """, (specialty_id,))

        if not cursor.fetchone():
            raise ValueError(
                "Chuyên khoa được chọn không tồn tại."
            )

        # -------------------------------------------------
        # 8.4. Kiểm tra bác sĩ nhận đúng chuyên khoa
        # -------------------------------------------------

        cursor.execute("""
            SELECT
                sp.ma_bac_si,
                sp.ma_chuyen_khoa,
                bs.ho_va_ten

            FROM bac_si_chuyen_khoa sp

            INNER JOIN bac_si bs
                ON bs.ma_bac_si = sp.ma_bac_si

            WHERE sp.ma_bac_si = %s
              AND sp.ma_chuyen_khoa = %s
              AND bs.loai_bac_si = 'Specialist'
        """, (
            recipient_id,
            specialty_id
        ))

        specialist = cursor.fetchone()

        if not specialist:
            raise ValueError(
                "Bác sĩ nhận không thuộc chuyên khoa đã chọn."
            )

        # -------------------------------------------------
        # 8.5. Sinh mã phiếu
        # -------------------------------------------------

        referral_id = generate_referral_id(cursor)

        # -------------------------------------------------
        # 8.6. Tạo phiếu chuyển tuyến
        # -------------------------------------------------

        cursor.execute("""
            INSERT INTO phieu_chuyen_tuyen (
                ma_chuyen_tuyen,
                ma_lich_hen,
                ma_bac_si_gp,
                ma_chuyen_khoa,
                ma_bac_si_nhan,
                ly_do_chuyen,
                trang_thai
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'Pending')
        """, (
            referral_id,
            appointment_id,
            doctor_id,
            specialty_id,
            recipient_id,
            reason
        ))

        # -------------------------------------------------
        # 8.7. Cập nhật trạng thái lịch hẹn
        # -------------------------------------------------

        cursor.execute("""
            UPDATE lich_hen_kham

            SET trang_thai = 'Referred'

            WHERE ma_lich_hen = %s
              AND ma_bac_si = %s
              AND trang_thai = 'In-Consultation'
        """, (
            appointment_id,
            doctor_id
        ))

        if cursor.rowcount != 1:
            raise ValueError(
                "Không thể cập nhật trạng thái lịch hẹn."
            )

        # -------------------------------------------------
        # 8.8. Lấy dữ liệu phiếu trước khi commit
        # -------------------------------------------------

        referral = _get_referral_with_cursor(
            cursor,
            referral_id
        )

        if not referral:
            raise RuntimeError(
                "Không thể đọc lại phiếu chuyển tuyến vừa tạo."
            )

        # -------------------------------------------------
        # 8.9. Hoàn tất transaction
        # -------------------------------------------------

        connection.commit()

        return referral

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# =========================================================
# 9. CẬP NHẬT TRẠNG THÁI PHIẾU CHUYỂN TUYẾN
# =========================================================

def update_referral_status(
    referral_id,
    new_status,
    doctor_id=None,
    is_admin=False
):
    """
    Quy trình:
        Pending -> Accepted -> Completed

    Doctor:
        Chỉ bác sĩ chuyên khoa được chỉ định nhận phiếu
        mới được cập nhật trạng thái.

    Admin:
        Có quyền cập nhật trạng thái để quản trị.
    """

    allowed_transitions = {
        "Pending": ["Accepted"],
        "Accepted": ["Completed"],
        "Completed": []
    }

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()

        # -------------------------------------------------
        # 9.1. Khóa phiếu chuyển tuyến
        # -------------------------------------------------

        cursor.execute("""
            SELECT
                p.ma_chuyen_tuyen,
                p.ma_bac_si_nhan,
                p.trang_thai

            FROM phieu_chuyen_tuyen p

            WHERE p.ma_chuyen_tuyen = %s

            FOR UPDATE
        """, (referral_id,))

        referral = cursor.fetchone()

        if not referral:
            connection.rollback()
            return None

        # -------------------------------------------------
        # 9.2. Kiểm tra quyền bác sĩ
        # -------------------------------------------------

        if not is_admin:

            if not doctor_id:
                raise ValueError(
                    "Tài khoản chưa được liên kết với bác sĩ."
                )

            if referral["ma_bac_si_nhan"] != doctor_id:
                raise PermissionError(
                    "Bạn không phải bác sĩ được chỉ định nhận phiếu."
                )

            # Kiểm tra bác sĩ vẫn là Specialist hợp lệ.
            cursor.execute("""
                SELECT
                    bs.ma_bac_si

                FROM bac_si_chuyen_khoa sp

                INNER JOIN bac_si bs
                    ON bs.ma_bac_si = sp.ma_bac_si

                WHERE sp.ma_bac_si = %s
                  AND bs.loai_bac_si = 'Specialist'
            """, (doctor_id,))

            if not cursor.fetchone():
                raise PermissionError(
                    "Chỉ bác sĩ chuyên khoa mới được tiếp nhận phiếu."
                )

        # -------------------------------------------------
        # 9.3. Kiểm tra chuyển trạng thái hợp lệ
        # -------------------------------------------------

        current_status = referral["trang_thai"]

        if new_status not in allowed_transitions.get(
            current_status,
            []
        ):
            raise ValueError(
                f"Không thể chuyển trạng thái từ "
                f"{current_status} sang {new_status}."
            )

        # -------------------------------------------------
        # 9.4. Cập nhật trạng thái
        # -------------------------------------------------

        cursor.execute("""
            UPDATE phieu_chuyen_tuyen

            SET trang_thai = %s

            WHERE ma_chuyen_tuyen = %s
              AND trang_thai = %s
        """, (
            new_status,
            referral_id,
            current_status
        ))

        if cursor.rowcount != 1:
            raise ValueError(
                "Phiếu đã thay đổi trạng thái. "
                "Vui lòng tải lại dữ liệu."
            )

        # -------------------------------------------------
        # 9.5. Lấy dữ liệu trước khi commit
        # -------------------------------------------------

        updated_referral = _get_referral_with_cursor(
            cursor,
            referral_id
        )

        if not updated_referral:
            raise RuntimeError(
                "Không thể đọc lại phiếu chuyển tuyến."
            )

        # -------------------------------------------------
        # 9.6. Hoàn tất transaction
        # -------------------------------------------------

        connection.commit()

        return updated_referral

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
