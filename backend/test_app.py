import os
import sys
import json
import unittest
from unittest.mock import patch, MagicMock
import numpy as np

# Set environment variable to use a test database
os.environ["BACKEND_DATA_DIR"] = "data_test"
os.environ["SIMULATE_PESTS"] = "true"

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models.user_model import user_model

class SmartPestDetectorTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize database
        user_model.init_db()

    @classmethod
    def tearDownClass(cls):
        # Clean up database files if they exist
        db_path = os.path.join("data_test", "users.db")
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except OSError:
                pass
        if os.path.exists("data_test"):
            try:
                os.rmdir("data_test")
            except OSError:
                pass

    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_base_route(self):
        """Test base index route returns success."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("status", data)
        self.assertTrue("Smart Pest Detector" in data["status"] or "Agrosphere" in data["status"])

    def test_sensors_route(self):
        """Test GET /api/sensors returns telemetry data."""
        response = self.client.get('/api/sensors')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("soil_moisture", data)
        self.assertIn("pm25", data)

    def test_alerts_route(self):
        """Test GET /api/alerts returns alerts status."""
        response = self.client.get('/api/alerts')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIsInstance(data, list)

    def test_advisory_route(self):
        """Test POST /api/advisory returns LLM advice."""
        payload = {"species": "Locust (Schistocerca gregaria)"}
        response = self.client.post('/api/advisory', json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("advice", data)

    def test_auth_flow(self):
        """Test full authentication flow: signup, login, me, preferences, logout."""
        # 1. Signup
        signup_payload = {
            "username": "testfarmer",
            "password": "testpassword",
            "email": "testfarmer@farm.com",
            "role": "farmer",
            "notification_prefs": {"channels": ["email"], "frequency": "instant"}
        }
        response = self.client.post('/api/v1/auth/signup', json=signup_payload)
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "success")

        # 2. Login
        login_payload = {
            "username": "testfarmer",
            "password": "testpassword"
        }
        response = self.client.post('/api/v1/auth/login', json=login_payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["user"]["username"], "testfarmer")

        # 3. GET me (authenticated)
        response = self.client.get('/api/v1/auth/me')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data["authenticated"])
        self.assertEqual(data["user"]["username"], "testfarmer")

        # 4. POST Preferences
        pref_payload = {
            "notification_prefs": {"channels": ["sms", "email"], "frequency": "daily"}
        }
        response = self.client.post('/api/v1/auth/preferences', json=pref_payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "success")

        # 5. Logout
        response = self.client.post('/api/v1/auth/logout')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "success")

        # 6. GET me (unauthenticated)
        response = self.client.get('/api/v1/auth/me')
        self.assertEqual(response.status_code, 401)

    @patch('cv2.imdecode')
    @patch('cv2.cvtColor')
    @patch('cv2.Laplacian')
    @patch('services.yolo_service.yolo_service.run_inference')
    def test_detect_v1_v2(self, mock_yolo, mock_lap, mock_cvt, mock_decode):
        """Test versioned /v1/detect and /v2/detect response layouts."""
        # Setup mocks to bypass quality check and return custom detections
        mock_img = np.ones((100, 100, 3), dtype=np.uint8) * 128
        mock_decode.return_value = mock_img
        
        # Laplacian variance mock
        mock_lap_var = MagicMock()
        mock_lap_var.var.return_value = 150.0  # pass blur threshold
        mock_lap.return_value = mock_lap_var
        
        # cvtColor return value
        mock_cvt.return_value = np.ones((100, 100), dtype=np.uint8) * 128
        
        # YOLO inference return value
        mock_yolo.return_value = (
            [
                {
                    "species": "Locust (Schistocerca gregaria)",
                    "confidence": 0.85,
                    "bbox": [0.1, 0.2, 0.3, 0.4],
                    "original_class": "locust",
                    "beneficial": False,
                    "life_stage": "larva",
                    "severity": "severe",
                    "track_id": 1
                }
            ],
            [
                {
                    "disease": "Fungal Leaf Spot (Cercospora)",
                    "confidence": 0.72,
                    "bbox": [0.5, 0.5, 0.2, 0.2]
                }
            ],
            640,
            480
        )

        # Build dummy image payload
        payload = {"image": "data:image/jpeg;base64,/9j/4AAQSkZJRg=="}

        # 1. Test v1/detect (legacy layout)
        response = self.client.post('/api/v1/detect', json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("detections", data)
        self.assertNotIn("diseases", data)  # v1 should NOT return diseases
        self.assertEqual(len(data["detections"]), 1)
        self.assertEqual(data["detections"][0]["species"], "Locust (Schistocerca gregaria)")
        self.assertNotIn("life_stage", data["detections"][0])  # v1 should strip v2 keys

        # 2. Test v2/detect (advanced layout)
        response = self.client.post('/api/v2/detect', json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("detections", data)
        self.assertIn("diseases", data)
        self.assertIn("crop_type", data)
        self.assertEqual(len(data["detections"]), 1)
        self.assertEqual(data["detections"][0]["species"], "Locust (Schistocerca gregaria)")
        # v2 should include extra details like life_stage, severity, track_id
        self.assertIn("life_stage", data["detections"][0])
        self.assertIn("severity", data["detections"][0])
        self.assertIn("track_id", data["detections"][0])

if __name__ == '__main__':
    unittest.main()
