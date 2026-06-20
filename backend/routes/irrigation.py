import threading
import time
import datetime
from flask import Blueprint, request, jsonify
from services.sensor_service import sensor_service

irrigation_bp = Blueprint('irrigation', __name__, url_prefix='/api/irrigation')

auto_mode = False
schedules = [
    {"id": 1, "time": "06:00", "duration": 10, "active": True},
    {"id": 2, "time": "18:00", "duration": 15, "active": True}
]
schedule_id_counter = 3
lock = threading.Lock()

# Track when a schedule was last triggered to avoid triggering it multiple times in the same minute
last_triggered = {}

def schedule_checker_loop():
    global auto_mode, schedules, last_triggered
    while True:
        try:
            if auto_mode:
                now = datetime.datetime.now()
                current_time_str = now.strftime("%H:%M")
                
                with lock:
                    for sched in schedules:
                        if sched["active"] and sched["time"] == current_time_str:
                            sched_id = sched["id"]
                            # Check if already triggered in the last 60 seconds
                            if last_triggered.get(sched_id) != current_time_str:
                                last_triggered[sched_id] = current_time_str
                                duration = sched["duration"]
                                print(f"[Irrigation Scheduler] Triggering schedule {sched_id} for {duration} mins.")
                                
                                # Turn pump on
                                sensor_service.set_pump_state(True)
                                
                                # Start a background timer thread to turn it off after duration
                                # In simulated mode, duration in minutes is run as seconds so it's easy to verify
                                is_sim = sensor_service.sensor_mode == "simulated"
                                sleep_time = duration if is_sim else duration * 60
                                
                                def turn_off_after_delay(delay):
                                    time.sleep(delay)
                                    sensor_service.set_pump_state(False)
                                    print(f"[Irrigation Scheduler] Schedule completed. Pump turned off.")
                                    
                                threading.Thread(target=turn_off_after_delay, args=(sleep_time,), daemon=True).start()
                                
        except Exception as e:
            print(f"Error in schedule checker: {e}")
        time.sleep(10)

# Start schedule checker thread
threading.Thread(target=schedule_checker_loop, daemon=True).start()

@irrigation_bp.route('/pump', methods=['GET'])
def get_pump_status():
    global auto_mode
    return jsonify({
        "pump_active": sensor_service.pump_active,
        "auto_mode": auto_mode,
        "soil_moisture": sensor_service.soil_moisture
    }), 200

@irrigation_bp.route('/pump/toggle', methods=['POST'])
def toggle_pump():
    new_state = sensor_service.toggle_pump()
    return jsonify({
        "pump_active": new_state,
        "message": f"Pump {'activated' if new_state else 'deactivated'} successfully."
    }), 200

@irrigation_bp.route('/auto_mode', methods=['POST'])
def set_auto_mode():
    global auto_mode
    data = request.get_json() or {}
    if "auto_mode" in data:
        auto_mode = bool(data["auto_mode"])
    else:
        auto_mode = not auto_mode
    return jsonify({
        "auto_mode": auto_mode,
        "message": f"Auto irrigation mode {'enabled' if auto_mode else 'disabled'}."
    }), 200

@irrigation_bp.route('/schedules', methods=['GET'])
def get_schedules():
    global schedules
    with lock:
        return jsonify(schedules), 200

@irrigation_bp.route('/schedules', methods=['POST'])
def add_schedule():
    global schedules, schedule_id_counter
    data = request.get_json() or {}
    time_str = data.get("time")
    duration = data.get("duration")
    
    if not time_str or duration is None:
        return jsonify({"error": "Missing 'time' or 'duration'"}), 400
        
    try:
        duration = int(duration)
    except ValueError:
        return jsonify({"error": "Duration must be an integer"}), 400
        
    with lock:
        new_sched = {
            "id": schedule_id_counter,
            "time": time_str,
            "duration": duration,
            "active": True
        }
        schedule_id_counter += 1
        schedules.append(new_sched)
        return jsonify(new_sched), 201

@irrigation_bp.route('/schedules/<int:sched_id>', methods=['DELETE'])
def delete_schedule(sched_id):
    global schedules
    with lock:
        for i, sched in enumerate(schedules):
            if sched["id"] == sched_id:
                schedules.pop(i)
                return jsonify({"message": f"Schedule {sched_id} deleted."}), 200
        return jsonify({"error": "Schedule not found"}), 404

@irrigation_bp.route('/schedules/<int:sched_id>/toggle', methods=['POST'])
def toggle_schedule(sched_id):
    global schedules
    with lock:
        for sched in schedules:
            if sched["id"] == sched_id:
                sched["active"] = not sched["active"]
                return jsonify(sched), 200
        return jsonify({"error": "Schedule not found"}), 404
