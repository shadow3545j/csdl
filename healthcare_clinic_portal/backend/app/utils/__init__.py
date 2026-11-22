
from flask import Flask, jsonify
from flask_cors import CORS

from app.config import Config
from app.utils.error_handler import register_error_handlers

from app.routes.patient_routes import patient_bp
from app.routes.doctor_routes import doctor_bp


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

    app.register_blueprint(patient_bp)
    app.register_blueprint(doctor_bp)

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

    @app.route("/api/health/database", methods=["GET"])
    def database_health():
        from app.database.connection import check_database_connection

        result = check_database_connection()
        connected = result["success"]

        return jsonify({
            "success": connected,
            "message": (
                "Database connection successful"
                if connected
                else result.get("message", "Database connection failed")
            ),
            "data": result
        }), 200 if connected else 503

    return app
