import base64
import time
import threading
import cv2
import os
import numpy as np
from collections import defaultdict
from flask import Blueprint, request, jsonify
from services.yolo_service import yolo_service
from services.ollama_service import ollama_service
from services.session_manager import session_manager
from services.alerts_service import alerts_service
from services.sensor_service import sensor_service
from services.rover_service import rover_service
from services.crop_service import crop_classifier
from extensions import socketio

detect_bp = Blueprint('detect', __name__, url_prefix='/api')

# Memory cache for IP-based rate limiting
ip_request_history = defaultdict(list)
DATA_DIR = os.environ.get("BACKEND_DATA_DIR", "data")

def is_rate_limited(ip, limit_per_minute=20):
    """Clean up timestamps older than 60s and check if request rate exceeds limit."""
    now = time.time()
    timestamps = ip_request_history[ip]
    ip_request_history[ip] = [t for t in timestamps if now - t < 60]
    
    if len(ip_request_history[ip]) >= limit_per_minute:
        return True
    
    ip_request_history[ip].append(now)
    return False

def log_audit(ip, endpoint, details):
    """Appends transactions details to data/audit.log."""
    audit_path = os.path.join(DATA_DIR, "audit.log")
    timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp_str}] IP: {ip} | ENDPOINT: {endpoint} | DETAILS: {details}\n"
    try:
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR, exist_ok=True)
        with open(audit_path, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write to audit log: {e}")

def generate_advisory_async(species, confidence, detection_obj, crop_type=None):
    """Fetches LLM advisory in the background to avoid blocking YOLO thread, and emits via Socket.IO."""
    print(f"Async advisory worker started for {species} ({detection_obj.get('life_stage')}) on crop {crop_type}")
    
    life_stage = detection_obj.get("life_stage")
    # Call Ollama API with life-stage and crop-type parameters
    advice_text = ollama_service.get_pest_advisory(species, life_stage=life_stage, crop_type=crop_type)
    
    # Save advisory into session manager
    session_manager.log_pest(detection_obj, advice=advice_text)
    
    # Push advice to connected web dashboards in real time
    socketio.emit("pest_advisory", {
        "species": species,
        "confidence": confidence,
        "advice": advice_text,
        "generated_at": time.time()
    })
    print(f"Async advisory worker finished for {species}")

def is_frame_usable(image_bytes, blur_threshold=100.0):
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return False, "Failed to decode image bytes"
    
    laplacian_var = cv2.Laplacian(img, cv2.CV_64F).var()
    if laplacian_var < blur_threshold:
        return False, f"Image is too blurry ({round(laplacian_var, 1)} var). Please hold camera steady."
        
    mean_brightness = img.mean()
    if mean_brightness < 30.0:
        return False, f"Image is too dark ({round(mean_brightness, 1)} avg brightness). Please improve lighting."
    if mean_brightness > 225.0:
        return False, f"Image is overexposed ({round(mean_brightness, 1)} avg brightness). Please avoid direct glare."
        
    return True, None

def handle_detection(version=1):
    """
    Core detection handler. Version 1 yields legacy shape; version 2 yields full telemetry.
    """
    client_ip = request.remote_addr
    
    # 1. Rate Limiting Check
    if is_rate_limited(client_ip, limit_per_minute=25):
        log_audit(client_ip, f"/api/v{version}/detect", "BLOCKED - Rate limit exceeded")
        return jsonify({"error": "Too Many Requests: Rate limit exceeded (max 25 per minute)."}), 429

    # 2. API Key Authentication Check (if set in environment)
    env_api_key = os.environ.get("SMART_PEST_DETECTOR_API_KEY")
    if env_api_key:
        req_key = request.headers.get("X-API-Key")
        if req_key != env_api_key:
            log_audit(client_ip, f"/api/v{version}/detect", "BLOCKED - Unauthorized X-API-Key")
            return jsonify({"error": "Unauthorized: Invalid or missing X-API-Key header."}), 401

    try:
        image_bytes = None
        
        # Parse Image Payload
        if 'image' in request.files:
            image_bytes = request.files['image'].read()
        elif request.is_json:
            data = request.get_json()
            image_b64 = data.get('image')
            if image_b64:
                if ',' in image_b64:
                    image_b64 = image_b64.split(',')[1]
                image_bytes = base64.b64decode(image_b64)
                
        if not image_bytes:
            return jsonify({"error": "No image payload found."}), 400

        # Pre-inference quality gating (blur & exposure checks)
        usable, rejection_reason = is_frame_usable(image_bytes)
        if not usable:
            log_audit(client_ip, f"/api/v{version}/detect", f"GATE REJECT - {rejection_reason}")
            return jsonify({
                "quality_gate_failed": True,
                "quality_gate_message": rejection_reason,
                "detections": [],
                "diseases": []
            }), 200

        # Decode image for subsequent processing/privacy-blurring if needed
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 3. Run YOLOv11 Inference
        detections, diseases, width, height = yolo_service.run_inference(image_bytes)
        
        # Run Decoupled Crop Variety classification
        crop_type = crop_classifier.classify_crop(image_bytes)
        
        timestamp = time.time()
        session = session_manager.get_active_session()
        
        # Check human presence safety flag
        person_in_frame = any("human" in d["species"].lower() or d["original_class"] == "person" for d in detections)
        if person_in_frame:
            sensor_service.rover_paused = True
            rover_service.trigger_safety_stop()
            print("[SAFETY OVERRIDE] Human detected in frame! Pausing rover actions and engaging safety stop.")
            
            # Privacy Hardening: Blur human bboxes in image frame before persistence
            if img is not None:
                for d in detections:
                    if "human" in d["species"].lower() or d["original_class"] == "person":
                        rx, ry, rw, rh = d["bbox"]
                        x1 = int(max(0, rx * width))
                        y1 = int(max(0, ry * height))
                        x2 = int(min(width, (rx + rw) * width))
                        y2 = int(min(height, (ry + rh) * height))
                        
                        if x2 > x1 and y2 > y1:
                            roi = img[y1:y2, x1:x2]
                            # Apply Gaussian blur
                            blurred = cv2.GaussianBlur(roi, (63, 63), 0)
                            img[y1:y2, x1:x2] = blurred
                
                # Re-encode blurred image to bytes
                _, img_encoded = cv2.imencode('.jpg', img)
                image_bytes = img_encoded.tobytes()
        else:
            sensor_service.rover_paused = False
        
        # 4. Handle Detections
        pest_names = []
        for det in detections:
            species = det["species"]
            confidence = det["confidence"]
            det["timestamp"] = timestamp
            det["gps"] = {"lat": rover_service.gps_lat, "lng": rover_service.gps_lng}
            
            is_human = "human" in species.lower()
            is_beneficial = det.get("beneficial", False)
            
            # Low confidence review queue
            det["needs_review"] = float(confidence) < 0.55 and not is_human and not is_beneficial
            
            if is_human:
                continue
                
            if is_beneficial:
                advice_text = f"### Beneficial Insect: {species}\nThis pollinator or natural predator controls other pests naturally. **Do not apply chemical treatment** to preserve farm biology."
                session["advisory_generated"][species] = advice_text
                session_manager.log_pest(det, advice=advice_text)
                
                socketio.emit("pest_advisory", {
                    "species": species,
                    "confidence": confidence,
                    "advice": advice_text,
                    "generated_at": time.time()
                })
                continue
            
            # Normal Pest Logic
            pest_names.append(species)
            if not person_in_frame:
                alerts_service.trigger_pest_alert(species, confidence)
                if det.get("severity") == "severe":
                    sensor_service.trigger_sprayer(duration=5.0)
            
            already_generated = species in session.get("advisory_generated", {})
            if not already_generated:
                session["advisory_generated"][species] = "Generating advice..."
                threading.Thread(
                    target=generate_advisory_async, 
                    args=(species, confidence, det, crop_type), 
                    daemon=True
                ).start()
            else:
                session_manager.log_pest(det)
                
        # Emit events via WebSockets
        if detections or diseases:
            socketio.emit("pest_detection", {
                "detections": detections,
                "diseases": diseases,
                "crop_type": crop_type,
                "timestamp": timestamp,
                "session_id": session["id"],
                "person_in_frame": person_in_frame,
                "rover_paused": sensor_service.rover_paused
            })
            
        # Log transaction to audit file
        log_audit(client_ip, f"/api/v{version}/detect", f"SUCCESS - Detections: {len(detections)} (Pests: {pest_names}), Diseases: {len(diseases)}, Crop: {crop_type}, Human: {person_in_frame}")
            
        # 5. Format response payload by version
        if version == 1:
            # Strip v2 parameters for backward compatibility
            v1_detections = []
            for d in detections:
                v1_detections.append({
                    "species": d["species"],
                    "confidence": d["confidence"],
                    "bbox": d["bbox"],
                    "beneficial": d.get("beneficial", False)
                })
            return jsonify({
                "detections": v1_detections,
                "person_in_frame": person_in_frame
            }), 200
        else:
            # Return full v2 payload
            return jsonify({
                "detections": detections,
                "diseases": diseases,
                "crop_type": crop_type,
                "person_in_frame": person_in_frame,
                "rover_paused": sensor_service.rover_paused,
                "frame_width": width,
                "frame_height": height,
                "session_id": session["id"],
                "timestamp": timestamp
            }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        log_audit(client_ip, f"/api/v{version}/detect", f"ERROR - {str(e)}")
        return jsonify({"error": str(e)}), 500

@detect_bp.route('/detect', methods=['POST'])
@detect_bp.route('/v1/detect', methods=['POST'])
def detect_pest_v1():
    return handle_detection(version=1)

@detect_bp.route('/v2/detect', methods=['POST'])
def detect_pest_v2():
    return handle_detection(version=2)
