from flask import Blueprint, jsonify
from services.session_manager import session_manager

reports_bp = Blueprint('reports', __name__, url_prefix='/api')

@reports_bp.route('/reports', methods=['GET'])
def get_all_reports():
    """Returns a list of all completed and archived crop sessions."""
    try:
        sessions = session_manager.get_all_sessions()
        # Clean session objects of large raw logs list for performance in lists
        list_data = []
        for s in sessions:
            list_data.append({
                "id": s["id"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "summary_stats": s.get("summary_stats", {}),
                "status": s["status"]
            })
        return jsonify(list_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/reports/<session_id>', methods=['GET'])
def get_report_detail(session_id):
    """Returns full details of a specific session by ID, including the LLM summary."""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            # Check if active session matches ID
            active = session_manager.active_session
            if active and active["id"] == session_id:
                return jsonify(active), 200
            return jsonify({"error": f"Session {session_id} not found."}), 404
        return jsonify(session), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/reports/session/active', methods=['GET'])
def get_active_session_status():
    """Returns status of the currently running session."""
    try:
        active = session_manager.get_active_session()
        # Return summary count
        pest_counts = {}
        for d in active["pest_detections"]:
            species = d.get("species")
            if species:
                pest_counts[species] = pest_counts.get(species, 0) + 1
                
        return jsonify({
            "id": active["id"],
            "start_time": active["start_time"],
            "pest_count": len(active["pest_detections"]),
            "pest_summary": pest_counts,
            "telemetry_count": len(active["telemetry_logs"]),
            "status": "active"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/reports/session/end', methods=['POST'])
def end_session():
    """Ends the current active session, compiles statistics, runs Ollama reports, and saves."""
    try:
        archived = session_manager.end_active_session()
        if not archived:
            return jsonify({"message": "No active session was running."}), 400
        return jsonify({
            "message": "Session ended and compiled successfully.",
            "session": archived
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
