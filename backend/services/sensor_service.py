import os
import time
import math
import random
import threading
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SensorService")

class SensorService:
    def __init__(self):
        self.sensor_mode = os.environ.get("SENSOR_MODE", "simulated").lower()
        self.pm25 = 15.0
        self.mq135_ppm = 200.0
        self.motion_detected = False
        self.soil_moisture = 35.0
        self.pump_active = False
        self.rover_autonomous_active = True
        self.rover_paused = False
        self.sprayer_active = False
        self.sprayer_dosage_rate = 2.5
        # Starting point for simulated rover: Center of a Tamil Nadu farm field
        self.gps_lat = 10.7905
        self.gps_lng = 78.7047
        self.angle = 0.0  # Used for simulated movement path
        self.buzzer_active = False
        
        self.callbacks = []
        self.running = False
        self.thread = None
        self.lock = threading.Lock()
        
        # Hardware Setup
        self.buzzer_pin = int(os.environ.get("BUZZER_PIN", "18"))
        if self.sensor_mode == "hardware":
            try:
                import RPi.GPIO as GPIO
                self.GPIO = GPIO
                self.GPIO.setmode(self.GPIO.BCM)
                self.GPIO.setup(self.buzzer_pin, self.GPIO.OUT)
                logger.info("GPIO initialized successfully in hardware mode.")
            except ImportError:
                logger.error("RPi.GPIO not found. Falling back to simulated mode for GPIO.")
                self.sensor_mode = "simulated"
        
        logger.info(f"Sensor Service started in '{self.sensor_mode}' mode.")

    def start_polling(self, interval=2.0):
        """Starts a background thread to poll sensors or generate simulated readings."""
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._poll_loop, args=(interval,), daemon=True)
        self.thread.start()
        logger.info("Sensor polling thread started.")

    def stop_polling(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        logger.info("Sensor polling thread stopped.")

    def register_callback(self, callback):
        """Register a callback function to receive telemetry updates."""
        self.callbacks.append(callback)

    def _poll_loop(self, interval):
        while self.running:
            if self.sensor_mode == "hardware":
                self._read_hardware_sensors()
            else:
                self._generate_simulated_readings()
            
            readings = self.get_latest_readings()
            
            # Fire callbacks
            for callback in self.callbacks:
                try:
                    callback(readings)
                except Exception as e:
                    logger.error(f"Error in telemetry callback: {e}")
                    
            time.sleep(interval)

    def _read_hardware_sensors(self):
        """
        Simulates hardware I2C/Serial connections.
        In a real Pi, you'd insert code here to read from SDS011 (PM2.5), MQ135 (ADC via MCP3008), 
        PIR Motion sensor (GPIO pin), and GPS module (Serial NMEA parsing).
        """
        with self.lock:
            # For demonstration in hardware mode without external sensors, we read PIR pin if available
            # otherwise generate readings with some minor fluctuations
            try:
                # Stub for PIR Motion Pin (say GPIO 23)
                # self.motion_detected = self.GPIO.input(23) == self.GPIO.HIGH
                pass
            except Exception:
                pass
            
            # Keep generating realistic sensor values as fallbacks for sensors not attached
            self._generate_simulated_readings()

    def _generate_simulated_readings(self):
        """Generates realistic telemetry that fluctuates and moves the GPS coordinates."""
        with self.lock:
            # PM2.5 fluctuations
            # Occasionally (5% chance) cause a transient spike
            if random.random() < 0.05:
                self.pm25 = round(random.uniform(80.0, 160.0), 2)
            else:
                # Smooth walk
                self.pm25 = max(5.0, min(100.0, round(self.pm25 + random.uniform(-2.0, 2.0), 2)))
                
            # MQ135 (Air Quality PPM) fluctuations
            if random.random() < 0.05:
                self.mq135_ppm = round(random.uniform(600.0, 950.0), 2)
            else:
                self.mq135_ppm = max(100.0, min(1000.0, round(self.mq135_ppm + random.uniform(-10.0, 10.0), 2)))
                
            # PIR Motion (10% chance of motion)
            self.motion_detected = random.random() < 0.10
            
            # Soil moisture & pump active simulation
            if self.pump_active:
                # Soil moisture increases by 0.8% per tick up to a max of 75.0%
                self.soil_moisture = min(75.0, round(self.soil_moisture + 0.8, 2))
            else:
                # Soil moisture slowly evaporates, decreasing by 0.15% per tick down to a min of 28.0%
                self.soil_moisture = max(28.0, round(self.soil_moisture - 0.15, 2))

            # GPS movement: Simulate a rover moving in a slow Lissajous pattern or spiral in the field
            if self.rover_autonomous_active and not self.rover_paused:
                self.angle += 0.05
                # Slow orbital movement around the starting field coordinate
                self.gps_lat = 10.7905 + 0.001 * math.sin(self.angle)
                self.gps_lng = 78.7047 + 0.001 * math.cos(self.angle * 0.7)

    def get_latest_readings(self):
        """Returns the latest sensor readings."""
        with self.lock:
            return {
                "pm25": self.pm25,
                "mq135_ppm": self.mq135_ppm,
                "motion_detected": self.motion_detected,
                "soil_moisture": self.soil_moisture,
                "pump_active": self.pump_active,
                "rover_autonomous_active": self.rover_autonomous_active,
                "rover_paused": self.rover_paused,
                "sprayer_active": self.sprayer_active,
                "sprayer_dosage_rate": self.sprayer_dosage_rate,
                "gps": {
                    "lat": self.gps_lat,
                    "lng": self.gps_lng
                },
                "buzzer_active": self.buzzer_active,
                "timestamp": time.time()
            }

    def toggle_pump(self):
        with self.lock:
            self.pump_active = not self.pump_active
            logger.info(f"Pump toggled. New state: {self.pump_active}")
            return self.pump_active

    def set_pump_state(self, state):
        with self.lock:
            self.pump_active = bool(state)
            logger.info(f"Pump state set to: {self.pump_active}")
            return self.pump_active

    def trigger_buzzer(self, duration=1.5):
        """Triggers the buzzer for alerts."""
        def run_buzzer():
            with self.lock:
                self.buzzer_active = True
            
            if self.sensor_mode == "hardware":
                logger.info("HARDWARE BUZZER: ON")
                try:
                    self.GPIO.output(self.buzzer_pin, self.GPIO.HIGH)
                except Exception as e:
                    logger.error(f"Failed to turn hardware buzzer ON: {e}")
            else:
                logger.info("[SENSOR] *BUZZER RINGING (SIMULATED)*")
                
            time.sleep(duration)
            
            if self.sensor_mode == "hardware":
                logger.info("HARDWARE BUZZER: OFF")
                try:
                    self.GPIO.output(self.buzzer_pin, self.GPIO.LOW)
                except Exception as e:
                    logger.error(f"Failed to turn hardware buzzer OFF: {e}")
            else:
                logger.info("[SENSOR] *BUZZER SILENT (SIMULATED)*")
                
            with self.lock:
                self.buzzer_active = False

        threading.Thread(target=run_buzzer, daemon=True).start()

    def trigger_sprayer(self, duration=5.0):
        """Triggers the spot sprayer in closed-loop mode."""
        def run_sprayer():
            with self.lock:
                self.sprayer_active = True
            logger.info(f"[CLOSED-LOOP SPRAYER] Active - spot treating. Duration: {duration}s")
            time.sleep(duration)
            with self.lock:
                self.sprayer_active = False
            logger.info("[CLOSED-LOOP SPRAYER] Inactive - spot treatment complete.")

        threading.Thread(target=run_sprayer, daemon=True).start()

# Singleton instance
sensor_service = SensorService()
