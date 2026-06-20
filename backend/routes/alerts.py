from flask import Blueprint, jsonify, request
from services.alerts_service import alerts_service

alerts_bp = Blueprint('alerts', __name__, url_prefix='/api')

@alerts_bp.route('/alerts', methods=['GET'])
def get_alerts():
    """Returns the list of current active alerts."""
    try:
        alerts = alerts_service.get_active_alerts()
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@alerts_bp.route('/alerts/acknowledge', methods=['POST'])
def acknowledge_alert():
    """Manually dismisses/acknowledges an active alert."""
    try:
        data = request.get_json() or {}
        alert_id = data.get("alert_id")
        
        if not alert_id:
            return jsonify({"error": "alert_id is required."}), 400
            
        success = alerts_service.acknowledge_alert(alert_id)
        if success:
            return jsonify({"message": f"Alert {alert_id} acknowledged successfully."}), 200
        else:
            return jsonify({"error": f"Alert {alert_id} is not active or could not be found."}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@alerts_bp.route('/alerts/test', methods=['POST'])
def test_sms_alert():
    """Triggers a test Twilio SMS alert dispatch."""
    try:
        data = request.get_json() or {}
        message = data.get("message", "Smart Pest Detector AI Alert: Test dispatch completed successfully.")
        alerts_service.send_sms_alert(message)
        return jsonify({
            "status": "success",
            "message": "Test SMS dispatch initiated.",
            "details": "Check python server logs to view Twilio transmission or mock logs."
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
