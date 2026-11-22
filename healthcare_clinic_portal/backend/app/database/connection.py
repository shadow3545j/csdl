
import mysql.connector
from mysql.connector import Error
from app.config import Config


def get_db_connection():
    try:
        return mysql.connector.connect(**Config.MYSQL_CONFIG)
    except Error as error:
        print(f"MySQL connection error: {error}")
        raise


def check_database_connection():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE()")
        result = cursor.fetchone()

        database_name = result[0] if result else None

        return {
            "success": database_name == "healthcare_clinic",
            "database": database_name
        }

    except Error as error:
        return {
            "success": False,
            "message": str(error)
        }

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()
