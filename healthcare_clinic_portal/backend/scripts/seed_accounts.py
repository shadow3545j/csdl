import sys
from pathlib import Path

# Đưa thư mục backend vào Python path
BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
from app.database.connection import get_db_connection
from app.models.auth_model import hash_password


# ==========================================
# SAMPLE ACCOUNTS
# ==========================================

SAMPLE_ACCOUNTS = [
    {
        "account_id": "TK_ADMIN",
        "username": "admin",
        "password": "Admin@123",
        "role": "Admin",
        "doctor_id": None,
        "patient_id": None
    },
    {
        "account_id": "TK_BS001",
        "username": "doctor01",
        "password": "Doctor@123",
        "role": "Doctor",
        "doctor_id": "BS001",
        "patient_id": None
    },
    {
        "account_id": "TK_RECEPTION",
        "username": "receptionist01",
        "password": "Reception@123",
        "role": "Receptionist",
        "doctor_id": None,
        "patient_id": None
    },
    {
        "account_id": "TK_PHARMA",
        "username": "pharmacist01",
        "password": "Pharma@123",
        "role": "Pharmacist",
        "doctor_id": None,
        "patient_id": None
    },
    {
        "account_id": "TK_BN001",
        "username": "patient01",
        "password": "Patient@123",
        "role": "Patient",
        "doctor_id": None,
        "patient_id": "BN001"
    }
]


# ==========================================
# CHECK EXISTING ACCOUNT
# ==========================================

def account_exists(cursor, account):
    cursor.execute("""
        SELECT ma_tai_khoan, ten_dang_nhap
        FROM tai_khoan
        WHERE ten_dang_nhap = %s
           OR ma_tai_khoan = %s
           OR (
                %s IS NOT NULL
                AND ma_bac_si = %s
           )
           OR (
                %s IS NOT NULL
                AND ma_benh_nhan = %s
           )
        LIMIT 1
    """, (
        account["username"],
        account["account_id"],
        account["doctor_id"],
        account["doctor_id"],
        account["patient_id"],
        account["patient_id"]
    ))

    return cursor.fetchone()


# ==========================================
# CHECK LINKED PROFILE
# ==========================================

def linked_profile_exists(cursor, account):
    if account["doctor_id"]:
        cursor.execute("""
            SELECT ma_bac_si
            FROM bac_si
            WHERE ma_bac_si = %s
        """, (account["doctor_id"],))

        if cursor.fetchone() is None:
            return False, "Không tìm thấy hồ sơ bác sĩ."

    if account["patient_id"]:
        cursor.execute("""
            SELECT ma_benh_nhan
            FROM benh_nhan
            WHERE ma_benh_nhan = %s
        """, (account["patient_id"],))

        if cursor.fetchone() is None:
            return False, "Không tìm thấy hồ sơ bệnh nhân."

    return True, None


# ==========================================
# SEED ACCOUNTS
# ==========================================

def seed_accounts():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    created_count = 0
    skipped_count = 0

    try:
        for account in SAMPLE_ACCOUNTS:

            existing = account_exists(cursor, account)

            if existing:
                print(
                    f"[SKIP] {account['username']}: "
                    "Tài khoản hoặc hồ sơ liên kết đã tồn tại."
                )
                skipped_count += 1
                continue

            valid, message = linked_profile_exists(cursor, account)

            if not valid:
                raise ValueError(
                    f"{account['username']}: {message}"
                )

            password_hash = hash_password(account["password"])

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
                VALUES (%s, %s, %s, %s, %s, %s, 'Active')
            """, (
                account["account_id"],
                account["username"],
                password_hash,
                account["role"],
                account["doctor_id"],
                account["patient_id"]
            ))

            created_count += 1

            print(
                f"[CREATED] {account['username']} "
                f"({account['role']})"
            )

        connection.commit()

        print("\n========== SEED RESULT ==========")
        print(f"Tài khoản mới: {created_count}")
        print(f"Tài khoản bỏ qua: {skipped_count}")
        print("Hoàn tất tạo tài khoản mẫu!")

    except Exception as error:
        connection.rollback()
        print(f"\n[ERROR] Không thể tạo tài khoản: {error}")
        raise

    finally:
        cursor.close()
        connection.close()


# ==========================================
# MAIN
# ==========================================

if __name__ == "__main__":
    seed_accounts()
