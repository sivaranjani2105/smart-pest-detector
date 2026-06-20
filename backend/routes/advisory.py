import time
from flask import Blueprint, request, jsonify
from services.ollama_service import ollama_service

advisory_bp = Blueprint('advisory', __name__, url_prefix='/api')

@advisory_bp.route('/advisory', methods=['POST'])
def get_advisory():
    """Generates pest control advisory text for a given species name."""
    try:
        data = request.get_json() or {}
        species = data.get("species")
        life_stage = data.get("life_stage")
        field_size = data.get("field_size")
        treatment_history = data.get("treatment_history")
        lang = data.get("lang", "en")
        
        if not species:
            return jsonify({"error": "Species name is required in the request body."}), 400
            
        advice = ollama_service.get_pest_advisory(
            species,
            life_stage=life_stage,
            field_size=field_size,
            treatment_history=treatment_history,
            lang=lang
        )

        # Compliance calculations: PHI (Pre-Harvest Interval) and Chemical Rotation warnings
        compliance_warnings = []
        harvest_date = data.get("harvest_date")
        
        if harvest_date:
            try:
                days_to_harvest = int(harvest_date)
            except Exception:
                days_to_harvest = 10  # default mockup if parsing fails
                
            phis = {
                "pyrethroids": 14,
                "chemical": 10,
                "lambda-cyhalothrin": 14,
                "imidacloprid": 7,
                "spinosad": 3,
                "neem oil": 1,
                "soap": 1
            }
            
            # Warn if days to harvest is less than PHI
            for chem, phi in phis.items():
                if days_to_harvest < phi:
                    compliance_warnings.append(
                        f"⚠️ CRITICAL COMPLIANCE WARNING: Pre-Harvest Interval (PHI) violation! "
                        f"Recommended treatment '{chem.upper()}' has a withdrawal period of {phi} days, "
                        f"which exceeds your target harvest timeline ({days_to_harvest} days). Crop cannot be sold if treated!"
                    )
                    
        # Chemical rotation resistance warning
        history = (treatment_history or "").lower()
        if "pyrethroid" in history or "chemical" in history or "cyhalothrin" in history or "3a" in history:
            compliance_warnings.append(
                "⚠️ RESISTANCE RISK WARNING: Multiple sequential applications of Group 3A (Pyrethroids) detected in history. "
                "Rotate to an alternative mode-of-action (e.g., Organic Neem Oil - Group UN, or Spinosad - Group 5) to prevent target pests developing genetic resistance."
            )
        
        return jsonify({
            "species": species,
            "advice": advice,
            "compliance_warnings": compliance_warnings,
            "generated_at": time.time()
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
