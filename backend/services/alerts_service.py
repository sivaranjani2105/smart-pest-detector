import os
import time
import logging
from extensions import socketio
from services.sensor_service import sensor_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AlertsService")

class AlertsService:
    def __init__(self):
        self.active_alerts = {}
        self.pm25_threshold = float(os.environ.get("PM25_ALERT_THRESHOLD", "50.0"))
        self.mq135_threshold = float(os.environ.get("MQ135_ALERT_THRESHOLD", "500.0"))
        self.last_motion_time = 0
        self.motion_timeout = 10.0 # motion alert remains visible for 10s

    def update_environmental_alerts(self, readings):
        """Processes telemetry and updates environmental alerts (PM2.5, Gas, Motion)."""
        changed = False
        now = time.time()
        
        # 1. PM2.5 Alert
        pm25 = readings.get("pm25", 0.0)
        if pm25 > self.pm25_threshold:
            if "pm25_spike" not in self.active_alerts:
                self.active_alerts["pm25_spike"] = {
                    "id": "pm25_spike",
                    "type": "environmental",
                    "level": "warning",
                    "message": f"High PM2.5 particulate level detected: {pm25} ug/m³",
                    "timestamp": now
                }
                changed = True
                sensor_service.trigger_buzzer()
        else:
            if "pm25_spike" in self.active_alerts:
                del self.active_alerts["pm25_spike"]
                changed = True

        # 2. MQ135 Gas Alert
        mq135 = readings.get("mq135_ppm", 0.0)
        if mq135 > self.mq135_threshold:
            if "gas_spike" not in self.active_alerts:
                self.active_alerts["gas_spike"] = {
                    "id": "gas_spike",
                    "type": "environmental",
                    "level": "danger",
                    "message": f"Critical air quality warning: {mq135} PPM",
                    "timestamp": now
                }
                changed = True
                sensor_service.trigger_buzzer()
        else:
            if "gas_spike" in self.active_alerts:
                del self.active_alerts["gas_spike"]
                changed = True

        # 3. Motion Alert (Transient)
        motion = readings.get("motion_detected", False)
        if motion:
            self.last_motion_time = now
            if "motion_alert" not in self.active_alerts:
                self.active_alerts["motion_alert"] = {
                    "id": "motion_alert",
                    "type": "motion",
                    "level": "warning",
                    "message": "Intrusion warning: motion detected in field",
                    "timestamp": now
                }
                changed = True
                sensor_service.trigger_buzzer()
        elif "motion_alert" in self.active_alerts:
            # Clear motion alert if timeout has passed
            if now - self.last_motion_time > self.motion_timeout:
                del self.active_alerts["motion_alert"]
                changed = True

        # Emit update if alert list has changed
        if changed:
            self.broadcast_alerts()
            
        return changed

    def send_sms_alert(self, message):
        """Sends an SMS alert via Twilio, falling back to mock logger output if credentials are unset."""
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_from = os.environ.get("TWILIO_FROM_NUMBER")
        twilio_to = os.environ.get("TWILIO_TO_NUMBER")
        
        if twilio_sid and twilio_token and twilio_from and twilio_to:
            try:
                from twilio.rest import Client
                client = Client(twilio_sid, twilio_token)
                client.messages.create(
                    body=message,
                    from_=twilio_from,
                    to=twilio_to
                )
                logger.info(f"[TWILIO SMS] Sent alert to {twilio_to}: {message}")
            except Exception as e:
                logger.error(f"[TWILIO SMS] Error sending SMS: {e}")
        else:
            logger.info(f"[MOCK TWILIO SMS] UNSET CREDENTIALS - Send to farmer phone: {message}")

    def trigger_pest_alert(self, species, confidence):
        """Manually injects a pest alert when detected by YOLOv11."""
        alert_id = f"pest_{species.lower().replace(' ', '_')}"
        now = time.time()
        
        self.active_alerts[alert_id] = {
            "id": alert_id,
            "type": "pest",
            "level": "danger",
            "message": f"Pest detected: {species} (Confidence: {int(confidence * 100)}%)",
            "timestamp": now
        }
        
        logger.info(f"Pest alert triggered: {species} ({confidence})")
        sensor_service.trigger_buzzer(duration=2.0)
        self.broadcast_alerts()
        
        # Trigger Twilio SMS alert on high-severity pest incidents
        is_severe = "locust" in species.lower() or confidence > 0.85
        if is_severe:
            sms_msg = f"Smart Pest Detector AI Alert: Severe pest infestation detected! Pest: {species} ({int(confidence * 100)}% Match). Please check your dashboard."
            self.send_sms_alert(sms_msg)

    def get_active_alerts(self):
        # Return alerts sorted by timestamp
        return sorted(self.active_alerts.values(), key=lambda x: x.get("timestamp", 0), reverse=True)

    def acknowledge_alert(self, alert_id):
        """Allows users to manually dismiss persistent alerts."""
        if alert_id in self.active_alerts:
            del self.active_alerts[alert_id]
            self.broadcast_alerts()
            logger.info(f"Alert {alert_id} acknowledged by user.")
            return True
        return False

    def broadcast_alerts(self):
        """Emits the latest active alerts list via Socket.IO."""
        socketio.emit("alerts_update", self.get_active_alerts())

# Singleton instance
alerts_service = AlertsService()
