-- =====================================================================
--  Stored procedures cho Healthcare Clinic Portal
--  - sp_dat_lich_hen   : dat lich kham (kiem tra ca lam viec + chong trung lich)
--  - sp_cap_phat_thuoc : cap phat don thuoc dang Active
--
--  Nap vao CSDL:
--    mysql -u root -p healthcare_clinic < backend/sql/stored_procedures.sql
-- =====================================================================

USE healthcare_clinic;

-- ---------------------------------------------------------------------
-- 1. DAT LICH HEN KHAM
--    Thoi luong co dinh 30 phut.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_dat_lich_hen;

DELIMITER $$

CREATE PROCEDURE sp_dat_lich_hen(
    IN p_ma_lich_hen    VARCHAR(20),
    IN p_ma_benh_nhan   VARCHAR(20),
    IN p_ma_bac_si      VARCHAR(20),
    IN p_thoi_gian_hen  DATETIME,
    IN p_loai_hinh_kham VARCHAR(30),
    IN p_ma_phien_kham  VARCHAR(20),
    IN p_duong_dan_video VARCHAR(255),
    IN p_khoa_ma_hoa    VARCHAR(255)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_gio   TIME;

    SET v_gio = TIME(p_thoi_gian_hen);

    -- 1. Bệnh nhân phải tồn tại
    IF NOT EXISTS (SELECT 1 FROM benh_nhan WHERE ma_benh_nhan = p_ma_benh_nhan) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bệnh nhân không tồn tại.';
    END IF;

    -- 2. Bác sĩ phải tồn tại
    IF NOT EXISTS (SELECT 1 FROM bac_si WHERE ma_bac_si = p_ma_bac_si) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bác sĩ không tồn tại.';
    END IF;

    -- 3. Loại hình khám hợp lệ
    IF p_loai_hinh_kham NOT IN ('In-clinic', 'Telemedicine') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Loại hình khám phải là In-clinic hoặc Telemedicine.';
    END IF;

    -- 4. Lịch hẹn (30 phút) phải nằm trọn trong một ca làm việc của bác sĩ
    IF NOT EXISTS (
        SELECT 1 FROM lich_lam_viec_bac_si
        WHERE ma_bac_si = p_ma_bac_si
          AND ngay_lam_viec = DATE(p_thoi_gian_hen)
          AND v_gio >= gio_bat_dau
          AND ADDTIME(v_gio, '00:30:00') <= gio_ket_thuc
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lịch hẹn không nằm trong ca làm việc của bác sĩ.';
    END IF;

    -- 5. Bác sĩ không được trùng lịch (khung 30 phút) với lịch đang hiệu lực
    SELECT COUNT(*) INTO v_count FROM lich_hen_kham
    WHERE ma_bac_si = p_ma_bac_si
      AND trang_thai NOT IN ('Cancelled', 'No-Show')
      AND ABS(TIMESTAMPDIFF(MINUTE, thoi_gian_hen, p_thoi_gian_hen)) < 30;
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bác sĩ đã có lịch hẹn trùng khung giờ này.';
    END IF;

    -- 6. Bệnh nhân không được trùng lịch (khung 30 phút) với lịch đang hiệu lực
    SELECT COUNT(*) INTO v_count FROM lich_hen_kham
    WHERE ma_benh_nhan = p_ma_benh_nhan
      AND trang_thai NOT IN ('Cancelled', 'No-Show')
      AND ABS(TIMESTAMPDIFF(MINUTE, thoi_gian_hen, p_thoi_gian_hen)) < 30;
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bệnh nhân đã có lịch hẹn trùng khung giờ này.';
    END IF;

    -- 7. Khám từ xa phải có đủ thông tin phiên khám
    IF p_loai_hinh_kham = 'Telemedicine'
       AND (p_ma_phien_kham IS NULL OR p_duong_dan_video IS NULL OR p_khoa_ma_hoa IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khám từ xa phải có mã phiên, đường dẫn video và khóa mã hóa.';
    END IF;

    -- 8. Tạo lịch hẹn (mặc định Scheduled)
    INSERT INTO lich_hen_kham (
        ma_lich_hen, ma_benh_nhan, ma_bac_si,
        thoi_gian_hen, loai_hinh_kham, trang_thai
    ) VALUES (
        p_ma_lich_hen, p_ma_benh_nhan, p_ma_bac_si,
        p_thoi_gian_hen, p_loai_hinh_kham, 'Scheduled'
    );

    -- 9. Nếu là khám từ xa: tạo phiên khám từ xa đi kèm
    IF p_loai_hinh_kham = 'Telemedicine' THEN
        INSERT INTO phien_kham_tu_xa (
            ma_phien_kham, ma_lich_hen, duong_dan_video, khoa_ma_hoa
        ) VALUES (
            p_ma_phien_kham, p_ma_lich_hen, p_duong_dan_video, p_khoa_ma_hoa
        );
    END IF;
END$$

DELIMITER ;


-- ---------------------------------------------------------------------
-- 2. CAP PHAT DON THUOC
--    Chi cap phat don thuoc dang o trang thai Active.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_cap_phat_thuoc;

DELIMITER $$

CREATE PROCEDURE sp_cap_phat_thuoc(
    IN p_ma_don_thuoc VARCHAR(20)
)
BEGIN
    DECLARE v_status VARCHAR(30) DEFAULT NULL;

    -- Lấy trạng thái hiện tại (MAX bảo đảm luôn có đúng 1 dòng, NULL nếu không tồn tại)
    SELECT MAX(trang_thai) INTO v_status
    FROM don_thuoc
    WHERE ma_don_thuoc = p_ma_don_thuoc;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không tìm thấy đơn thuốc.';
    END IF;

    IF v_status <> 'Active' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chỉ có thể cấp phát đơn thuốc đang ở trạng thái Active.';
    END IF;

    UPDATE don_thuoc
    SET trang_thai = 'Dispensed'
    WHERE ma_don_thuoc = p_ma_don_thuoc;
END$$

DELIMITER ;
