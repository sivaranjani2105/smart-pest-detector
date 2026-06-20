import os
import json
import logging
from flask import Blueprint, request, jsonify

webhooks_bp = Blueprint('webhooks', __name__, url_prefix='/api')
DATA_DIR = os.environ.get("BACKEND_DATA_DIR", "data")
WEBHOOKS_FILE = os.path.join(DATA_DIR, "webhooks.json")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WebhooksRoute")

def _load_webhooks():
    if os.path.exists(WEBHOOKS_FILE):
        try:
            with open(WEBHOOKS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def _save_webhooks(urls):
    try:
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR, exist_ok=True)
        with open(WEBHOOKS_FILE, "w") as f:
            json.dump(urls, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save webhooks: {e}")

@webhooks_bp.route('/webhooks/config', methods=['GET', 'POST'])
def webhooks_config():
    """Handles configuring third-party ERP webhook subscriptions."""
    if request.method == 'POST':
        try:
            data = request.get_json() or {}
            urls = data.get("urls", [])
            
            if not isinstance(urls, list):
                return jsonify({"error": "urls must be a list of strings."}), 400
                
            _save_webhooks(urls)
            return jsonify({
                "status": "success",
                "message": f"Saved {len(urls)} webhook configurations successfully.",
                "urls": urls
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        urls = _load_webhooks()
        return jsonify({
            "status": "success",
            "urls": urls
        }), 200

@webhooks_bp.route('/webhooks/trigger', methods=['POST'])
def webhooks_trigger_test():
    """Simulates triggering external API webhooks for verification."""
    try:
        data = request.get_json() or {}
        payload = data.get("payload", {})
        urls = _load_webhooks()
        
        dispatched = []
        for url in urls:
            logger.info(f"[WEBHOOK DISPATCH] Sending payload to ERP: {url} | Payload: {json.dumps(payload)}")
            dispatched.append(url)
            
        return jsonify({
            "status": "success",
            "message": f"Webhook dispatch simulation completed for {len(dispatched)} endpoints.",
            "dispatched_endpoints": dispatched
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
