import time
import math
import logging
from services.mqtt_service import mqtt_service
from services.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PestRiskService")

class PestRiskService:
    def get_zone_from_gps(self, lat, lng):
        """Maps coordinates to a 1-9 zone grid index."""
        # Lat split: Top (> 36.7787), Middle (36.7781 to 36.7787), Bottom (< 36.7781)
        if lat > 36.7787:
            row = 0
        elif lat >= 36.7781:
            row = 1
        else:
            row = 2
            
        # Lng split: Left (< -119.4180), Center (-119.4180 to -119.4170), Right (> -119.4170)
        if lng < -119.4180:
            col = 0
        elif lng <= -119.4170:
            col = 1
        else:
            col = 2
            
        # Zones are 1-indexed: 
        # Row 0: 1, 2, 3
        # Row 1: 4, 5, 6
        # Row 2: 7, 8, 9
        return row * 3 + col + 1

    def calculate_zone_risk(self, zone_id):
        """Calculates 0-100 pest risk index for a given zone ID."""
        # Find weather and soil sensors for this zone
        nodes = mqtt_service.get_sensors_status().get("nodes", [])
        zone_nodes = [n for n in nodes if n.get("zone_id") == zone_id and n.get("status") == "online"]
        
        # Default environmental fallbacks
        temp = 24.0
        humidity = 50.0
        soil_moist = 35.0
        
        has_weather = False
        has_soil = False
        
        for n in zone_nodes:
            if n.get("type") == "weather":
                temp = n.get("temperature", temp)
                humidity = n.get("humidity", humidity)
                has_weather = True
            elif n.get("type") == "soil":
                soil_moist = n.get("soil_moisture", soil_moist)
                has_soil = True
                
        # 1. Temperature emergence model (degree-day simulation)
        # Pest development is low below 15C and accelerates as it warms up
        temp_factor = max(0.0, (temp - 15.0) * 3.5)
        # High humidity accelerates pest reproduction/fungal spores
        humidity_mult = 1.25 if humidity > 60.0 else 1.0
        base_env_risk = min(50.0, temp_factor * humidity_mult)
        
        # 2. Moisture-based risk offsets
        moisture_offset = 0.0
        dominant_threat = "General Pests"
        recommendation = "Maintain regular surveillance and release ladybugs as a preventative measure."
        
        if soil_moist < 30.0:
            # Dry soil favors locust egg hatching and mite colonies
            moisture_offset = 25.0
            dominant_threat = "Locust Emergence"
            recommendation = "Low soil moisture. Proactive organic neem oil spray advised to protect crop nodes."
        elif soil_moist > 65.0 and humidity > 60.0:
            # Wet soil + high humidity triggers fungal blights and root decay
            moisture_offset = 30.0
            dominant_threat = "Fungal Blight / Mildew"
            recommendation = "High humidity and wet soil. Avoid overwatering; spray preventative copper fungicide mist."
        elif soil_moist < 40.0:
            moisture_offset = 12.0
            dominant_threat = "Spider Mites"
            recommendation = "Dry soil conditions. Check leaf undersides and apply organic insect soap if spotted."
            
        # 3. Recent Detections history boost
        detection_boost = 0.0
        try:
            active_sess = session_manager.get_active_session()
            recent_pests = active_sess.get("pest_detections", [])
            
            # Count recent pests in this zone (within last 30 minutes)
            now = time.time()
            pest_count_in_zone = 0
            for p in recent_pests:
                p_gps = p.get("gps", {})
                p_lat = p_gps.get("lat")
                p_lng = p_gps.get("lng")
                if p_lat and p_lng:
                    p_zone = self.get_zone_from_gps(p_lat, p_lng)
                    if p_zone == zone_id and (now - p.get("timestamp", 0) < 1800):
                        pest_count_in_zone += 1
                        
            if pest_count_in_zone > 0:
                detection_boost = min(35.0, 20.0 + pest_count_in_zone * 5.0)
                # Elevate threat type
                dominant_threat = "Active Pest Outbreak"
                recommendation = "Active pest detections logged. Initiate spot spraying and dispatch rover for close monitoring."
        except Exception as e:
            logger.error(f"Error checking recent detections in risk model: {e}")
            
        # Compile total risk index
        total_risk = base_env_risk + moisture_offset + detection_boost
        final_score = min(100, max(5, int(round(total_risk))))
        
        # Color coding category
        if final_score >= 70:
            level = "danger"
        elif final_score >= 40:
            level = "warning"
        else:
            level = "safe"
            
        return {
            "zone_id": zone_id,
            "risk_score": final_score,
            "level": level,
            "dominant_threat": dominant_threat,
            "recommendation": recommendation,
            "metrics": {
                "temperature": round(temp, 1),
                "humidity": round(humidity, 1),
                "soil_moisture": round(soil_moist, 1),
                "has_weather_sensor": has_weather,
                "has_soil_sensor": has_soil
            }
        }

    def get_all_zones_risk(self):
        """Calculates risk levels for all 9 zones."""
        return [self.calculate_zone_risk(z) for z in range(1, 10)]

pest_risk_service = PestRiskService()
