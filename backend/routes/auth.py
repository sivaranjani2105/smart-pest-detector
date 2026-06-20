from flask import Blueprint, request, jsonify, session
from models.user_model import user_model

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    email = data.get("email", "").strip()
    role = data.get("role", "farmer").strip()
    prefs = data.get("notification_prefs", {"channels": ["email"], "frequency": "instant"})

    if role not in ["farmer", "agronomist", "admin"]:
        return jsonify({"error": "Invalid role selection. Must be farmer, agronomist, or admin."}), 400

    success, message = user_model.create_user(
        username=username,
        password=password,
        email=email,
        role=role,
        notification_prefs=prefs
    )
    if success:
        return jsonify({"status": "success", "message": message}), 201
    else:
        return jsonify({"error": message}), 400

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    user = user_model.get_user_by_username(username)
    if user and user_model.verify_password(user, password):
        session.clear()
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["role"] = user["role"]
        
        return jsonify({
            "status": "success",
            "message": "Logged in successfully.",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "role": user["role"],
                "email": user["email"],
                "notification_prefs": user["notification_prefs"]
            }
        }), 200
    else:
        return jsonify({"error": "Invalid username or password."}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success", "message": "Logged out successfully."}), 200

@auth_bp.route('/me', methods=['GET'])
def get_me():
    if "user_id" in session:
        user = user_model.get_user_by_id(session["user_id"])
        if user:
            return jsonify({
                "authenticated": True,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "role": user["role"],
                    "email": user["email"],
                    "notification_prefs": user["notification_prefs"]
                }
            }), 200
            
    return jsonify({"authenticated": False, "error": "Not authenticated."}), 401

@auth_bp.route('/preferences', methods=['POST'])
def update_preferences():
    if "username" not in session:
        return jsonify({"error": "Unauthorized: Please log in first."}), 401
        
    data = request.get_json() or {}
    prefs = data.get("notification_prefs")
    if not prefs:
        return jsonify({"error": "Notification preferences payload required."}), 400

    success = user_model.update_notification_prefs(session["username"], prefs)
    if success:
        return jsonify({"status": "success", "message": "Notification preferences updated successfully."}), 200
    else:
        return jsonify({"error": "Failed to update notification preferences."}), 500
