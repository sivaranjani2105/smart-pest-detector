import os
import time
import math
import random
import json
import threading
import logging
from extensions import socketio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RoverService")

DATA_DIR = os.environ.get("BACKEND_DATA_DIR", "data")
SCHEDULE_FILE = os.path.join(DATA_DIR, "rover_schedule.json")

class RoverService:
    def __init__(self):
        self.lock = threading.Lock()
        
        # Initial positions - matches Tamil Nadu farm center
        self.home_lat = 10.7905
        self.home_lng = 78.7047
        
        # Rover Status Parameters
        self.gps_lat = self.home_lat
        self.gps_lng = self.home_lng
        self.battery_pct = 100.0
        self.speed_mps = 0.0          # Meters per second
        self.heading_deg = 0.0        # Heading angle
        self.signal_rssi = -55.0      # dBm
        self.motor_temp_c = 38.0      # Motor Temp C
        self.status = "docked"        # docked, navigating, safety_stop, low_battery_return, paused
        
        # Default scan route waypoints in Tamil Nadu
        self.default_waypoints = [
            {"lat": 10.7905, "lng": 78.7047, "label": "Dock"},
            {"lat": 10.7910, "lng": 78.7047, "label": "Row 1 Start"},
            {"lat": 10.7910, "lng": 78.7057, "label": "Row 1 End"},
            {"lat": 10.7907, "lng": 78.7057, "label": "Row 2 Start"},
            {"lat": 10.7907, "lng": 78.7047, "label": "Row 2 End"},
            {"lat": 10.7905, "lng": 78.7047, "label": "Dock"}
        ]
        self.waypoints = list(self.default_waypoints)
        self.current_waypoint_idx = 0
        
        # Scheduled Runs
        self.scheduled_runs = []
        self._load_schedule()
        
        self.running = False
        self.thread = None
        self.last_update_time = time.time()
        self.safety_stop_timeout = 0.0

    def start(self):
        """Starts the Rover simulation navigation update loop."""
        self.running = True
        self.thread = threading.Thread(target=self._navigation_loop, daemon=True)
        self.thread.start()
        logger.info("Rover autonomous navigation thread started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)

    def trigger_safety_stop(self):
        """Hard safety stop - instantly zero speed and pause rover movements."""
        with self.lock:
            self.status = "safety_stop"
            self.speed_mps = 0.0
            self.safety_stop_timeout = time.time() + 8.0 # Lock stop for 8 seconds
            logger.warning("[SAFETY STOP] Human detected in frame! Hardware brakes engaged.")
            socketio.emit("rover_safety_alert", {"message": "Emergency Stop engaged: Human in frame!"})

    def set_waypoints(self, new_waypoints):
        with self.lock:
            if not new_waypoints:
                self.waypoints = list(self.default_waypoints)
            else:
                self.waypoints = new_waypoints
            self.current_waypoint_idx = 0
            logger.info(f"Loaded {len(self.waypoints)} new navigation waypoints.")
            return True

    def toggle_paused(self):
        with self.lock:
            if self.status == "navigating":
                self.status = "paused"
                self.speed_mps = 0.0
            elif self.status == "paused":
                self.status = "navigating"
                self.speed_mps = 1.2
            return self.status

    def start_manual_run(self):
        with self.lock:
            self.status = "navigating"
            self.speed_mps = 1.2
            self.current_waypoint_idx = 0
            self.battery_pct = max(30.0, self.battery_pct) # ensure charge for test
            logger.info("Manual autonomous navigation run initiated.")
            return True

    def _load_schedule(self):
        if os.path.exists(SCHEDULE_FILE):
            try:
                with open(SCHEDULE_FILE, "r") as f:
                    self.scheduled_runs = json.load(f)
            except Exception:
                self.scheduled_runs = []
        else:
            # Default mock schedule: scan daily at 06:00 AM
            self.scheduled_runs = [
                {"id": "scan_morning", "time": "06:00", "label": "Daily Morning Scan"}
            ]

    def save_schedule(self, schedule_list):
        with self.lock:
            self.scheduled_runs = schedule_list
            try:
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(SCHEDULE_FILE, "w") as f:
                    json.dump(schedule_list, f, indent=2)
                logger.info("Saved rover autonomous schedule configurations.")
                return True
            except Exception as e:
                logger.error(f"Failed to save schedule file: {e}")
                return False

    def _navigation_loop(self):
        while self.running:
            now = time.time()
            dt = now - self.last_update_time
            self.last_update_time = now
            
            with self.lock:
                self._update_telemetry(dt)
                self._check_schedule()
                
            time.sleep(1.0)

    def _update_telemetry(self, dt):
        # 1. Safety stop timeout handler
        if self.status == "safety_stop":
            if time.time() > self.safety_stop_timeout:
                # auto-resume or go to paused
                self.status = "paused"
                logger.info("[SAFETY STOP] Timer cleared. Rover transitioned to paused.")
        
        # 2. Charging at Dock
        if self.status == "docked":
            self.speed_mps = 0.0
            self.heading_deg = 0.0
            self.battery_pct = min(100.0, self.battery_pct + 4.0 * dt)
            self.motor_temp_c = max(35.0, self.motor_temp_c - 1.0 * dt)
            self.gps_lat = self.home_lat
            self.gps_lng = self.home_lng
            
        # 3. Path following & battery depletion
        elif self.status in ["navigating", "low_battery_return"]:
            self.speed_mps = 1.2
            self.motor_temp_c = min(75.0, self.motor_temp_c + 0.8 * dt)
            
            # Deplete battery
            self.battery_pct = max(0.0, self.battery_pct - 0.15 * dt)
            
            # Low Battery Docking check
            if self.battery_pct < 20.0 and self.status == "navigating":
                self.status = "low_battery_return"
                logger.warning(f"[LOW BATTERY] Rover battery at {self.battery_pct:.1f}%. Aborting route and returning to Dock.")
                socketio.emit("rover_safety_alert", {"message": "Low battery: returning to dock automatically."})
            
            # Calculate target coordinates
            target = {"lat": self.home_lat, "lng": self.home_lng}
            if self.status == "navigating" and self.waypoints:
                target = self.waypoints[self.current_waypoint_idx]
            
            # Distance and heading to target
            d_lat = target["lat"] - self.gps_lat
            d_lng = target["lng"] - self.gps_lng
            
            # Rough distance in meters (1 degree lat ~= 111,000 meters)
            dist_lat_m = d_lat * 111000.0
            dist_lng_m = d_lng * 111000.0 * math.cos(math.radians(self.gps_lat))
            distance_m = math.sqrt(dist_lat_m**2 + dist_lng_m**2)
            
            if distance_m > 0.5:
                # Heading calculations
                self.heading_deg = math.degrees(math.atan2(dist_lng_m, dist_lat_m)) % 360.0
                
                # Move towards target
                step_m = self.speed_mps * dt
                ratio = min(1.0, step_m / distance_m)
                
                self.gps_lat += d_lat * ratio
                self.gps_lng += d_lng * ratio
            else:
                # Target waypoint reached!
                if self.status == "low_battery_return":
                    self.status = "docked"
                    logger.info("[DOCKED] Auto-return complete. Docked and charging.")
                else:
                    logger.info(f"Waypoint {self.current_waypoint_idx} ({target.get('label', '')}) reached.")
                    self.current_waypoint_idx += 1
                    if self.current_waypoint_idx >= len(self.waypoints):
                        self.status = "docked"
                        logger.info("[DOCKED] Route scanning run completed. Docked.")
        
        # 4. Fluctuate wireless RSSI based on distance to home
        dist_home_m = math.sqrt(((self.gps_lat - self.home_lat)*111000)**2 + ((self.gps_lng - self.home_lng)*90000)**2)
        self.signal_rssi = max(-90.0, min(-45.0, -45.0 - (dist_home_m * 0.15) + random.uniform(-1.0, 1.0)))

    def _check_schedule(self):
        """Checks if current time matches any scheduled scan times."""
        t_struct = time.localtime()
        current_time_str = f"{t_struct.tm_hour:02d}:{t_struct.tm_min:02d}"
        
        if getattr(self, "_last_triggered_time", None) == current_time_str:
            return
            
        for run in self.scheduled_runs:
            if run.get("time") == current_time_str:
                self._last_triggered_time = current_time_str
                if self.status == "docked":
                    logger.info(f"[SCHEDULED RUN] Triggering scheduled run: {run.get('label', 'Automated Scan')}")
                    self.status = "navigating"
                    self.speed_mps = 1.2
                    self.current_waypoint_idx = 0
                    self.battery_pct = max(30.0, self.battery_pct)
                    socketio.emit("rover_status_change", {"status": self.status, "message": f"Scheduled run triggered: {run.get('label')}"})
                    break

    def get_telemetry(self):
        with self.lock:
            active_load_factor = 1.5 if self.status in ["navigating", "low_battery_return"] else 3.5
            est_runtime = round(self.battery_pct * active_load_factor, 1)
            
            return {
                "gps": {"lat": self.gps_lat, "lng": self.gps_lng},
                "battery_pct": round(self.battery_pct, 1),
                "estimated_runtime_mins": est_runtime,
                "speed_mps": round(self.speed_mps, 2),
                "heading_deg": round(self.heading_deg, 1),
                "signal_rssi": round(self.signal_rssi, 1),
                "motor_temp_c": round(self.motor_temp_c, 1),
                "status": self.status,
                "current_waypoint_idx": self.current_waypoint_idx,
                "total_waypoints": len(self.waypoints),
                "waypoints": self.waypoints
            }

rover_service = RoverService()
