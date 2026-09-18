# Healthcare Clinic & Telemedicine Portal Database System
*Kiến trúc Cơ sở dữ liệu Quan hệ & Kiểm soát Toàn vẹn Dữ liệu cho Cổng Điều phối Phòng khám Doanh nghiệp và Y tế Từ xa*

---

## 📌 1. Giới thiệu dự án
Nền tảng điều phối khám chữa bệnh đa kênh (**Omnichannel Healthcare**) kết hợp giữa khám trực tiếp tại phòng khám (In-clinic) và tư vấn y tế từ xa (Telemedicine). Dự án tập trung giải quyết các bài toán cốt lõi trong quản trị cơ sở dữ liệu y tế:
- **Chống trùng lặp lịch hẹn (Double-booking):** Đảm bảo tính nhất quán thời gian thực cho lịch làm việc của bác sĩ và phòng chức năng.
- **Tính bất biến của bệnh án (Medical Record Immutability):** Đảm bảo hồ sơ sau khi ký số/khóa sổ không bị chỉnh sửa trái phép, tuân thủ tiêu chuẩn kiểm toán y tế.
- **Phân cấp chuyên môn y tế:** Quản lý chặt chẽ ranh giới giữa Bác sĩ Đa khoa (General Practitioner - GP) và Bác sĩ Chuyên khoa (Specialist) trong chuỗi chuyển tuyến.
- **Tự động hóa kho dược:** Trừ tồn kho thời gian thực khi phát hành đơn thuốc điện tử (e-Prescription).

---

## 👥 2. Thành viên nhóm (Team: Chú Ba)
| Họ và tên | Mã sinh viên |
| :--- | :--- | :--- |
| **Nguyễn Xuân Bảo**  | `n24dccn097` |
| **Phạm Anh Hào** | `n24dccn117` |
| **Trần Xa Thiên Tân** | `n24dccn162` |

---

## ⚙️ 3. Tính năng & Ràng buộc nghiệp vụ cốt lõi
1. **Vòng đời lịch hẹn (Appointment Lifecycle):** 
   - Quản lý các trạng thái: `Scheduled` ➔ `In-Consultation` ➔ `Completed` / `Referred` / `Cancelled` / `No-Show`.
2. **Kiểm soát phân quyền & Chuyên môn (BR-01):**
   - Bác sĩ Đa khoa tiếp nhận ban đầu, tạo phiếu chuyển tuyến (`Referral_Ticket`) sang Bác sĩ Chuyên khoa tương ứng.
3. **Bất biến dữ liệu y tế (BR-03):**
   - Sử dụng Database Trigger chặn mọi câu lệnh `UPDATE` hoặc `DELETE` trên bảng `Medical_Records` khi trạng thái đã chuyển sang `Finalized`. Mọi chỉnh sửa bắt buộc phải thông qua bản ghi bổ sung (`Addendum`).
4. **Kiểm tra tồn kho & Đơn thuốc (FR-04):**
   - Tự động kiểm tra lượng tồn kho thực tế và trừ kho ngay khi đơn thuốc được xác nhận phát hành trong cùng một giao dịch ACID.

---

## 🗄️ 4. Sơ đồ Thiết kế Cơ sở dữ liệu (Database Schema)
*(Nhóm có thể chèn hình ảnh ERD hoặc sơ đồ quan hệ vào đây)*
- **Mô hình thực thể kết hợp (ERD):** Chuẩn hóa tối thiểu đến dạng chuẩn 3NF.
- **Các bảng chính:**
  - `Doctors`, `General_Practitioners`, `Specialists` (Mô hình chuyên môn hóa).
  - `Patients`, `Patient_Allergies`.
  - `Appointments`, `Medical_Records`, `Medical_Audit_Logs`.
  - `Prescriptions`, `Medicines`, `Inventory`.

---

## 🛠️ 5. Công nghệ sử dụng
- **Hệ quản trị CSDL:** PostgreSQL / MySQL (Chọn 1 trong 2 hệ quản trị nhóm đang dùng).
- **Ngôn ngữ lập trình / Công cụ thiết kế:** SQL, Draw.io / ERD Tool, Python (nếu có script test dữ liệu).
- **Tiêu chuẩn thiết kế:** ISO/IEC/IEEE 29148:2018 (SRS), ACID Transactions, Indexing Strategies.
