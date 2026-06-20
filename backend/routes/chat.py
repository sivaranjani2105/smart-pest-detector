from flask import Blueprint, request, jsonify
import requests
import json
import logging
from services.ollama_service import ollama_service

chat_bp = Blueprint('chat', __name__, url_prefix='/api')
logger = logging.getLogger("ChatRoute")

# Fallback agricultural advisor responses
CHAT_FALLBACKS = [
    {
        "keywords": ["aphid", "aphids"],
        "response": "### Aphid Control Guide\n- **Organic**: Use insecticidal soap sprays, release ladybugs, or spray with neem oil.\n- **Chemical**: Imidacloprid or Acetamiprid can be used for severe infestations.\n- **Prevention**: Avoid over-fertilizing with nitrogen, which attracts aphids."
    },
    {
        "keywords": ["locust", "locusts", "grasshopper"],
        "response": "### Locust Control Guide\n- **Organic**: Apply Nosema locustae or Metarhizium acridum biological controls.\n- **Chemical**: Use pyrethroids (e.g., lambda-cyhalothrin) early in the morning.\n- **Prevention**: Plow fields in autumn to destroy buried eggs."
    },
    {
        "keywords": ["armyworm", "armyworms"],
        "response": "### Fall Armyworm Control Guide\n- **Organic**: Bacillus thuringiensis (Bt) spray is highly effective for caterpillars.\n- **Chemical**: Spinosad or Chlorantraniliprole provide targeted, strong control.\n- **Prevention**: Intercrop with repellant plants like Desmodium."
    },
    {
        "keywords": ["mite", "mites", "spider mite"],
        "response": "### Red Spider Mite Control Guide\n- **Organic**: Apply predatory mites (Phytoseiulus persimilis) or horticultural oil sprays.\n- **Chemical**: Abamectin or Spiromesifen acaricides.\n- **Prevention**: Keep humidity up and overhead spray crops to clear dust."
    },
    {
        "keywords": ["moisture", "water", "irrigation", "soil"],
        "response": "### Soil Moisture & Irrigation Guide\n- **Ideal Level**: Most crops thrive in 40% - 60% soil moisture.\n- **Under-watering**: Below 30% causes wilt, stunting, and heat stress.\n- **Over-watering**: Above 70% suffocates roots, leading to root rot and fungal growth.\n- **Control**: Toggle the automated pump scheduler on the **Irrigation** dashboard tab."
    },
    {
        "keywords": ["pm2.5", "air", "gas", "pollution", "smoke"],
        "response": "### Air Quality & Environmental Guide\n- **PM2.5**: Safe levels are < 35 ug/m³. High levels suggest smoke, crop fires, or heavy dust.\n- **MQ135 Gas**: Normal clean air is < 250 ppm. High levels indicate smoke, ammonia, or organic degradation.\n- **Safety**: Verify field conditions immediately if buzzer alerts trigger."
    }
]

DEFAULT_FALLBACK = (
    "### Smart Pest Detector AI Advisory\n"
    "I am your virtual agronomist. I can assist with:\n"
    "- Identifying and treating crop pests (Aphids, Locusts, Armyworms, Spider Mites)\n"
    "- Soil moisture and irrigation parameters\n"
    "- Telemetry analysis (PM2.5, Air Quality indices)\n\n"
    "How can I help you improve your yield today?"
)

def get_rule_based_response(message):
    message_lower = message.lower()
    for item in CHAT_FALLBACKS:
        for kw in item["keywords"]:
            if kw in message_lower:
                return item["response"]
    return DEFAULT_FALLBACK

@chat_bp.route('/chat', methods=['POST'])
def chat():
    """
    Accepts user message, queries Ollama llama3.1 agricultural assistant,
    or falls back to keyword-based advice if Ollama is unreachable/disabled.
    """
    try:
        data = request.get_json() or {}
        message = data.get("message", "").strip()
        
        if not message:
            return jsonify({"error": "Message is required"}), 400
            
        # Context system prompt
        system_prompt = (
            "You are Smart Pest Detector AI, an expert agricultural entomologist and agronomist. "
            "You assist farmers with crop health, pest treatments (organic and chemical), soil conditions, "
            "and irrigation schedules. Provide helpful, concise, and scientifically sound agricultural advice. "
            "Format the output clearly using Markdown."
        )
        
        # Check if Ollama is enabled and reachable
        if ollama_service.enabled:
            try:
                # Call Ollama generation directly with system + user prompt
                prompt = f"System: {system_prompt}\nUser: {message}\nAssistant:"
                url = f"{ollama_service.host}/api/generate"
                payload = {
                    "model": ollama_service.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.6,
                        "num_predict": 400
                    }
                }
                resp = requests.post(url, json=payload, timeout=8)
                if resp.status_code == 200:
                    ai_response = resp.json().get("response", "").strip()
                    if ai_response:
                        return jsonify({"response": ai_response, "source": "ollama"}), 200
            except Exception as e:
                logger.error(f"Error querying Ollama in chat: {e}. Falling back to rule-based response.")
                
        # If Ollama is offline or returns empty response, use rules
        fallback_response = get_rule_based_response(message)
        return jsonify({"response": fallback_response, "source": "fallback"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
