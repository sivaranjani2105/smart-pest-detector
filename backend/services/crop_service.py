import os
import cv2
import numpy as np
import random
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CropClassifierService")

class CropClassifierService:
    def __init__(self):
        # List of supported crops for prediction
        self.crop_varieties = [
            "Roma Tomato",
            "Beefsteak Tomato",
            "Yellow Dent Corn",
            "Sweet Corn",
            "Nonpareil Almonds",
            "Upland Cotton"
        ]
        logger.info("Crop Classifier Service initialized (decoupled model stub).")

    def classify_crop(self, image_bytes):
        """
        Simulates running a lightweight crop classification network (ResNet/EfficientNet).
        Analyzes the frame characteristics to return the dominant crop variety.
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return "Unknown Crop"
                
            # Simulate features analysis: check green leaf saturation
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            # Standard green mask
            lower_green = np.array([35, 40, 40])
            upper_green = np.array([85, 255, 255])
            mask = cv2.inRange(hsv, lower_green, upper_green)
            green_ratio = np.sum(mask > 0) / (img.shape[0] * img.shape[1])
            
            # Predict based on features
            if green_ratio > 0.4:
                # Highly green canopy - likely tomato or corn
                return random.choice(["Roma Tomato", "Beefsteak Tomato", "Yellow Dent Corn"])
            elif green_ratio > 0.15:
                # Moderate foliage - almonds or cotton
                return random.choice(["Nonpareil Almonds", "Upland Cotton"])
            else:
                # Low green ratio - fallback default variety or standby crop
                return "Roma Tomato"
        except Exception as e:
            logger.error(f"Error classifying crop: {e}")
            return "Roma Tomato"

# Singleton instance
crop_classifier = CropClassifierService()
