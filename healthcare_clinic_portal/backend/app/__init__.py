from pathlib import Path

from flask import (
    Flask,
    jsonify,
    send_from_directory,
    redirect,
    session
)
from flask_cors import CORS

from app.config import Config
from app.utils.error_handler import register_error_handlers
from app.database.connection import check_database_connection

from app.routes import (
    patient_bp,
    doctor_bp,
    appointment_bp,
    medical_record_bp,
    prescription_bp,
    dashboard_bp,
    specialty_bp,
    medicine_bp,
    referral_bp
)

from app.routes.auth_routes import auth_bp
from app.routes.demo_data_routes import demo_data_bp
from app.routes.demo_clinical_routes import demo_clinical_bp


# ==========================================
# 1. XÁC ĐỊNH THƯ MỤC FRONTEND
# ==========================================

BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"


# ==========================================
# 2. KHỞI TẠO FLASK
# ==========================================

def create_app():

    app = Flask(__name__)

    app.config.from_object(Config)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": Config.FRONTEND_ORIGINS
            }
        }
    )

    register_error_handlers(app)

    # ======================================
    # 3. ĐĂNG KÝ API BLUEPRINT
    # ======================================

    app.register_blueprint(patient_bp)
    app.register_blueprint(doctor_bp)
    app.register_blueprint(appointment_bp)
    app.register_blueprint(medical_record_bp)
    app.register_blueprint(prescription_bp)
    app.register_blueprint(specialty_bp)
    app.register_blueprint(medicine_bp)
    app.register_blueprint(referral_bp)

    app.register_blueprint(auth_bp)
    app.register_blueprint(demo_data_bp)
    app.register_blueprint(demo_clinical_bp)
    app.register_blueprint(dashboard_bp)

    # ======================================
    # 4. TRANG CHỦ
    # ======================================

    @app.route("/")
    def home():

        if session.get("ma_tai_khoan"):
            return redirect("/dashboard")

        return redirect("/login")

    # ======================================
    # 5. TRANG ĐĂNG NHẬP
    # ======================================

    @app.route("/login")
    def login_page():

        if session.get("ma_tai_khoan"):
            return redirect("/dashboard")

        return send_from_directory(
            str(FRONTEND_DIR / "pages"),
            "login.html"
        )

    # ======================================
    # 6. TRANG DASHBOARD
    # ======================================

    @app.route("/dashboard")
    def dashboard_page():

        if not session.get("ma_tai_khoan"):
            return redirect("/login")

        return send_from_directory(
            str(FRONTEND_DIR / "pages"),
            "index.html"
        )

    # ======================================
    # 7. CÁC TRANG HTML
    # ======================================

    @app.route("/pages/<path:filename>")
    def frontend_pages(filename):

        if filename == "index.html":

            if not session.get("ma_tai_khoan"):
                return redirect("/login")

            return redirect("/dashboard")

        if filename == "login.html":

            if session.get("ma_tai_khoan"):
                return redirect("/dashboard")

            return redirect("/login")

        return send_from_directory(
            str(FRONTEND_DIR / "pages"),
            filename
        )

    # ======================================
    # 8. CSS
    # ======================================

    @app.route("/css/<path:filename>")
    def frontend_css(filename):

        return send_from_directory(
            str(FRONTEND_DIR / "css"),
            filename
        )

    # ======================================
    # 9. JAVASCRIPT
    # ======================================

    @app.route("/js/<path:filename>")
    def frontend_js(filename):

        return send_from_directory(
            str(FRONTEND_DIR / "js"),
            filename
        )

    # ======================================
    # 10. COMPONENTS
    # ======================================

    @app.route("/components/<path:filename>")
    def frontend_components(filename):

        return send_from_directory(
            str(FRONTEND_DIR / "components"),
            filename
        )

    # ======================================
    # 11. ASSETS
    # ======================================

    @app.route("/assets/<path:filename>")
    def frontend_assets(filename):

        return send_from_directory(
            str(FRONTEND_DIR / "assets"),
            filename
        )

    # ======================================
    # 12. KIỂM TRA BACKEND
    # ======================================

    @app.route("/api/health", methods=["GET"])
    def health_check():

        return jsonify({
            "success": True,
            "message": "Healthcare Clinic API is running",
            "data": {
                "application": "Healthcare Clinic Portal",
                "status": "online"
            }
        }), 200

    # ======================================
    # 13. KIỂM TRA MYSQL
    # ======================================

    @app.route("/api/health/database", methods=["GET"])
    def database_health():

        result = check_database_connection()
        connected = result["success"]

        return jsonify({
            "success": connected,
            "message": (
                "Database connection successful"
                if connected
                else result.get(
                    "message",
                    "Database connection failed"
                )
            ),
            "data": result
        }), 200 if connected else 503

    return app