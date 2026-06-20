import os
import time
import random
import json
import threading
import logging
from extensions import socketio
from services.alerts_service import alerts_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MQTTService")

DATA_DIR = os.environ.get("BACKEND_DATA_DIR", "data")
TIME_SERIES_FILE = os.path.join(DATA_DIR, "time_series.json")

class MQTTService:
    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.thread = None
        
        # In-memory time series cache
        self.time_series_data = []
        self._load_time_series()
        
        # IoT Node configurations (associated with map grid zones 1-9 in Tamil Nadu, India)
        base_lat = 10.7905
        base_lng = 78.7047
        self.sensor_nodes = {
            "node_1": {"id": "node_1", "zone_id": 1, "gps": {"lat": base_lat + 0.0008, "lng": base_lng - 0.0006}, "type": "soil", "battery_pct": 85.0, "solar_charging": True, "last_heartbeat": time.time(), "soil_moisture": 38.0, "status": "online"},
            "node_2": {"id": "node_2", "zone_id": 4, "gps": {"lat": base_lat + 0.0002, "lng": base_lng - 0.0006}, "type": "soil", "battery_pct": 92.0, "solar_charging": True, "last_heartbeat": time.time(), "soil_moisture": 32.0, "status": "online"},
            "node_3": {"id": "node_3", "zone_id": 7, "gps": {"lat": base_lat - 0.0004, "lng": base_lng - 0.0006}, "type": "soil", "battery_pct": 78.0, "solar_charging": False, "last_heartbeat": time.time(), "soil_moisture": 25.0, "status": "online"},
            "node_4": {"id": "node_4", "zone_id": 2, "gps": {"lat": base_lat + 0.0008, "lng": base_lng + 0.0004}, "type": "weather", "battery_pct": 60.0, "solar_charging": True, "last_heartbeat": time.time(), "temperature": 28.5, "humidity": 55.0, "status": "online"},
            "node_5": {"id": "node_5", "zone_id": 5, "gps": {"lat": base_lat + 0.0002, "lng": base_lng + 0.0004}, "type": "soil", "battery_pct": 4.0, "solar_charging": False, "last_heartbeat": time.time(), "soil_moisture": 41.0, "status": "online"}, # low battery
            "node_6": {"id": "node_6", "zone_id": 8, "gps": {"lat": base_lat - 0.0004, "lng": base_lng + 0.0004}, "type": "soil", "battery_pct": 95.0, "solar_charging": True, "last_heartbeat": time.time(), "soil_moisture": 34.0, "status": "online"},
            "node_7": {"id": "node_7", "zone_id": 3, "gps": {"lat": base_lat + 0.0008, "lng": base_lng + 0.0014}, "type": "soil", "battery_pct": 88.0, "solar_charging": True, "last_heartbeat": time.time(), "soil_moisture": 29.0, "status": "online"},
            "node_8": {"id": "node_8", "zone_id": 6, "gps": {"lat": base_lat + 0.0002, "lng": base_lng + 0.0014}, "type": "weather", "battery_pct": 91.0, "solar_charging": True, "last_heartbeat": time.time(), "temperature": 29.1, "humidity": 52.0, "status": "online"},
            "node_9": {"id": "node_9", "zone_id": 9, "gps": {"lat": base_lat - 0.0004, "lng": base_lng + 0.0014}, "type": "soil", "battery_pct": 82.0, "solar_charging": True, "last_heartbeat": time.time(), "soil_moisture": 45.0, "status": "online"}
        }

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._ingestion_loop, daemon=True)
        self.thread.start()
        logger.info("MQTT simulation and IoT Ingestion pipeline started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)

    def _load_time_series(self):
        if os.path.exists(TIME_SERIES_FILE):
            try:
                with open(TIME_SERIES_FILE, "r") as f:
                    self.time_series_data = json.load(f)
            except Exception:
                self.time_series_data = []

    def _save_time_series(self):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(TIME_SERIES_FILE, "w") as f:
                # Cap entries to prevent disk growth
                json.dump(self.time_series_data[-200:], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write time series log: {e}")

    def _ingestion_loop(self):
        while self.running:
            now = time.time()
            
            with self.lock:
                self._simulate_mqtt_publishes(now)
                self._check_node_health(now)
                
            time.sleep(3.0) # check/publish every 3 seconds

    def _simulate_mqtt_publishes(self, now):
        """Simulates nodes publishing metrics over virtual MQTT channels."""
        for node_id, node in self.sensor_nodes.items():
            # If the node's battery is empty or it is offline, skip publishes
            if node["battery_pct"] <= 0.0 or node["status"] == "offline":
                continue
                
            # Random chance to publish in this frame (approx 50% chance every 3s)
            if random.random() < 0.5:
                # Update battery
                if node["solar_charging"]:
                    node["battery_pct"] = min(100.0, node["battery_pct"] + random.uniform(0.1, 0.4))
                else:
                    node["battery_pct"] = max(0.0, node["battery_pct"] - random.uniform(0.1, 0.3))
                
                payload = {
                    "node_id": node_id,
                    "timestamp": now,
                    "battery_pct": round(node["battery_pct"], 1),
                    "solar_charging": node["solar_charging"]
                }
                
                # Mock metrics based on type
                if node["type"] == "soil":
                    # Slow walk soil moisture
                    node["soil_moisture"] = max(10.0, min(85.0, round(node["soil_moisture"] + random.uniform(-1.0, 1.0), 1)))
                    payload["soil_moisture"] = node["soil_moisture"]
                    
                    # Threshold alert checks for low moisture
                    self._check_moisture_threshold(node)
                else:
                    # Slow walk weather readings
                    node["temperature"] = round(node.get("temperature", 25.0) + random.uniform(-0.3, 0.3), 1)
                    node["humidity"] = round(node.get("humidity", 50.0) + random.uniform(-0.5, 0.5), 1)
                    payload["temperature"] = node["temperature"]
                    payload["humidity"] = node["humidity"]
                
                # Log to Simulated Broker Time-Series
                self.time_series_data.append(payload)
                node["last_heartbeat"] = now
                
                # Broadcast the live MQTT payload message via WebSockets
                socketio.emit("mqtt_sensor_publish", payload)
                
        self._save_time_series()

    def _check_moisture_threshold(self, node):
        alert_id = f"moisture_low_{node['id']}"
        if node["soil_moisture"] < 30.0:
            if alert_id not in alerts_service.active_alerts:
                alerts_service.active_alerts[alert_id] = {
                    "id": alert_id,
                    "type": "irrigation",
                    "level": "warning",
                    "message": f"IPM Alert: Low soil moisture ({node['soil_moisture']:.1f}%) at {node['id'].upper()} (Zone {node['zone_id']}). Irrigation advised.",
                    "timestamp": time.time()
                }
                alerts_service.broadcast_alerts()
        else:
            if alert_id in alerts_service.active_alerts:
                del alerts_service.active_alerts[alert_id]
                alerts_service.broadcast_alerts()

    def _check_node_health(self, now):
        """Monitors node heartbeats; marks as offline and alerts if heartbeat > 30 seconds."""
        for node_id, node in self.sensor_nodes.items():
            # If battery hit 0, force offline
            if node["battery_pct"] <= 0.0 and node["status"] == "online":
                node["status"] = "offline"
                self._trigger_node_alert(node_id, "offline", "Battery exhausted.")
                continue
                
            # If heartbeat expired
            elapsed = now - node["last_heartbeat"]
            if elapsed > 30.0 and node["status"] == "online":
                node["status"] = "offline"
                self._trigger_node_alert(node_id, "offline", f"Connection lost. Last heartbeat: {int(elapsed)}s ago.")
            elif elapsed <= 30.0 and node["status"] == "offline" and node["battery_pct"] > 0.0:
                # Came back online
                node["status"] = "online"
                self._clear_node_alert(node_id)

    def _trigger_node_alert(self, node_id, state, reason):
        alert_id = f"node_health_{node_id}"
        node = self.sensor_nodes[node_id]
        
        alerts_service.active_alerts[alert_id] = {
            "id": alert_id,
            "type": "environmental",
            "level": "danger",
            "message": f"IoT Sensor Node Alert: {node_id.upper()} (Zone {node['zone_id']}) is {state.upper()}! Reason: {reason}",
            "timestamp": time.time()
        }
        alerts_service.broadcast_alerts()
        logger.warning(f"[SENSOR HEALTH] Node {node_id} marked as {state}: {reason}")

    def _clear_node_alert(self, node_id):
        alert_id = f"node_health_{node_id}"
        if alert_id in alerts_service.active_alerts:
            del alerts_service.active_alerts[alert_id]
            alerts_service.broadcast_alerts()
            logger.info(f"[SENSOR HEALTH] Node {node_id} has recovered and is back ONLINE.")

    def get_sensors_status(self):
        with self.lock:
            # Return current snapshot of nodes and their properties
            return {
                "nodes": list(self.sensor_nodes.values()),
                "time_series_count": len(self.time_series_data)
            }

    def force_node_offline(self, node_id):
        """Debug function to simulate hardware faults."""
        with self.lock:
            if node_id in self.sensor_nodes:
                node = self.sensor_nodes[node_id]
                node["status"] = "offline"
                node["last_heartbeat"] = time.time() - 60.0 # Force stale heartbeat
                self._trigger_node_alert(node_id, "offline", "Simulated hardware debug disconnect.")
                return True
            return False

mqtt_service = MQTTService()
