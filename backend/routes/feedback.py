import os
import base64
import time
import json
import logging
from flask import Blueprint, request, jsonify

feedback_bp = Blueprint('feedback', __name__, url_prefix='/api')
logger = logging.getLogger("FeedbackRoute")

DATA_DIR = os.environ.get("BACKEND_DATA_DIR", "data")
FEEDBACK_FILE = os.path.join(DATA_DIR, "feedback.json")
CROPS_DIR = os.path.join(DATA_DIR, "feedback_crops")

# Ensure directories exist
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(CROPS_DIR):
    os.makedirs(CROPS_DIR, exist_ok=True)

@feedback_bp.route('/feedback', methods=['POST'])
def submit_feedback():
    """
    Accepts correction feedback:
    image_crop (base64 or file), predicted_label, corrected_label, confidence, was_correct
    Saves metadata to feedback.json and crops to data/feedback_crops/.
    """
    try:
        data = request.get_json() or {}
        image_crop_b64 = data.get("image_crop")
        predicted = data.get("predicted_label")
        corrected = data.get("corrected_label")
        was_correct = data.get("was_correct")
        confidence = data.get("confidence", 0.0)
        
        if predicted is None or was_correct is None:
            return jsonify({"error": "Missing required feedback fields: predicted_label, was_correct."}), 400
            
        timestamp = time.time()
        crop_filename = None
        
        # Save image crop if provided
        if image_crop_b64:
            try:
                if ',' in image_crop_b64:
                    image_crop_b64 = image_crop_b64.split(',')[1]
                image_bytes = base64.b64decode(image_crop_b64)
                
                crop_filename = f"crop_{int(timestamp)}_{int(time.time() * 1000) % 1000}.jpg"
                crop_path = os.path.join(CROPS_DIR, crop_filename)
                
                with open(crop_path, "wb") as img_f:
                    img_f.write(image_bytes)
                logger.info(f"Saved feedback crop: {crop_filename}")
            except Exception as e:
                logger.error(f"Error saving image crop: {e}")
                
        # Append metadata record to feedback.json
        feedback_record = {
            "id": f"fb_{int(timestamp * 1000)}",
            "timestamp": timestamp,
            "predicted_label": predicted,
            "corrected_label": corrected if not was_correct else predicted,
            "was_correct": bool(was_correct),
            "confidence": float(confidence),
            "crop_image_path": os.path.join("data", "feedback_crops", crop_filename) if crop_filename else None
        }
        
        records = []
        if os.path.exists(FEEDBACK_FILE):
            try:
                with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                    records = json.load(f)
            except Exception:
                records = []
                
        records.append(feedback_record)
        
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)
            
        logger.info(f"Feedback recorded: {feedback_record['id']}")
        return jsonify({
            "status": "success",
            "message": "Feedback submitted successfully.",
            "feedback_id": feedback_record["id"]
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@feedback_bp.route('/feedback', methods=['GET'])
def get_feedback_records():
    """Returns all recorded feedback records for audit/fine-tuning."""
    try:
        records = []
        if os.path.exists(FEEDBACK_FILE):
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
        return jsonify(records), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
