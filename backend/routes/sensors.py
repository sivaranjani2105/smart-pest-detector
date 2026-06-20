from flask import Blueprint, jsonify, request
from services.sensor_service import sensor_service
from services.yolo_service import yolo_service
from services.rover_service import rover_service
from services.mqtt_service import mqtt_service
from services.pest_risk_service import pest_risk_service

sensors_bp = Blueprint('sensors', __name__, url_prefix='/api')

@sensors_bp.route('/sensors', methods=['GET'])
def get_sensors():
    """Returns the latest sensor readings from the hardware/simulator."""
    try:
        readings = sensor_service.get_latest_readings()
        return jsonify(readings), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sensors_bp.route('/model/export', methods=['POST'])
def export_model():
    """Exports YOLOv11 model to ONNX format for Raspberry Pi / edge deployment."""
    try:
        if yolo_service.model is not None:
            # Ultralytics model.export() returns the exported filename path
            exported_path = yolo_service.model.export(format="onnx")
            return jsonify({
                "status": "success",
                "message": "YOLO model exported to ONNX format successfully.",
                "path": exported_path
            }), 200
        else:
            # Return mock export path for simulation mode if YOLO model is not loaded
            return jsonify({
                "status": "simulated_success",
                "message": "Mock model exported to ONNX (Simulation Mode).",
                "path": "models/yolo11n.onnx"
            }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sensors_bp.route('/weather', methods=['GET'])
def get_weather():
    """Returns simulated weather data for California farm coordinate (spraying recommendation)."""
    import random
    import time
    try:
        # Simulate slight variations
        wind_speed = round(random.uniform(5.0, 22.0), 1)
        rain_probability = round(random.uniform(0.0, 85.0), 1)
        temp = round(random.uniform(18.0, 32.0), 1)
        
        return jsonify({
            "wind_speed_kmh": wind_speed,
            "rain_probability_pct": rain_probability,
            "temp_c": temp,
            "gps": {"lat": 36.7783, "lng": -119.4179},
            "timestamp": time.time()
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sensors_bp.route('/rover/telemetry', methods=['GET'])
def get_rover_telemetry():
    """Returns the live status, battery levels and GPS path coordinates of the rover."""
    return jsonify(rover_service.get_telemetry()), 200

@sensors_bp.route('/rover/waypoints', methods=['POST'])
def update_rover_waypoints():
    """Accepts list of waypoints coordinates and saves them as the active route."""
    try:
        data = request.get_json() or {}
        waypoints = data.get("waypoints", [])
        rover_service.set_waypoints(waypoints)
        return jsonify({"status": "success", "message": f"Configured {len(waypoints)} custom route waypoints."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sensors_bp.route('/rover/run', methods=['POST'])
def start_rover_run():
    """Triggers manual autonomous scan run."""
    rover_service.start_manual_run()
    return jsonify({"status": "success", "message": "Manual scan run initiated."}), 200

@sensors_bp.route('/rover/pause', methods=['POST'])
def toggle_rover_pause():
    """Toggles pause/resume of the autonomous scan run."""
    new_status = rover_service.toggle_paused()
    return jsonify({"status": "success", "status_state": new_status}), 200

@sensors_bp.route('/rover/schedule', methods=['GET', 'POST'])
def manage_rover_schedule():
    """Handles configuring daily routes/times for rover scanning."""
    if request.method == 'POST':
        try:
            data = request.get_json() or {}
            schedule_list = data.get("schedule", [])
            rover_service.save_schedule(schedule_list)
            return jsonify({"status": "success", "message": "Schedule configurations updated."}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"status": "success", "schedule": rover_service.scheduled_runs}), 200

@sensors_bp.route('/sensors/health', methods=['GET'])
def get_sensors_health():
    """Returns heartbeats and network connectivity of IoT sensors nodes."""
    return jsonify(mqtt_service.get_sensors_status()), 200

@sensors_bp.route('/sensors/debug/offline', methods=['POST'])
def debug_force_node_offline():
    """Debug trigger to force a specific node offline for alert testing."""
    try:
        data = request.get_json() or {}
        node_id = data.get("node_id")
        success = mqtt_service.force_node_offline(node_id)
        if success:
            return jsonify({"status": "success", "message": f"Forced {node_id} offline."}), 200
        else:
            return jsonify({"error": f"Node {node_id} not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sensors_bp.route('/pest-risk', methods=['GET'])
def get_pest_risk():
    """Returns predictive composite pest risk indices for the 3x3 zones."""
    return jsonify({"status": "success", "zones": pest_risk_service.get_all_zones_risk()}), 200
