-- =====================================================================
--  TRUY VAN PHUC TAP - luyen bao ve SQL ca nhan (15%)
--  Chia 3 mang, moi thanh vien phu trach 1 mang (2 truy van).
--  CSDL: healthcare_clinic
-- =====================================================================

USE healthcare_clinic;

-- #####################################################################
-- THANH VIEN 1 - BAC SI & LICH HEN
-- #####################################################################

-- Q1. Hieu suat bac si: tong lich hen, ty le hoan thanh, ty le vang mat,
--     va xep hang do ban ron bang HAM CUA SO (RANK).
--     Ky thuat: LEFT JOIN, dem co dieu kien (SUM(dieu_kien)),
--     NULLIF tranh chia 0, window function tren ket qua da GROUP BY.
SELECT
    b.ma_bac_si,
    b.ho_va_ten,
    b.loai_bac_si,
    COUNT(l.ma_lich_hen)                                   AS tong_lich_hen,
    SUM(l.trang_thai = 'Completed')                        AS da_hoan_thanh,
    SUM(l.trang_thai = 'No-Show')                          AS vang_mat,
    ROUND(100 * SUM(l.trang_thai = 'Completed')
          / NULLIF(COUNT(l.ma_lich_hen), 0), 1)            AS ty_le_hoan_thanh_pct,
    RANK() OVER (ORDER BY COUNT(l.ma_lich_hen) DESC)       AS xep_hang_ban_ron
FROM bac_si b
LEFT JOIN lich_hen_kham l ON l.ma_bac_si = b.ma_bac_si
GROUP BY b.ma_bac_si, b.ho_va_ten, b.loai_bac_si
ORDER BY tong_lich_hen DESC
LIMIT 10;


-- Q2. Ngay ban ron nhat cua tung bac si.
--     Ky thuat: CTE + ROW_NUMBER() PARTITION BY (chia nhom theo bac si,
--     xep hang trong tung nhom), sau do loc hang = 1.
WITH thong_ke_ngay AS (
    SELECT
        ma_bac_si,
        DATE(thoi_gian_hen) AS ngay_kham,
        COUNT(*)            AS so_ca,
        ROW_NUMBER() OVER (
            PARTITION BY ma_bac_si
            ORDER BY COUNT(*) DESC
        ) AS hang
    FROM lich_hen_kham
    GROUP BY ma_bac_si, DATE(thoi_gian_hen)
)
SELECT t.ma_bac_si, b.ho_va_ten, t.ngay_kham, t.so_ca
FROM thong_ke_ngay t
JOIN bac_si b ON b.ma_bac_si = t.ma_bac_si
WHERE t.hang = 1
ORDER BY t.so_ca DESC
LIMIT 10;


-- #####################################################################
-- THANH VIEN 2 - HO SO BENH AN & CHUYEN TUYEN
-- #####################################################################

-- Q3. Luong chuyen tuyen day du: benh nhan, bac si GP, chuyen khoa,
--     bac si chuyen khoa nhan, chan doan tu ho so.
--     Ky thuat: JOIN 6 bang (co LEFT JOIN ho so), nhieu alias.
SELECT
    pct.ma_chuyen_tuyen,
    bn.ho_va_ten        AS benh_nhan,
    gp.ho_va_ten        AS bac_si_gp,
    ck.ten_chuyen_khoa,
    cks.ho_va_ten       AS bac_si_nhan,
    hs.chan_doan,
    pct.trang_thai
FROM phieu_chuyen_tuyen pct
JOIN lich_hen_kham l   ON l.ma_lich_hen   = pct.ma_lich_hen
JOIN benh_nhan bn      ON bn.ma_benh_nhan = l.ma_benh_nhan
JOIN bac_si gp         ON gp.ma_bac_si    = pct.ma_bac_si_gp
JOIN bac_si cks        ON cks.ma_bac_si   = pct.ma_bac_si_nhan
JOIN chuyen_khoa ck    ON ck.ma_chuyen_khoa = pct.ma_chuyen_khoa
LEFT JOIN ho_so_benh_an hs ON hs.ma_lich_hen = l.ma_lich_hen
ORDER BY pct.ma_chuyen_tuyen
LIMIT 10;


-- Q4. Benh nhan tai kham nhieu (>= 2 ho so benh an) kem tuoi va so lan
--     da hoan tat ho so.
--     Ky thuat: CTE + GROUP BY + HAVING, dem co dieu kien (SUM(dieu_kien)),
--     ham ngay TIMESTAMPDIFF tinh tuoi.
WITH thong_ke_ho_so AS (
    SELECT
        ma_benh_nhan,
        COUNT(*)                         AS tong_ho_so,
        SUM(trang_thai = 'Finalized')    AS so_hoan_tat
    FROM ho_so_benh_an
    GROUP BY ma_benh_nhan
    HAVING COUNT(*) >= 2
)
SELECT
    bn.ma_benh_nhan,
    bn.ho_va_ten,
    TIMESTAMPDIFF(YEAR, bn.ngay_sinh, CURDATE()) AS tuoi,
    t.tong_ho_so,
    t.so_hoan_tat
FROM thong_ke_ho_so t
JOIN benh_nhan bn ON bn.ma_benh_nhan = t.ma_benh_nhan
ORDER BY t.tong_ho_so DESC, tuoi DESC
LIMIT 10;


-- #####################################################################
-- THANH VIEN 3 - DON THUOC & DUOC
-- #####################################################################

-- Q5. Canh bao di ung: voi moi benh nhan co khai bao di ung, liet ke cac
--     di nguyen va DEM so thuoc trong danh muc can tranh ke cho ho.
--     Ky thuat: JOIN voi dieu kien ghep (OR), GROUP_CONCAT gom di nguyen,
--     dem DISTINCT thuoc trung. Huu ich cho duoc si khi kiem tra don.
SELECT
    bn.ma_benh_nhan,
    bn.ho_va_ten,
    GROUP_CONCAT(DISTINCT du.ten_di_nguyen ORDER BY du.ten_di_nguyen
                 SEPARATOR ', ')            AS cac_di_nguyen,
    COUNT(DISTINCT tm.ma_thuoc)             AS so_thuoc_can_tranh
FROM benh_nhan bn
JOIN di_ung_benh_nhan du ON du.ma_benh_nhan = bn.ma_benh_nhan
LEFT JOIN danh_muc_thuoc tm
       ON LOWER(TRIM(tm.hoat_chat))    = LOWER(TRIM(du.ten_di_nguyen))
       OR LOWER(TRIM(tm.ten_biet_duoc)) = LOWER(TRIM(du.ten_di_nguyen))
GROUP BY bn.ma_benh_nhan, bn.ho_va_ten
ORDER BY so_thuoc_can_tranh DESC, bn.ma_benh_nhan
LIMIT 10;

-- Q5b (bo sung). Kiem tra AN TOAN toan he thong: tim don thuoc da ke trung
--     thuoc benh nhan di ung. Ket qua RONG = khong co vi pham (dung mong doi).
SELECT
    dt.ma_don_thuoc,
    bn.ho_va_ten AS benh_nhan,
    tm.ten_biet_duoc,
    du.ten_di_nguyen
FROM don_thuoc dt
JOIN ho_so_benh_an hs      ON hs.ma_ho_so     = dt.ma_ho_so
JOIN benh_nhan bn          ON bn.ma_benh_nhan = hs.ma_benh_nhan
JOIN chi_tiet_don_thuoc ct ON ct.ma_don_thuoc = dt.ma_don_thuoc
JOIN danh_muc_thuoc tm     ON tm.ma_thuoc     = ct.ma_thuoc
JOIN di_ung_benh_nhan du   ON du.ma_benh_nhan = bn.ma_benh_nhan
    AND ( LOWER(TRIM(du.ten_di_nguyen)) = LOWER(TRIM(tm.hoat_chat))
       OR LOWER(TRIM(du.ten_di_nguyen)) = LOWER(TRIM(tm.ten_biet_duoc)) );


-- Q6. Top thuoc duoc ke nhieu nhat kem TY LE % tren tong toan he thong.
--     Ky thuat: window dong tren ham tong hop - SUM(SUM(...)) OVER ()
--     de lay tong toan cuc trong khi van GROUP BY tung thuoc.
SELECT
    tm.ma_thuoc,
    tm.ten_biet_duoc,
    SUM(ct.so_luong)                       AS tong_so_luong_ke,
    COUNT(DISTINCT ct.ma_don_thuoc)        AS so_don_dung,
    ROUND(100 * SUM(ct.so_luong)
          / SUM(SUM(ct.so_luong)) OVER (), 2) AS ty_le_pct
FROM chi_tiet_don_thuoc ct
JOIN danh_muc_thuoc tm ON tm.ma_thuoc = ct.ma_thuoc
GROUP BY tm.ma_thuoc, tm.ten_biet_duoc
ORDER BY tong_so_luong_ke DESC
LIMIT 10;
