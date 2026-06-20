import os
import sqlite3
import json
import logging
from werkzeug.security import generate_password_hash, check_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("UserModel")

DB_DIR = os.environ.get("BACKEND_DATA_DIR", "data")
DB_FILE = os.path.join(DB_DIR, "users.db")

class UserModel:
    def __init__(self):
        if not os.path.exists(DB_DIR):
            os.makedirs(DB_DIR, exist_ok=True)
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                role TEXT NOT NULL DEFAULT 'farmer',
                notification_prefs TEXT
            )
        """)
        conn.commit()
        
        # Seed an admin and farmer user if database is empty
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            logger.info("Database empty. Seeding initial users...")
            self.create_user(
                username="admin",
                password="adminpassword",
                email="admin@smartpestdetector.com",
                role="admin",
                notification_prefs={"channels": ["sms", "email"], "frequency": "instant"}
            )
            self.create_user(
                username="farmer",
                password="farmerpassword",
                email="farmer@smartpestdetector.com",
                role="farmer",
                notification_prefs={"channels": ["sms"], "frequency": "instant"}
            )
            self.create_user(
                username="agronomist",
                password="agronomistpassword",
                email="agronomist@smartpestdetector.com",
                role="agronomist",
                notification_prefs={"channels": ["email"], "frequency": "daily"}
            )
        conn.close()

    def create_user(self, username, password, email=None, role="farmer", notification_prefs=None):
        if not username or not password:
            return False, "Username and password are required."
            
        password_hash = generate_password_hash(password)
        prefs_json = json.dumps(notification_prefs or {"channels": ["email"], "frequency": "instant"})
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password_hash, email, role, notification_prefs) VALUES (?, ?, ?, ?, ?)",
                (username, password_hash, email, role, prefs_json)
            )
            conn.commit()
            conn.close()
            return True, "User registered successfully."
        except sqlite3.IntegrityError:
            return False, f"Username '{username}' is already taken."
        except Exception as e:
            return False, str(e)

    def get_user_by_username(self, username):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        conn.close()
        if row:
            user = dict(row)
            try:
                user["notification_prefs"] = json.loads(user["notification_prefs"])
            except Exception:
                user["notification_prefs"] = {"channels": ["email"], "frequency": "instant"}
            return user
        return None

    def get_user_by_id(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            user = dict(row)
            try:
                user["notification_prefs"] = json.loads(user["notification_prefs"])
            except Exception:
                user["notification_prefs"] = {"channels": ["email"], "frequency": "instant"}
            return user
        return None

    def verify_password(self, user, password):
        return check_password_hash(user["password_hash"], password)

    def update_notification_prefs(self, username, prefs):
        prefs_json = json.dumps(prefs)
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET notification_prefs = ? WHERE username = ?",
                (prefs_json, username)
            )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Failed to update notification preferences: {e}")
            return False

# Singleton instance
user_model = UserModel()
