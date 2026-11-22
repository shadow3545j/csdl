import random
from datetime import datetime, timedelta

from mysql.connector import Error

from app.database.connection import get_db_connection


START_DATE = datetime(2026, 11, 16)
TOTAL_DAYS = 12

MEDICINES = [
    ("Paracetamol 500mg", "Paracetamol"),
    ("Cetirizine 10mg", "Cetirizine"),
    ("Amlodipine 5mg", "Amlodipine"),
    ("Atorvastatin 10mg", "Atorvastatin"),
    ("Hydrocortisone Cream", "Hydrocortisone"),
    ("Omeprazole 20mg", "Omeprazole"),
    ("Metformin 500mg", "Metformin"),
    ("Losartan 50mg", "Losartan"),
    ("Vitamin C 500mg", "Ascorbic acid"),
    ("Loratadine 10mg", "Loratadine"),
    ("Gaviscon", "Alginate"),
    ("Salbutamol 2mg", "Salbutamol"),
    ("Dextromethorphan", "Dextromethorphan"),
    ("Ambroxol 30mg", "Ambroxol"),
    ("Calcium 500mg", "Calcium"),
    ("Vitamin D3", "Cholecalciferol"),
    ("Ferrous Sulfate", "Ferrous sulfate"),
    ("Clotrimazole Cream", "Clotrimazole"),
    ("Mupirocin Ointment", "Mupirocin"),
    ("Folic Acid 5mg", "Folic acid"),
    ("Bisoprolol 2.5mg", "Bisoprolol"),
    ("Esomeprazole 20mg", "Esomeprazole"),
    ("Montelukast 10mg", "Montelukast"),
    ("Demo Medicine 24", "Demo ingredient 24"),
    ("Demo Medicine 25", "Demo ingredient 25"),
]


def create_demo_clinical_data():
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    dispense_ids = []
    result = {}

    try:
        connection.start_transaction()

        # ==========================================
        # 1. KIỂM TRA DỮ LIỆU BÁC SĨ VÀ BỆNH NHÂN
        # ==========================================

        cursor.execute("""
            SELECT ma_bac_si, loai_bac_si
            FROM bac_si
            WHERE ma_bac_si LIKE 'DMBS%'
            ORDER BY ma_bac_si
        """)
        doctors = cursor.fetchall()

        cursor.execute("""
            SELECT ma_benh_nhan
            FROM benh_nhan
            WHERE ma_benh_nhan LIKE 'DMBN%'
            ORDER BY ma_benh_nhan
        """)
        patients = cursor.fetchall()

        if len(doctors) != 8 or len(patients) != 140:
            raise ValueError(
                "Cần tạo đủ 8 bác sĩ và 140 bệnh nhân ở bước trước."
            )

        gps = [
            d["ma_bac_si"]
            for d in doctors
            if d["loai_bac_si"] == "GP"
        ]

        specialists = [
            d["ma_bac_si"]
            for d in doctors
            if d["loai_bac_si"] == "Specialist"
        ]

        doctor_ids = [d["ma_bac_si"] for d in doctors]
        patient_ids = [p["ma_benh_nhan"] for p in patients]

        if not gps or not specialists:
            raise ValueError(
                "Phải có cả bác sĩ GP và bác sĩ Specialist."
            )

        # ==========================================
        # 2. CHẶN TẠO TRÙNG DỮ LIỆU DEMO
        # ==========================================

        checks = [
            ("lich_lam_viec_bac_si", "DMLLV%"),
            ("di_ung_benh_nhan", "DMDU%"),
            ("lich_hen_kham", "DMLH%"),
            ("phien_kham_tu_xa", "DMPK%"),
            ("phieu_chuyen_tuyen", "DMCT%"),
            ("ho_so_benh_an", "DMHS%"),
            ("phu_luc_dinh_chinh_benh_an", "DMPL%"),
            ("don_thuoc", "DMDT%"),
            ("danh_muc_thuoc", "DMTH%"),
            ("chi_tiet_don_thuoc", "DMCTDT%"),
        ]

        for table_name, prefix in checks:
            cursor.execute(
                f"SELECT COUNT(*) AS total FROM {table_name} "
                "WHERE " + (
                    "ma_lich_lam_viec" if table_name == "lich_lam_viec_bac_si"
                    else "ma_di_ung" if table_name == "di_ung_benh_nhan"
                    else "ma_lich_hen" if table_name == "lich_hen_kham"
                    else "ma_phien_kham" if table_name == "phien_kham_tu_xa"
                    else "ma_chuyen_tuyen" if table_name == "phieu_chuyen_tuyen"
                    else "ma_ho_so" if table_name == "ho_so_benh_an"
                    else "ma_phu_luc" if table_name == "phu_luc_dinh_chinh_benh_an"
                    else "ma_don_thuoc" if table_name == "don_thuoc"
                    else "ma_thuoc" if table_name == "danh_muc_thuoc"
                    else "ma_chi_tiet"
                ) + " LIKE %s",
                (prefix,)
            )

            if cursor.fetchone()["total"] > 0:
                raise ValueError(
                    f"Bảng {table_name} đã có dữ liệu demo. "
                    "Không chạy lại API này."
                )

        # ==========================================
        # 3. BỔ SUNG CHUYÊN KHOA NẾU CHƯA ĐỦ 6
        # ==========================================

        demo_specialties = [
            ("DMCK001", "DEMO-SPEC-01", "Noi tong quat"),
            ("DMCK002", "DEMO-SPEC-02", "Nhi khoa"),
            ("DMCK003", "DEMO-SPEC-03", "Tai mui hong"),
        ]

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM chuyen_khoa
        """)
        specialty_count = cursor.fetchone()["total"]

        specialties_added = 0

        for specialty in demo_specialties:
            if specialty_count >= 6:
                break

            cursor.execute("""
                INSERT INTO chuyen_khoa (
                    ma_chuyen_khoa,
                    ma_dinh_danh,
                    ten_chuyen_khoa
                )
                VALUES (%s, %s, %s)
            """, specialty)

            specialty_count += 1
            specialties_added += 1

        # ==========================================
        # 4. TẠO 25 THUỐC DEMO
        # ==========================================

        medicine_rows = []

        for index, (brand, ingredient) in enumerate(
            MEDICINES, start=1
        ):
            medicine_id = f"DMTH{index:04d}"

            medicine_rows.append((
                medicine_id,
                brand,
                ingredient,
                1000
            ))

        cursor.executemany("""
            INSERT INTO danh_muc_thuoc (
                ma_thuoc,
                ten_biet_duoc,
                hoat_chat,
                so_luong_ton
            )
            VALUES (%s, %s, %s, %s)
        """, medicine_rows)

        # ==========================================
        # 5. TẠO 30 DỮ LIỆU DỊ ỨNG
        # ==========================================

        allergy_by_patient = {}

        for index in range(30):
            patient_id = patient_ids[index]
            medicine_index = (index + 5) % len(MEDICINES)
            allergen = MEDICINES[medicine_index][1]

            severity = random.choice([
                "Nhẹ",
                "Trung bình",
                "Nguy kịch"
            ])

            allergy_by_patient[patient_id] = allergen

            cursor.execute("""
                INSERT INTO di_ung_benh_nhan (
                    ma_di_ung,
                    ma_benh_nhan,
                    ten_di_nguyen,
                    muc_do
                )
                VALUES (%s, %s, %s, %s)
            """, (
                f"DMDU{index + 1:04d}",
                patient_id,
                allergen,
                severity
            ))

        # ==========================================
        # 6. TẠO 96 LỊCH LÀM VIỆC
        #    8 BÁC SĨ x 12 NGÀY
        # ==========================================

        schedule_rows = []
        schedule_index = 1

        for day_index in range(TOTAL_DAYS):
            work_date = (
                START_DATE + timedelta(days=day_index)
            ).date()

            for doctor_id in doctor_ids:
                schedule_rows.append((
                    f"DMLLV{schedule_index:04d}",
                    doctor_id,
                    work_date,
                    "08:00:00",
                    "17:00:00"
                ))

                schedule_index += 1

        cursor.executemany("""
            INSERT INTO lich_lam_viec_bac_si (
                ma_lich_lam_viec,
                ma_bac_si,
                ngay_lam_viec,
                gio_bat_dau,
                gio_ket_thuc
            )
            VALUES (%s, %s, %s, %s, %s)
        """, schedule_rows)

        # ==========================================
        # 7. TẠO 200 LỊCH HẸN
        #    MỖI THỜI ĐIỂM CHỈ TẠO 1 LỊCH
        # ==========================================

        appointment_rows = []
        appointment_info = []

        for index in range(200):
            day_index = index // 18
            slot_index = index % 18

            appointment_time = (
                START_DATE
                + timedelta(days=day_index)
                + timedelta(hours=8)
                + timedelta(minutes=30 * slot_index)
            )

            # 10 lịch chuyển tuyến phải thuộc bác sĩ GP.
            if 100 <= index < 110:
                doctor_id = gps[(index - 100) % len(gps)]
            else:
                doctor_id = doctor_ids[index % len(doctor_ids)]

            patient_id = patient_ids[index % len(patient_ids)]

            appointment_id = f"DMLH{index + 1:04d}"

            appointment_type = (
                "Telemedicine" if index < 60 else "In-clinic"
            )

            appointment_rows.append((
                appointment_id,
                patient_id,
                doctor_id,
                appointment_time,
                appointment_type,
                "Scheduled"
            ))

            appointment_info.append({
                "id": appointment_id,
                "patient": patient_id,
                "doctor": doctor_id,
                "time": appointment_time,
                "type": appointment_type
            })

        cursor.executemany("""
            INSERT INTO lich_hen_kham (
                ma_lich_hen,
                ma_benh_nhan,
                ma_bac_si,
                thoi_gian_hen,
                loai_hinh_kham,
                trang_thai
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """, appointment_rows)

        # ==========================================
        # 8. TẠO 60 PHIÊN KHÁM TỪ XA
        # ==========================================

        for index in range(60):
            appointment_id = appointment_info[index]["id"]
            session_id = f"DMPK{index + 1:04d}"

            cursor.execute("""
                INSERT INTO phien_kham_tu_xa (
                    ma_phien_kham,
                    ma_lich_hen,
                    duong_dan_video,
                    khoa_ma_hoa
                )
                VALUES (%s, %s, %s, %s)
            """, (
                session_id,
                appointment_id,
                f"https://meeting.example.test/{session_id}",
                f"DEMO_ONLY_KEY_{index + 1:04d}"
            ))

        # ==========================================
        # 9. TẠO 150 HỒ SƠ BỆNH ÁN
        #    100 FINALIZED + 50 DRAFT
        # ==========================================

        diagnosis_data = [
            ("J00", "Ho, dau hong", "Viem mui hong cap"),
            ("I10", "Dau dau, huyet ap cao", "Tang huyet ap"),
            ("E78", "Met moi", "Roi loan lipid mau"),
            ("L30", "Da kho va ngua", "Viem da"),
            ("K21", "Dau bung", "Trao nguoc da day"),
        ]

        record_rows = []

        for index in range(150):
            appointment = appointment_info[index]

            disease_code, symptoms, diagnosis = (
                diagnosis_data[index % len(diagnosis_data)]
            )

            record_status = (
                "Finalized" if index < 100 else "Draft"
            )

            record_rows.append((
                f"DMHS{index + 1:04d}",
                appointment["patient"],
                appointment["id"],
                disease_code,
                symptoms,
                diagnosis,
                record_status
            ))

        cursor.executemany("""
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
        """, record_rows)

        # ==========================================
        # 10. TẠO 10 PHIẾU CHUYỂN TUYẾN
        # ==========================================

        for index in range(10):
            appointment = appointment_info[100 + index]

            cursor.execute("""
                SELECT ma_chuyen_khoa
                FROM bac_si_chuyen_khoa
                WHERE ma_bac_si = %s
            """, (specialists[index % len(specialists)],))

            specialty = cursor.fetchone()

            if not specialty:
                raise ValueError(
                    "Bác sĩ Specialist chưa có chuyên khoa."
                )

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
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                f"DMCT{index + 1:04d}",
                appointment["id"],
                appointment["doctor"],
                specialty["ma_chuyen_khoa"],
                specialists[index % len(specialists)],
                "Du lieu chuyen tuyen gia lap phuc vu kiem thu.",
                "Accepted" if index % 2 == 0 else "Pending"
            ))

        # ==========================================
        # 11. TẠO 5 PHỤ LỤC ĐÍNH CHÍNH
        # ==========================================

        for index in range(5):
            cursor.execute("""
                INSERT INTO phu_luc_dinh_chinh_benh_an (
                    ma_phu_luc,
                    ma_ho_so,
                    ly_do_dinh_chinh,
                    noi_dung
                )
                VALUES (%s, %s, %s, %s)
            """, (
                f"DMPL{index + 1:04d}",
                f"DMHS{index + 1:04d}",
                "Bo sung thong tin kiem thu.",
                "Noi dung phu luc demo."
            ))

        # ==========================================
        # 12. TẠO 100 ĐƠN THUỐC
        # ==========================================

        for index in range(100):
            appointment_time = appointment_info[index]["time"]

            prescription_time = (
                appointment_time + timedelta(minutes=20)
            )

            cursor.execute("""
                INSERT INTO don_thuoc (
                    ma_don_thuoc,
                    ma_ho_so,
                    thoi_gian_ke,
                    trang_thai
                )
                VALUES (%s, %s, %s, 'Active')
            """, (
                f"DMDT{index + 1:04d}",
                f"DMHS{index + 1:04d}",
                prescription_time
            ))

        # ==========================================
        # 13. TẠO 144 CHI TIẾT ĐƠN THUỐC
        #     44 ĐƠN CÓ 2 THUỐC
        #     56 ĐƠN CÓ 1 THUỐC
        # ==========================================

        detail_index = 1

        for prescription_index in range(100):

            patient_id = appointment_info[prescription_index]["patient"]

            allergen = allergy_by_patient.get(patient_id)

            available_medicines = [
                index
                for index, medicine in enumerate(MEDICINES)
                if medicine[1].lower() != (
                    allergen.lower() if allergen else ""
                )
            ]

            number_of_items = (
                2 if prescription_index < 44 else 1
            )

            selected_medicines = random.sample(
                available_medicines,
                number_of_items
            )

            for medicine_index in selected_medicines:
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
                    f"DMCTDT{detail_index:04d}",
                    f"DMDT{prescription_index + 1:04d}",
                    f"DMTH{medicine_index + 1:04d}",
                    random.randint(1, 5),
                    "Su dung theo huong dan kiem thu.",
                    "Uong"
                ))

                detail_index += 1

        if detail_index != 145:
            raise RuntimeError(
                "Số lượng chi tiết đơn thuốc không đúng 144."
            )

        # ==========================================
        # 14. CHUYỂN TRẠNG THÁI 200 LỊCH HẸN
        # ==========================================

        # 100 lịch Completed:
        # Scheduled -> In-Consultation -> Completed
        for index in range(100):
            appointment_id = appointment_info[index]["id"]

            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'In-Consultation'
                WHERE ma_lich_hen = %s
            """, (appointment_id,))

            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'Completed'
                WHERE ma_lich_hen = %s
            """, (appointment_id,))

        # 10 lịch Referred:
        # Scheduled -> In-Consultation -> Referred
        for index in range(100, 110):
            appointment_id = appointment_info[index]["id"]

            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'In-Consultation'
                WHERE ma_lich_hen = %s
            """, (appointment_id,))

            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'Referred'
                WHERE ma_lich_hen = %s
            """, (appointment_id,))

        # 40 lịch đang khám
        for index in range(110, 150):
            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'In-Consultation'
                WHERE ma_lich_hen = %s
            """, (appointment_info[index]["id"],))

        # 20 lịch đã hủy
        for index in range(150, 170):
            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'Cancelled'
                WHERE ma_lich_hen = %s
            """, (appointment_info[index]["id"],))

        # 10 lịch bệnh nhân không đến
        for index in range(170, 180):
            cursor.execute("""
                UPDATE lich_hen_kham
                SET trang_thai = 'No-Show'
                WHERE ma_lich_hen = %s
            """, (appointment_info[index]["id"],))

        # 20 lịch còn lại giữ Scheduled

        # ==========================================
        # 15. 10 ĐƠN THUỐC CANCELLED
        # ==========================================

        for index in range(90, 100):
            cursor.execute("""
                UPDATE don_thuoc
                SET trang_thai = 'Cancelled'
                WHERE ma_don_thuoc = %s
            """, (f"DMDT{index + 1:04d}",))

        # ==========================================
        # 16. KIỂM TRA SỐ LƯỢNG TRƯỚC COMMIT
        # ==========================================

        expected_counts = {
            "lich_lam_viec_bac_si": 96,
            "di_ung_benh_nhan": 30,
            "lich_hen_kham": 200,
            "phien_kham_tu_xa": 60,
            "phieu_chuyen_tuyen": 10,
            "ho_so_benh_an": 150,
            "phu_luc_dinh_chinh_benh_an": 5,
            "don_thuoc": 100,
            "danh_muc_thuoc": 25,
            "chi_tiet_don_thuoc": 144,
        }

        id_columns = {
            "lich_lam_viec_bac_si": "ma_lich_lam_viec",
            "di_ung_benh_nhan": "ma_di_ung",
            "lich_hen_kham": "ma_lich_hen",
            "phien_kham_tu_xa": "ma_phien_kham",
            "phieu_chuyen_tuyen": "ma_chuyen_tuyen",
            "ho_so_benh_an": "ma_ho_so",
            "phu_luc_dinh_chinh_benh_an": "ma_phu_luc",
            "don_thuoc": "ma_don_thuoc",
            "danh_muc_thuoc": "ma_thuoc",
            "chi_tiet_don_thuoc": "ma_chi_tiet",
        }

        prefixes = {
            "lich_lam_viec_bac_si": "DMLLV%",
            "di_ung_benh_nhan": "DMDU%",
            "lich_hen_kham": "DMLH%",
            "phien_kham_tu_xa": "DMPK%",
            "phieu_chuyen_tuyen": "DMCT%",
            "ho_so_benh_an": "DMHS%",
            "phu_luc_dinh_chinh_benh_an": "DMPL%",
            "don_thuoc": "DMDT%",
            "danh_muc_thuoc": "DMTH%",
            "chi_tiet_don_thuoc": "DMCTDT%",
        }

        for table, expected in expected_counts.items():
            cursor.execute(
                f"SELECT COUNT(*) AS total FROM {table} "
                f"WHERE {id_columns[table]} LIKE %s",
                (prefixes[table],)
            )

            actual = cursor.fetchone()["total"]

            if actual != expected:
                raise RuntimeError(
                    f"Bảng {table}: cần {expected}, hiện có {actual}."
                )

        connection.commit()

        # ==========================================
        # 17. CẤP PHÁT 40 ĐƠN THUỐC BẰNG PROCEDURE
        # ==========================================

        for index in range(40):
            prescription_id = f"DMDT{index + 1:04d}"

            try:
                cursor.execute(
                    "CALL sp_cap_phat_thuoc(%s)",
                    (prescription_id,)
                )

                while True:
                    try:
                        cursor.fetchall()
                    except Exception:
                        pass

                    if not cursor.nextset():
                        break

                dispense_ids.append(prescription_id)

            except Error as error:
                print(
                    f"Không cấp phát được {prescription_id}: {error}"
                )

        result = {
            "chuyen_khoa_them": specialties_added,
            "lich_lam_viec": 96,
            "di_ung": 30,
            "lich_hen": 200,
            "phien_kham_tu_xa": 60,
            "phieu_chuyen_tuyen": 10,
            "ho_so_benh_an": 150,
            "phu_luc_dinh_chinh": 5,
            "danh_muc_thuoc": 25,
            "don_thuoc": 100,
            "chi_tiet_don_thuoc": 144,
            "don_da_cap_phat": len(dispense_ids),
            "don_cap_phat_that_bai": 40 - len(dispense_ids),
            "ma_don_da_cap_phat": dispense_ids,
        }

        return result

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()