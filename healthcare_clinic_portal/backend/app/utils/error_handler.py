
from flask import jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app):

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return jsonify({
            "success": False,
            "message": error.description,
            "data": None
        }), error.code

    @app.errorhandler(Exception)
    def handle_server_error(error):
        app.logger.exception("Unhandled server error: %s", error)

        return jsonify({
            "success": False,
            "message": "Lỗi máy chủ nội bộ",
            "data": None
        }), 500
