import os
import requests
import json
import threading
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OllamaService")

MOCK_ADVISORY = {
    "locust (schistocerca gregaria)": {
        "advice": (
            "### Organic Treatments:\n"
            "- **Neem Oil Spray**: Disrupts growth cycles and acts as a deterrent.\n"
            "- **Metarhizium acridum**: A natural fungal pathogen that target locusts specifically.\n\n"
            "### Chemical Treatments:\n"
            "- **Pyrethroids**: Apply broad-spectrum insecticides like lambda-cyhalothrin early in the morning.\n"
            "- **Insect Growth Regulators (IGRs)**: Prevents immature locusts from maturing.\n\n"
            "### Prevention:\n"
            "- Maintain bird habitats (natural predators) and plow fields in autumn to destroy buried eggs."
        )
    },
    "fall armyworm (spodoptera frugiperda)": {
        "advice": (
            "### Organic Treatments:\n"
            "- **Bacillus thuringiensis (Bt)**: Biological pesticide highly effective against young caterpillars.\n"
            "- **Beneficial Nematodes**: Apply to soil to target the pupal stage.\n\n"
            "### Chemical Treatments:\n"
            "- **Spinosad**: Very effective with lower impact on beneficial insects.\n"
            "- **Chlorantraniliprole**: Systemic treatment providing long-lasting crop protection.\n\n"
            "### Prevention:\n"
            "- Intercrop corn with repellent plants (Push-Pull strategy, e.g., Desmodium) and weed regularly."
        )
    },
    "aphids (aphis gossypii)": {
        "advice": (
            "### Organic Treatments:\n"
            "- **Insecticidal Soap**: Directly spray on aphid clusters to dissolve their protective outer shell.\n"
            "- **Ladybug Release**: Introduce natural predators like ladybugs or lacewings.\n\n"
            "### Chemical Treatments:\n"
            "- **Acetamiprid**: Neonicotinoid targeting sucking insects (apply sparingly to protect bees).\n"
            "- **Imidacloprid**: Systemic insecticide for severe infestations.\n\n"
            "### Prevention:\n"
            "- Avoid over-fertilizing with nitrogen (which attracts aphids) and use reflective mulches."
        )
    },
    "red spider mites (tetranychus urticae)": {
        "advice": (
            "### Organic Treatments:\n"
            "- **Horticultural Oils**: Smothers adults and eggs on contact.\n"
            "- **Phytoseiulus persimilis**: Predatory mites that rapidly consume spider mite populations.\n\n"
            "### Chemical Treatments:\n"
            "- **Abamectin**: Highly effective miticide/acaricide.\n"
            "- **Spiromesifen**: Targets mite reproduction and egg-laying.\n\n"
            "### Prevention:\n"
            "- Maintain overhead irrigation (mites thrive in hot, dry, dusty conditions) and inspect leaf undersides."
        )
    }
}

class OllamaService:
    def __init__(self):
        self.host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        self.model = os.environ.get("OLLAMA_MODEL", "llama3.1")
        self.enabled = os.environ.get("OLLAMA_ENABLED", "true").lower() == "true"
        
        if self.enabled:
            # Check connection and pull model in a background thread to prevent app block
            threading.Thread(target=self._initialize_ollama, daemon=True).start()

    def _initialize_ollama(self):
        logger.info("Initializing Ollama connection...")
        try:
            # Check if ollama is reachable
            resp = requests.get(f"{self.host}/api/tags", timeout=5)
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                logger.info(f"Available Ollama models: {models}")
                
                # Check for llama3.1
                matching_models = [m for m in models if self.model in m]
                if not matching_models:
                    logger.info(f"Model '{self.model}' not found. Pulling model in background...")
                    self._pull_model()
                else:
                    logger.info(f"Model '{self.model}' is ready for use.")
            else:
                logger.warning(f"Ollama returned status {resp.status_code}. Fallback mode active.")
        except requests.exceptions.RequestException as e:
            logger.warning(f"Ollama is unreachable ({e}). Running in fallback mode.")

    def _pull_model(self):
        try:
            url = f"{self.host}/api/pull"
            payload = {"name": self.model, "stream": False}
            resp = requests.post(url, json=payload, timeout=600)  # Long timeout for model download
            if resp.status_code == 200:
                logger.info(f"Model '{self.model}' pulled successfully.")
            else:
                logger.error(f"Failed to pull model: {resp.text}")
        except Exception as e:
            logger.error(f"Error pulling model: {e}")

    def get_pest_advisory(self, species, life_stage=None, field_size=None, treatment_history=None, lang="en", crop_type=None):
        """Generates treatment advice for a specific pest species incorporating RAG and context."""
        species_lower = species.lower()
        clean_name = species_lower.split(" (")[0]
        
        # If Ollama is disabled, run fallback
        if not self.enabled:
            return self._get_fallback_advisory(clean_name, species, life_stage, field_size, lang, crop_type)
            
        # 1. Query Local RAG guidance database
        from services.rag_service import rag_service
        rag_guidance = rag_service.query_guidance(species)
        
        # 2. Build detailed prompt with parameters
        vars_text = f"- Target Pest: {species}\n"
        if crop_type:
            vars_text += f"- Crop Variety: {crop_type}\n"
        if life_stage:
            vars_text += f"- Active Life Stage: {life_stage}\n"
        if field_size:
            vars_text += f"- Farm / Sector Size: {field_size} acres\n"
        if treatment_history:
            vars_text += f"- Prior Treatments Tried (No Effect): {treatment_history}\n"
            
        lang_instruction = ""
        if lang == "ta":
            lang_instruction = "\nCRITICAL: You MUST write your entire response in Tamil (தமிழ்) language only."
        else:
            lang_instruction = "\nWrite your response in English."
            
        prompt = (
            f"You are Smart Pest Detector AI, an expert agricultural entomologist and agronomist.\n"
            f"Provide concise, actionable pest-control advice based on regional extension guidelines.\n\n"
            f"Context Variables:\n"
            f"{vars_text}\n"
            f"Regional Extension Guidelines:\n"
            f"{rag_guidance}\n\n"
            f"Instruction details:\n"
            f"1. Stage-Specific Advice: Since the current life stage is {life_stage or 'unknown'}, make your advice tailored to it (e.g. if larvae/eggs are active, suggest IGRs or organic washes; if adult, recommend contact sprays).\n"
            f"2. Quantity Calculator: Based on the farm size of {field_size or 1} acres, compute the actual total quantity of pesticide/neem oil needed. (e.g., if a spray requires 200L dilution/acre and 1L Neem Oil, total is {float(field_size or 1)*200}L dilution and {float(field_size or 1)}L Neem Oil).\n"
            f"3. Treatment History: Do not recommend repeating treatments listed under 'Treatments Tried (No Effect)'. Suggest alternatives.\n"
            f"{lang_instruction}\n\n"
            f"Structure your response exactly as follows using Markdown:\n"
            f"### Organic Treatments:\n"
            f"- [Organic option with computed dosage quantity]\n\n"
            f"### Chemical Treatments:\n"
            f"- [Chemical option with computed dosage quantity]\n\n"
            f"### Prevention:\n"
            f"- [2 preventative cultural practices]\n"
            f"Keep the total response under 250 words."
        )
        
        try:
            url = f"{self.host}/api/generate"
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 400
                }
            }
            resp = requests.post(url, json=payload, timeout=15)
            if resp.status_code == 200:
                advice = resp.json().get("response", "").strip()
                return advice
            else:
                logger.error(f"Ollama API returned status {resp.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama request failed: {e}. Using fallback advice.")
            
        return self._get_fallback_advisory(clean_name, species, life_stage, field_size, lang)

    def _get_fallback_advisory(self, clean_name, original_name, life_stage=None, field_size=None, lang="en", crop_type=None):
        is_ta = lang == "ta"
        try:
            acres = float(field_size) if field_size else 1.0
        except ValueError:
            acres = 1.0
            
        stage_text = life_stage or "larva"
        neem_qty = round(2.5 * acres, 1)
        dilution_qty = int(200 * acres)
        chemical_qty = round(0.4 * acres, 1)
        
        # Select pest type
        if "locust" in clean_name:
            if is_ta:
                return (
                    f"### இயற்கை சிகிச்சைகள் (வாழ்க்கை நிலை: {stage_text}):\n"
                    f"- **வேப்ப எண்ணெய்**: {neem_qty} லிட்டர் வேப்ப எண்ணெயை {dilution_qty} லிட்டர் நீரில் கலந்து தெளிக்கவும். இது இலைகளில் முட்டையிடுவதைத் தடுக்கும்.\n\n"
                    f"### இரசாயன சிகிச்சைகள்:\n"
                    f"- **இரசாயன தெளிப்பு**: {chemical_qty} லிட்டர் பைரெத்ராய்டு பூச்சிக்கொல்லியை தெளிக்கவும். அதிகாலை தெளிப்பு பரிந்துரைக்கப்படுகிறது.\n\n"
                    f"### தடுப்பு முறைகள்:\n"
                    f"- இலையுதிர்காலத்தில் நிலத்தை ஆழமாக உழுவதினால் முட்டைகளை அழிக்கலாம்."
                )
            else:
                return (
                    f"### Organic Treatments (Stage: {stage_text}):\n"
                    f"- **Neem Oil**: Apply {neem_qty} Litres of Neem Oil diluted in {dilution_qty}L water. Targets young hoppers.\n\n"
                    f"### Chemical Treatments:\n"
                    f"- **Pyrethroids**: Apply {chemical_qty} Litres of lambda-cyhalothrin insecticide in {dilution_qty}L water.\n\n"
                    f"### Prevention:\n"
                    f"- Deep plow fields in autumn to destroy buried locust egg bands."
                )
        elif "armyworm" in clean_name:
            if is_ta:
                return (
                    f"### இயற்கை சிகிச்சைகள் (வாழ்க்கை நிலை: {stage_text}):\n"
                    f"- **Bt பாக்டீரியா**: {round(0.5 * acres, 1)} கிலோ Bt பொடியை {dilution_qty} லிட்டர் நீரில் கரைத்து மாலை வேளையில் தெளிக்கவும்.\n\n"
                    f"### இரசாயன சிகிச்சைகள்:\n"
                    f"- **ஸ்பினோசாட்**: {chemical_qty} லிட்டர் ஸ்பினோசாட் தெளிப்பதன் மூலம் புழுக்களை விரைவாகக் கட்டுப்படுத்தலாம்.\n\n"
                    f"### தடுப்பு முறைகள்:\n"
                    f"- பூச்சிகளைத் தடுக்கும் தட்டைப்பயிறு போன்ற ஊடுபயிர்களை பயிரிடவும்."
                )
            else:
                return (
                    f"### Organic Treatments (Stage: {stage_text}):\n"
                    f"- **Bacillus thuringiensis (Bt)**: Apply {round(0.5 * acres, 1)} kg of Bt powder in {dilution_qty}L water during late evening.\n\n"
                    f"### Chemical Treatments:\n"
                    f"- **Spinosad**: Apply {chemical_qty} Litres of Spinosad for quick knockdown of mature caterpillars.\n\n"
                    f"### Prevention:\n"
                    f"- Intercrop with repellent legumes (Push-Pull strategy) to deter moths."
                )
        elif "aphid" in clean_name:
            if is_ta:
                return (
                    f"### இயற்கை சிகிச்சைகள் (வாழ்க்கை நிலை: {stage_text}):\n"
                    f"- **பூச்சிக்கொல்லி சோப்**: {neem_qty} லிட்டர் சோப் கரைசலை {dilution_qty} லிட்டர் நீரில் கலந்து இலைகளில் நேரடியாகத் தெளிக்கவும்.\n\n"
                    f"### இரசாயன சிகிச்சைகள்:\n"
                    f"- **அசிடாமிப்ரிட்**: {chemical_qty} லிட்டர் பூச்சிக்கொல்லியை தெளிக்கவும். தேனீக்களைப் பாதுகாக்க பூக்கும் முன் தெளிக்கவும்.\n\n"
                    f"### தடுப்பு முறைகள்:\n"
                    f"- அதிகப்படியான நைட்ரஜன் உரங்களைத் தவிர்க்கவும், இது அசுவினிகளை ஈர்க்கும்."
                )
            else:
                return (
                    f"### Organic Treatments (Stage: {stage_text}):\n"
                    f"- **Insecticidal Soap**: Spray {neem_qty} Litres of organic soap solution in {dilution_qty}L water directly onto colonies.\n\n"
                    f"### Chemical Treatments:\n"
                    f"- **Acetamiprid**: Spray {chemical_qty} Litres of Acetamiprid systematically. Apply outside bee foraging hours.\n\n"
                    f"### Prevention:\n"
                    f"- Avoid over-fertilizing with nitrogen which creates succulent shoots that attract aphids."
                )
        else:
            if is_ta:
                return (
                    f"### இயற்கை சிகிச்சைகள் (வாழ்க்கை நிலை: {stage_text}):\n"
                    f"- **வேப்ப எண்ணெய்**: {neem_qty} லிட்டர் வேப்ப எண்ணெயை {dilution_qty} லிட்டர் நீரில் கலந்து இலைகளில் தெளிக்கவும்.\n\n"
                    f"### இரசாயன சிகிச்சைகள்:\n"
                    f"- **அபாமெக்டின்**: {chemical_qty} லிட்டர் அபாமெக்டின் தெளிக்கவும். சிலந்திப் பேன்களை அழிக்க இலைகளின் அடிப்பகுதியில் தெளிப்பது அவசியம்.\n\n"
                    f"### தடுப்பு முறைகள்:\n"
                    f"- கோடைக்காலத்தில் பயிர்களுக்கு மிதமான ஈரப்பதத்தை பராமரிப்பதன் மூலம் சிலந்திப் பேன்களைக் குறைக்கலாம்."
                )
            else:
                return (
                    f"### Organic Treatments (Stage: {stage_text}):\n"
                    f"- **Neem Oil**: Apply {neem_qty} Litres of Neem Oil dissolved in {dilution_qty}L water onto infested areas.\n\n"
                    f"### Chemical Treatments:\n"
                    f"- **Abamectin**: Apply {chemical_qty} Litres of Abamectin miticide in {dilution_qty}L water.\n\n"
                    f"### Prevention:\n"
                    f"- Keep borders clear and maintain overhead moisture during dry dusty spells."
                )

    def generate_session_report(self, session_data, lang="en"):
        """Generates a summary report of a monitoring session."""
        if not self.enabled:
            return self._get_fallback_session_report(session_data, lang)
            
        lang_instruction = ""
        if lang == "ta":
            lang_instruction = "\nCRITICAL: You MUST write your entire response in Tamil (தமிழ்) language only."
        else:
            lang_instruction = "\nWrite your response in English."
            
        prompt = (
            f"You are Smart Pest Detector AI. Generate a professional crop health summary report for the farmer.\n"
            f"Summarize this agricultural monitoring session data:\n"
            f"Session Data:\n"
            f"- Pests Detected: {json.dumps(session_data.get('pest_summary', {}))}\n"
            f"- Average PM2.5: {session_data.get('avg_pm25', 0.0)} ug/m3\n"
            f"- Average Air Quality PPM: {session_data.get('avg_mq135', 0.0)} ppm\n"
            f"- Average Soil Moisture: {session_data.get('avg_soil_moisture', 35.0)}%\n"
            f"- Motion Triggers: {session_data.get('motion_triggers', 0)}\n"
            f"- GPS Path: Center around Lat {session_data.get('center_gps', {}).get('lat', 0)}, Lng {session_data.get('center_gps', {}).get('lng', 0)}\n\n"
            f"Write a summary in markdown format with a professional and reassuring tone.\n"
            f"Include:\n"
            f"1. **Executive Summary** (overall crop health assessment based on soil moisture, telemetry and pests)\n"
            f"2. **Environmental Analysis** (whether PM2.5, Gas levels, and Soil Moisture suggest healthy crop conditions or active hazards)\n"
            f"3. **Pest Risk Assessment** (criticality of the detected pests and recommended next steps)\n"
            f"{lang_instruction}\n"
            f"Keep it under 300 words."
        )
        
        try:
            url = f"{self.host}/api/generate"
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.5,
                    "num_predict": 500
                }
            }
            resp = requests.post(url, json=payload, timeout=25)
            if resp.status_code == 200:
                report = resp.json().get("response", "").strip()
                return report
            else:
                logger.error(f"Ollama API returned status {resp.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama request failed: {e}. Using fallback report.")
            
        return self._get_fallback_session_report(session_data, lang)

    def _get_fallback_session_report(self, session_data, lang="en"):
        pests = session_data.get("pest_summary", {})
        pest_list = ", ".join([f"{k} (x{v})" for k, v in pests.items()]) if pests else "None"
        
        pm25 = session_data.get('avg_pm25', 0.0)
        mq135 = session_data.get('avg_mq135', 0.0)
        soil = session_data.get('avg_soil_moisture', 35.0)
        
        is_ta = lang == "ta"
        
        env_status = "Good"
        if pm25 > 50 or mq135 > 500 or soil < 35 or soil > 65:
            env_status = "Moderate Alert"
        if pm25 > 120 or mq135 > 800 or soil < 28 or soil > 75:
            env_status = "Critical Hazard (smoke, dust, severe gas leakage, or drought)"
            
        pest_risk = "Low"
        if len(pests) > 0:
            pest_risk = "Medium (requires monitoring)"
        if any(v > 5 for v in pests.values()):
            pest_risk = "High (action recommended)"
            
        if is_ta:
            return (
                f"# அக்ரோஸ்பியர் AI பயிர் சுகாதார அறிக்கை\n\n"
                f"## 1. நிர்வாக சுருக்கம்\n"
                f"இந்த கண்காணிப்பு அமர்வு **{pest_risk}** பூச்சி அபாயத்துடனும், **{env_status}** சுற்றுச்சூழல் நிலைகளுடனும் நிறைவடைந்தது. "
                f"பயிர்களின் சராசரி மண் ஈரப்பதம் **{soil}%** ஆகப் பதிவாகியுள்ளது.\n\n"
                f"## 2. சுற்றுச்சூழல் பகுப்பாய்வு\n"
                f"- **சராசரி PM2.5**: {pm25} ug/m3\n"
                f"- **சராசரி காற்று தரம்**: {mq135} PPM\n"
                f"- **சராசரி மண் ஈரப்பதம்**: {soil}%\n"
                f"- மண் ஈரப்பதம் மற்றும் காற்று தரத் தரவுகள் பயிர்களின் வளர்ச்சிக்கு உகந்த நிலைகளைக் காட்டுகின்றன.\n\n"
                f"## 3. பூச்சி அபாய மதிப்பீடு\n"
                f"- **கண்டறியப்பட்ட பூச்சிகள்**: {pest_list}\n"
                f"- பயிர் சேதத்தைத் தடுக்க தகுந்த இயற்கை உரங்கள் மற்றும் வேப்ப எண்ணெய் கரைசல்களைப் பயன்படுத்துமாறு பரிந்துரைக்கிறோம்."
            )
        else:
            return (
                f"# Smart Pest Detector AI Crop Health Session Summary\n\n"
                f"## 1. Executive Summary\n"
                f"The monitoring session concluded with **{pest_risk}** pest risk and **{env_status}** environmental conditions. "
                f"Average soil hydration logged at **{soil}%**.\n\n"
                f"## 2. Environmental Analysis\n"
                f"- **PM2.5 Average**: {pm25} ug/m3\n"
                f"- **Air Quality Average**: {mq135} PPM\n"
                f"- **Soil Moisture Average**: {soil}%\n"
                f"- Telemetry states that environmental parameters show safe seasonal bands, except for transient spikes. "
                f"Motion sensors triggered {session_data.get('motion_triggers', 0)} times.\n\n"
                f"## 3. Pest Risk Assessment\n"
                f"- **Detected Pests**: {pest_list}\n"
                f"- Presence of crop-destroying insects represents an active threat. It is recommended to deploy localized organic controls (such as neem oil sprays or predatory insects) to prevent early-stage population growth."
            )

# Singleton instance
ollama_service = OllamaService()
