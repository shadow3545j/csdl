
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

# Đọc file .env và ưu tiên giá trị trong file này
load_dotenv(ENV_FILE, override=True, encoding="utf-8")


class Config:

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")

    DEBUG = os.getenv("DEBUG", "True").lower() == "true"

    # ==========================================
    # SESSION CONFIGURATION
    # ==========================================

    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False

    # ==========================================
    # MYSQL CONFIGURATION
    # ==========================================

    MYSQL_CONFIG = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", 3306)),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "healthcare_clinic"),
        "charset": "utf8mb4",
        "collation": "utf8mb4_unicode_ci",
        "use_unicode": True,
        "connection_timeout": 10,
        "autocommit": False
    }

    # ==========================================
    # FRONTEND CONFIGURATION
    # ==========================================

    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://127.0.0.1:5500,http://localhost:5500"
        ).split(",")
        if origin.strip()
    ]
