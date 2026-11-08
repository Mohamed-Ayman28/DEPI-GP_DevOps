import os
from collections.abc import Generator

import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def get_db() -> Generator:
    connection = mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', '3306')),
        user=os.getenv('DB_USER', 'event_user'),
        password=os.getenv('DB_PASSWORD', 'change-me-locally'),
        database=os.getenv('DB_NAME', 'event_planner'),
    )
    try:
        yield connection
    finally:
        connection.close()
