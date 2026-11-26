-- =====================================================================
--  Triggers cho Healthcare Clinic Portal
--  - trg_lich_hen_kiem_tra_trang_thai:
--      Chi cho phep cac buoc chuyen trang thai lich hen hop le.
--
--  Cac chuyen doi hop le (may trang thai):
--      Scheduled       -> In-Consultation | Cancelled | No-Show
--      In-Consultation -> Referred       | Completed
--      (Referred / Completed / Cancelled / No-Show la trang thai ket thuc)
--
--  Nap vao CSDL:
--    mysql -u root -p healthcare_clinic < backend/sql/triggers.sql
-- =====================================================================

USE healthcare_clinic;

DROP TRIGGER IF EXISTS trg_lich_hen_kiem_tra_trang_thai;

DELIMITER $$

CREATE TRIGGER trg_lich_hen_kiem_tra_trang_thai
BEFORE UPDATE ON lich_hen_kham
FOR EACH ROW
BEGIN
    -- Chi kiem tra khi trang thai thuc su thay doi.
    IF NEW.trang_thai <> OLD.trang_thai THEN
        IF NOT (
               (OLD.trang_thai = 'Scheduled'
                    AND NEW.trang_thai IN ('In-Consultation', 'Cancelled', 'No-Show'))
            OR (OLD.trang_thai = 'In-Consultation'
                    AND NEW.trang_thai IN ('Referred', 'Completed'))
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Chuyển đổi trạng thái lịch hẹn không hợp lệ.';
        END IF;
    END IF;
END$$

DELIMITER ;
