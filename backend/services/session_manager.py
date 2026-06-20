import os
import json
import time
import logging
from services.ollama_service import ollama_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SessionManager")

DATA_DIR = os.environ.get("BACKEND_DATA_DIR", "data")
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")

class SessionManager:
    def __init__(self):
        self.active_session = None
        self.sessions = {}
        
        # Ensure data folder exists
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR, exist_ok=True)
            
        self._load_sessions()

    def _load_sessions(self):
        if os.path.exists(SESSIONS_FILE):
            try:
                with open(SESSIONS_FILE, "r") as f:
                    self.sessions = json.load(f)
                logger.info(f"Loaded {len(self.sessions)} sessions from disk.")
            except Exception as e:
                logger.error(f"Error loading sessions: {e}. Starting fresh.")
                self.sessions = {}
        else:
            self.sessions = {}

    def _save_sessions(self):
        try:
            with open(SESSIONS_FILE, "w") as f:
                json.dump(self.sessions, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sessions to disk: {e}")

    def start_session(self):
        """Starts a new active session and returns its ID."""
        session_id = f"session_{int(time.time())}"
        self.active_session = {
            "id": session_id,
            "start_time": time.time(),
            "end_time": None,
            "telemetry_logs": [],
            "pest_detections": [],
            "advisory_generated": {},
            "report_summary": None,
            "status": "active"
        }
        logger.info(f"Started new session: {session_id}")
        return self.active_session

    def get_active_session(self):
        # Auto-start a session if none active, to make sure detections are always captured
        if not self.active_session:
            self.start_session()
        return self.active_session

    def log_telemetry(self, readings):
        """Logs sensor telemetry to the active session."""
        session = self.get_active_session()
        # Keep list size reasonable: store up to last 500 telemetry items to prevent bloating
        if len(session["telemetry_logs"]) < 500:
            session["telemetry_logs"].append(readings)

    def log_pest(self, detection, advice=None):
        """Logs a pest detection to the active session."""
        session = self.get_active_session()
        session["pest_detections"].append(detection)
        if advice and detection.get("species"):
            session["advisory_generated"][detection["species"]] = advice

    def end_active_session(self):
        """Compiles averages, triggers Ollama summary report, and archives the session."""
        if not self.active_session:
            return None
            
        session = self.active_session
        session["end_time"] = time.time()
        session["status"] = "completed"
        
        # Calculate environmental averages
        telems = session["telemetry_logs"]
        if telems:
            avg_pm25 = round(sum(t["pm25"] for t in telems) / len(telems), 2)
            avg_mq135 = round(sum(t["mq135_ppm"] for t in telems) / len(telems), 2)
            avg_soil_moisture = round(sum(t.get("soil_moisture", 35.0) for t in telems) / len(telems), 2)
            motion_triggers = sum(1 for t in telems if t["motion_detected"])
            
            # Find center GPS
            avg_lat = sum(t["gps"]["lat"] for t in telems) / len(telems)
            avg_lng = sum(t["gps"]["lng"] for t in telems) / len(telems)
        else:
            avg_pm25 = 15.0
            avg_mq135 = 200.0
            avg_soil_moisture = 35.0
            motion_triggers = 0
            avg_lat = 36.7783
            avg_lng = -119.4179
            
        # Count pest occurrences
        pest_summary = {}
        for d in session["pest_detections"]:
            species = d.get("species")
            if species:
                pest_summary[species] = pest_summary.get(species, 0) + 1
                
        session_data_for_llm = {
            "pest_summary": pest_summary,
            "avg_pm25": avg_pm25,
            "avg_mq135": avg_mq135,
            "avg_soil_moisture": avg_soil_moisture,
            "motion_triggers": motion_triggers,
            "center_gps": {"lat": avg_lat, "lng": avg_lng}
        }
        
        # Call Ollama to generate final combined report
        logger.info(f"Generating summary report for session {session['id']}...")
        report_summary = ollama_service.generate_session_report(session_data_for_llm)
        session["report_summary"] = report_summary
        
        # Add summary stats for display in lists
        session["summary_stats"] = {
            "avg_pm25": avg_pm25,
            "avg_mq135": avg_mq135,
            "avg_soil_moisture": avg_soil_moisture,
            "pest_count": len(session["pest_detections"]),
            "motion_count": motion_triggers,
            "duration_seconds": int(session["end_time"] - session["start_time"])
        }
        
        # Archive
        self.sessions[session["id"]] = session
        self._save_sessions()
        
        self.active_session = None
        logger.info(f"Session {session['id']} archived.")
        return session

    def get_session(self, session_id):
        return self.sessions.get(session_id)

    def get_all_sessions(self):
        """Returns sorted list of completed sessions (newest first)."""
        return sorted(
            [s for s in self.sessions.values()],
            key=lambda x: x.get("start_time", 0),
            reverse=True
        )

# Singleton instance
session_manager = SessionManager()
