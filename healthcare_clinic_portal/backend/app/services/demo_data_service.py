
import random

from faker import Faker
from mysql.connector import Error, IntegrityError

from app.database.connection import get_db_connection
from app.models.auth_model import hash_password


fake = Faker("vi_VN")

DOCTOR_COUNT = 8
PATIENT_COUNT = 140
DEMO_PASSWORD = "Demo@12345"


def _unique_value(generator, used_values):
    """Sinh một giá trị chưa tồn tại trong database."""
    for _ in range(1000):
        value = generator()

        if value not in used_values:
            used_values.add(value)
            return value

    raise RuntimeError("Không thể sinh thêm dữ liệu duy nhất.")


def _make_phone(used_phones):
    return _unique_value(
        lambda: "09" + str(random.randint(10000000, 99999999)),
        used_phones
    )


def _make_cccd(used_cccd):
    return _unique_value(
        lambda: "079" + str(random.randint(100000000, 999999999)),
        used_cccd
    )


def create_demo_people():
    """
    Tạo thêm:
    - 8 bác sĩ: 2 GP và 6 Specialist.
    - 140 bệnh nhân.
    - 148 tài khoản tương ứng.

    Không sửa hoặc xóa dữ liệu hiện có.
    Nếu xảy ra lỗi, toàn bộ transaction sẽ rollback.
    """

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        connection.start_transaction()

        # ==========================================
        # 1. KIỂM TRA ĐÃ TỪNG TẠO DỮ LIỆU DEMO CHƯA
        # ==========================================

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM bac_si
            WHERE ma_bac_si LIKE 'DMBS%'
        """)

        if cursor.fetchone()["total"] > 0:
            raise ValueError(
                "Đã tồn tại bác sĩ demo (mã DMBS...). "
                "Không chạy lại để tránh tạo dữ liệu trùng."
            )

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM benh_nhan
            WHERE ma_benh_nhan LIKE 'DMBN%'
        """)

        if cursor.fetchone()["total"] > 0:
            raise ValueError(
                "Đã tồn tại bệnh nhân demo (mã DMBN...). "
                "Không chạy lại để tránh tạo dữ liệu trùng."
            )

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM tai_khoan
            WHERE ma_tai_khoan LIKE 'DMTK%'
               OR LEFT(ten_dang_nhap, 5) = 'demo_'
        """)

        if cursor.fetchone()["total"] > 0:
            raise ValueError(
                "Đã tồn tại tài khoản demo. "
                "Không chạy lại để tránh tạo tài khoản trùng."
            )

        # ==========================================
        # 2. LẤY CHUYÊN KHOA ĐANG CÓ
        # ==========================================

        cursor.execute("""
            SELECT ma_chuyen_khoa
            FROM chuyen_khoa
            ORDER BY ma_chuyen_khoa
        """)

        specialties = [
            row["ma_chuyen_khoa"]
            for row in cursor.fetchall()
        ]

        if not specialties:
            raise ValueError(
                "Bảng chuyen_khoa chưa có dữ liệu. "
                "Hãy tạo chuyên khoa trước khi tạo bác sĩ demo."
            )

        # ==========================================
        # 3. LẤY CÁC GIÁ TRỊ ĐÃ TỒN TẠI
        #    ĐỂ TRÁNH TRÙNG UNIQUE
        # ==========================================

        cursor.execute("""
            SELECT thu_dien_tu
            FROM bac_si
        """)

        used_emails = {
            row["thu_dien_tu"].lower()
            for row in cursor.fetchall()
            if row["thu_dien_tu"]
        }

        cursor.execute("""
            SELECT so_dien_thoai
            FROM bac_si
        """)

        used_phones = {
            row["so_dien_thoai"]
            for row in cursor.fetchall()
            if row["so_dien_thoai"]
        }

        cursor.execute("""
            SELECT so_dien_thoai
            FROM benh_nhan
        """)

        used_phones.update(
            row["so_dien_thoai"]
            for row in cursor.fetchall()
            if row["so_dien_thoai"]
        )

        cursor.execute("""
            SELECT can_cuoc_cong_dan
            FROM benh_nhan
        """)

        used_cccd = {
            row["can_cuoc_cong_dan"]
            for row in cursor.fetchall()
            if row["can_cuoc_cong_dan"]
        }

        # Hash mật khẩu một lần để dùng cho 148 tài khoản.
        password_hash = hash_password(DEMO_PASSWORD)

        created_accounts = []

        # ==========================================
        # 4. TẠO 8 BÁC SĨ
        #    2 GP + 6 SPECIALIST
        # ==========================================

        for index in range(1, DOCTOR_COUNT + 1):

            doctor_id = f"DMBS{index:04d}"
            account_id = f"DMTKBS{index:04d}"
            username = f"demo_doctor{index:02d}"

            full_name = fake.name()[:100]

            email = _unique_value(
                lambda: (
                    f"demo.doctor{index:02d}."
                    f"{random.randint(1000, 999999)}@demo.clinic.test"
                ),
                used_emails
            )

            phone = _make_phone(used_phones)

            # --------------------------------------
            # 4.1. BÁC SĨ ĐA KHOA
            # --------------------------------------

            if index <= 2:

                doctor_type = "GP"

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
                    full_name,
                    email,
                    phone,
                    doctor_type
                ))

                cursor.execute("""
                    INSERT INTO bac_si_da_khoa (
                        ma_bac_si,
                        so_phong_kham,
                        cap_do_cham_soc
                    )
                    VALUES (%s, %s, %s)
                """, (
                    doctor_id,
                    f"DEMO-GP-{index:02d}",
                    "Primary"
                ))

            # --------------------------------------
            # 4.2. BÁC SĨ CHUYÊN KHOA
            # --------------------------------------

            else:

                doctor_type = "Specialist"

                specialty_id = specialties[
                    (index - 3) % len(specialties)
                ]

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
                    full_name,
                    email,
                    phone,
                    doctor_type
                ))

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
                    specialty_id,
                    f"DEMO-CERT-{index:04d}",
                    250000 + (index * 25000)
                ))

            # --------------------------------------
            # 4.3. TẠO TÀI KHOẢN BÁC SĨ
            # --------------------------------------

            cursor.execute("""
                INSERT INTO tai_khoan (
                    ma_tai_khoan,
                    ten_dang_nhap,
                    mat_khau_hash,
                    vai_tro,
                    ma_bac_si,
                    ma_benh_nhan,
                    trang_thai
                )
                VALUES (
                    %s, %s, %s,
                    'Doctor', %s, NULL, 'Active'
                )
            """, (
                account_id,
                username,
                password_hash,
                doctor_id
            ))

            created_accounts.append({
                "ma_tai_khoan": account_id,
                "ten_dang_nhap": username,
                "vai_tro": "Doctor",
                "ma_bac_si": doctor_id,
                "ma_benh_nhan": None
            })

        # ==========================================
        # 5. TẠO 140 BỆNH NHÂN
        # ==========================================

        for index in range(1, PATIENT_COUNT + 1):

            patient_id = f"DMBN{index:04d}"
            account_id = f"DMTKBN{index:04d}"
            username = f"demo_patient{index:03d}"

            full_name = fake.name()[:100]

            birth_date = fake.date_of_birth(
                minimum_age=18,
                maximum_age=80
            )

            gender = random.choice([
                "Nam",
                "Nữ",
                "Khác"
            ])

            phone = _make_phone(used_phones)
            cccd = _make_cccd(used_cccd)

            # --------------------------------------
            # 5.1. TẠO HỒ SƠ BỆNH NHÂN
            # --------------------------------------

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
                patient_id,
                full_name,
                birth_date,
                gender,
                phone,
                cccd,
                "Hồ sơ giả lập phục vụ kiểm thử hệ thống."
            ))

            # --------------------------------------
            # 5.2. TẠO TÀI KHOẢN BỆNH NHÂN
            # --------------------------------------

            cursor.execute("""
                INSERT INTO tai_khoan (
                    ma_tai_khoan,
                    ten_dang_nhap,
                    mat_khau_hash,
                    vai_tro,
                    ma_bac_si,
                    ma_benh_nhan,
                    trang_thai
                )
                VALUES (
                    %s, %s, %s,
                    'Patient', NULL, %s, 'Active'
                )
            """, (
                account_id,
                username,
                password_hash,
                patient_id
            ))

            created_accounts.append({
                "ma_tai_khoan": account_id,
                "ten_dang_nhap": username,
                "vai_tro": "Patient",
                "ma_bac_si": None,
                "ma_benh_nhan": patient_id
            })

        # ==========================================
        # 6. KIỂM TRA SỐ LƯỢNG TRƯỚC KHI COMMIT
        # ==========================================

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM bac_si
            WHERE ma_bac_si LIKE 'DMBS%'
        """)

        doctor_total = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM benh_nhan
            WHERE ma_benh_nhan LIKE 'DMBN%'
        """)

        patient_total = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM tai_khoan
            WHERE ma_tai_khoan LIKE 'DMTK%'
        """)

        account_total = cursor.fetchone()["total"]

        if (
            doctor_total != DOCTOR_COUNT
            or patient_total != PATIENT_COUNT
            or account_total != DOCTOR_COUNT + PATIENT_COUNT
        ):
            raise RuntimeError(
                "Số lượng dữ liệu sau khi tạo không khớp. "
                "Đã hủy transaction."
            )

        # ==========================================
        # 7. HOÀN TẤT
        # ==========================================

        connection.commit()

        return {
            "bac_si_da_tao": doctor_total,
            "benh_nhan_da_tao": patient_total,
            "tai_khoan_da_tao": account_total,
            "mat_khau_chung": DEMO_PASSWORD,
            "tai_khoan": created_accounts
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()
