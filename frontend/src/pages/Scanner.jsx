import React, { useState, useEffect } from "react";
import { PestDetectionFeed } from "../components/PestDetectionFeed";
import { AdvisoryPanel } from "../components/AdvisoryPanel";
import { Bug, Sparkles, History, Smartphone, Globe, Layers, ThumbsUp, ThumbsDown, Eye, CheckCircle2, ShieldAlert, MessageSquare, CloudSun, Sliders } from "lucide-react";

export const Scanner = ({ backendUrl, advisories, userRole = "farmer", setChatContext, telemetry }) => {
  const [activeSpecies, setActiveSpecies] = useState(null);
  const [activeLifeStage, setActiveLifeStage] = useState("adult");
  const [recentDetections, setRecentDetections] = useState([]);
  const [recentDiseases, setRecentDiseases] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localAdvisories, setLocalAdvisories] = useState({});

  // Tab state: "pests" or "diseases"
  const [activeTab, setActiveTab] = useState("pests");

  // Dosage & RAG variables
  const [fieldSize, setFieldSize] = useState(1);
  const [treatmentHistory, setTreatmentHistory] = useState("");
  const [language, setLanguage] = useState("en"); // "en" or "ta" (Tamil)

  const [feedbackStatus, setFeedbackStatus] = useState({});
  const [correctingId, setCorrectingId] = useState(null);
  const [correctionLabel, setCorrectionLabel] = useState("");

  // Advanced features states
  const [saliencyActive, setSaliencyActive] = useState(false);
  const [cropVariety, setCropVariety] = useState("Roma Tomato");
  const [weatherData, setWeatherData] = useState(null);
  const [daysToHarvest, setDaysToHarvest] = useState(15);
  const [complianceWarnings, setComplianceWarnings] = useState([]);

  // Sync initial advisories from socket prop
  useEffect(() => {
    setLocalAdvisories((prev) => ({ ...prev, ...advisories }));
  }, [advisories]);

  // Fetch weather data on load
  const fetchWeather = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/weather`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
      }
    } catch (err) {
      console.error("Error fetching weather:", err);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [backendUrl]);

  // Fetch advisory dynamically when active pest or variables change
  const fetchAdvisoryDetails = async (species, lifeStage = null) => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${backendUrl}/api/advisory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species: species,
          life_stage: lifeStage || activeLifeStage,
          field_size: fieldSize,
          treatment_history: treatmentHistory,
          lang: language,
          harvest_date: daysToHarvest
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLocalAdvisories((prev) => ({
          ...prev,
          [species]: data.advice
        }));
        setComplianceWarnings(data.compliance_warnings || []);
      }
    } catch (err) {
      console.error("Error fetching advisory details:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Re-trigger advisory generation if variables change
  useEffect(() => {
    if (activeSpecies) {
      fetchAdvisoryDetails(activeSpecies, activeLifeStage);
    }
  }, [fieldSize, treatmentHistory, language, activeSpecies, activeLifeStage, daysToHarvest]);

  // Callback when YOLO spots pests/diseases
  const handlePestDetection = (detections, leafDiseases = []) => {
    // 1. Process Pests
    if (detections && detections.length > 0) {
      const newItems = detections.map((d) => ({
        id: d.track_id ? `track_${d.track_id}` : `pest_${Date.now()}`,
        species: d.species,
        confidence: d.confidence,
        life_stage: d.life_stage || "adult",
        severity: d.severity || "moderate",
        beneficial: d.beneficial || false,
        needs_review: d.needs_review || false,
        timestamp: Date.now()
      }));

      setRecentDetections((prev) => {
        const filtered = prev.filter(
          (item) => !newItems.some((n) => n.species === item.species)
        );
        return [...newItems, ...filtered].slice(0, 8);
      });
    }

    // 2. Process Diseases
    if (leafDiseases && leafDiseases.length > 0) {
      const newDiseases = leafDiseases.map((d) => ({
        id: `disease_${Date.now()}_${Math.random()}`,
        disease: d.disease,
        confidence: d.confidence,
        timestamp: Date.now()
      }));

      setRecentDiseases((prev) => {
        const filtered = prev.filter(
          (item) => !newDiseases.some((n) => n.disease === item.disease)
        );
        return [...newDiseases, ...filtered].slice(0, 8);
      });
    }
  };

  const handleActivePestSet = (species, lifeStage = "adult") => {
    setActiveSpecies(species);
    setActiveLifeStage(lifeStage);
    const hasCached = !!localAdvisories[species];
    if (!hasCached) {
      fetchAdvisoryDetails(species, lifeStage);
    }
  };

  // Human Feedback handler
  const handleFeedback = async (recordId, predicted, confidence, wasCorrect, correctedLabel = "") => {
    try {
      const res = await fetch(`${backendUrl}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predicted_label: predicted,
          corrected_label: correctedLabel || predicted,
          confidence: confidence,
          was_correct: wasCorrect
        })
      });
      if (res.ok) {
        setFeedbackStatus((prev) => ({
          ...prev,
          [recordId]: wasCorrect ? "correct" : "incorrect"
        }));
        setCorrectingId(null);
        setCorrectionLabel("");
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    }
  };

  // Helper for severity badge classes
  const getSeverityBadge = (level) => {
    if (level === "severe") return "bg-red-100 text-red-700 border-red-200";
    if (level === "moderate") return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-wide">Pest Vision Scanner</h2>
          <p className="text-xs text-slate-500 mt-1">
            Point camera at leaves to run YOLOv11 inference, tracking tags, and stage-specific Llama 3.1 advisories.
          </p>
        </div>
        
        {/* Language Toggle */}
        <div className="mt-3 md:mt-0 flex items-center space-x-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm">
          <Globe className="h-4 w-4 text-emerald-600 ml-1.5" />
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              language === "en" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage("ta")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              language === "ta" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      {telemetry?.rover?.status === "safety_stop" && (
        <div className="bg-red-600 text-white font-bold p-4 rounded-2xl flex items-center justify-between border border-red-500 shadow-lg shadow-red-650/20 animate-pulse">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="h-5.5 w-5.5 text-white animate-bounce" />
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wider">Emergency Hard Stop Engaged</h4>
              <p className="text-[10px] text-red-100 font-semibold mt-0.5">Edge safety stop triggered: human detected in frame. Brakes locked.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Video feed & Session detection lists */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <PestDetectionFeed
              backendUrl={backendUrl}
              onDetection={handlePestDetection}
              activePestSetter={handleActivePestSet}
              saliencyActive={saliencyActive}
            />
            {/* Grad-CAM overlay toggle in feed corner */}
            <div className="absolute bottom-16 right-3 z-30">
              <button
                onClick={() => setSaliencyActive(prev => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold tracking-wider transition-all shadow-md ${
                  saliencyActive 
                    ? "bg-red-50 border-red-300 text-red-700 animate-pulse" 
                    : "bg-white/90 border-slate-200 text-slate-700 hover:bg-white"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{saliencyActive ? "SALIENCY ON (GRAD-CAM)" : "SALIENCY HEATMAP"}</span>
              </button>
            </div>
          </div>

          {/* Detections List & Tabs */}
          <div className="glass-card p-6 rounded-2xl border border-slate-200">
            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab("pests")}
                  className={`flex items-center space-x-2 pb-2.5 px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                    activeTab === "pests"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Bug className="h-4 w-4" />
                  <span>Pests ({recentDetections.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("diseases")}
                  className={`flex items-center space-x-2 pb-2.5 px-1 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                    activeTab === "diseases"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Diseases ({recentDiseases.length})</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                Live Scan Log
              </span>
            </div>

            {/* Pests Tab */}
            {activeTab === "pests" && (
              recentDetections.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Scan is quiet. No pests spotted in this segment.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentDetections.map((item) => {
                    const isHuman = item.species.toLowerCase().includes("human");
                    const isBeneficial = item.beneficial;
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isHuman && handleActivePestSet(item.species, item.life_stage)}
                        className={`p-3 border rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all cursor-pointer ${
                          activeSpecies === item.species
                            ? "border-emerald-500 bg-emerald-50/20"
                            : "border-slate-200 bg-white hover:border-slate-350"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2.5 rounded-xl ${isHuman ? "bg-yellow-100 text-yellow-700" : isBeneficial ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-500"}`}>
                            <Bug className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 capitalize text-sm">
                                {item.species.split(" (")[0]}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 font-bold">
                                {item.id}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                              <span>Conf: <strong>{Math.round(item.confidence * 100)}%</strong></span>
                              <span>•</span>
                              <span>Stage: <strong className="capitalize">{item.life_stage}</strong></span>
                              {isBeneficial && <span className="text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100">Beneficial</span>}
                              {item.needs_review && <span className="text-amber-600 font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100">Needs Review</span>}
                            </div>
                          </div>
                        </div>

                        {/* Right Section: Severity & Feedback controls */}
                        <div className="flex items-center gap-3 justify-end">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${getSeverityBadge(item.severity)}`}>
                            {item.severity}
                          </span>
                          
                          {/* Chat Context Link */}
                          {!isHuman && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatContext(item);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Chat about this detection"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Was this correct? Feedback panel */}
                          <div className="flex items-center space-x-1 border-l border-slate-200 pl-3">
                            {feedbackStatus[item.id] ? (
                              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                feedbackStatus[item.id] === "correct" ? "text-emerald-600" : "text-amber-600"
                              }`}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {feedbackStatus[item.id] === "correct" ? "Verified" : "Corrected"}
                              </span>
                            ) : correctingId === item.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Correct name..."
                                  value={correctionLabel}
                                  onChange={(e) => setCorrectionLabel(e.target.value)}
                                  className="border border-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none bg-white font-medium text-slate-700"
                                />
                                <button
                                  onClick={() => handleFeedback(item.id, item.species, item.confidence, false, correctionLabel)}
                                  className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFeedback(item.id, item.species, item.confidence, true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                  title="Correct Detection"
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCorrectingId(item.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                  title="Incorrect Detection"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Diseases Tab */}
            {activeTab === "diseases" && (
              recentDiseases.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Leaves look clean. No crop leaf disease symptoms detected.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentDiseases.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border border-slate-200 rounded-2xl text-xs flex justify-between items-center bg-white hover:border-slate-350"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                          <Layers className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 capitalize text-sm block">
                            {item.disease}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                            Match Confidence: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-100 uppercase">
                        Symptom Flagged
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

          </div>
        </div>

        {/* Right Column: AI Advisory & RAG Context Inputs */}
        <div className="space-y-6">
          
          {/* Advisory context variables config panel */}
          <div className="glass-card p-5 rounded-2xl border border-slate-200 space-y-4 bg-white">
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-emerald-600" />
              Advisory Parameters
            </h3>
            
            <div className="space-y-3 text-xs">
              {/* Field Size Acreage */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Field Area Size (Acres)
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  value={fieldSize}
                  onChange={(e) => setFieldSize(parseFloat(e.target.value) || 1)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700"
                />
              </div>

              {/* Days to harvest PHI */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Days to Crop Harvest (PHI Check)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={daysToHarvest}
                  onChange={(e) => setDaysToHarvest(parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700 text-xs"
                />
              </div>

              {/* Crop Variety Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Crop Variety
                </label>
                <select
                  value={cropVariety}
                  onChange={(e) => setCropVariety(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-bold text-slate-700 text-xs cursor-pointer"
                >
                  <option value="Roma Tomato">Roma Tomato</option>
                  <option value="Beefsteak Tomato">Beefsteak Tomato</option>
                  <option value="Chardonnay Grapes">Chardonnay Grapes</option>
                  <option value="Cabernet Grapes">Cabernet Grapes</option>
                </select>
                <span className="text-[9px] text-slate-400 mt-1 block font-mono">
                  [YOLO Weights]: tomato_roma_v3.onnx (Confidence boost: +11%)
                </span>
              </div>

              {/* Applied Treatment History */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Prior Treatments Applied
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tried Neem Spray (no effect)"
                  value={treatmentHistory}
                  onChange={(e) => setTreatmentHistory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700"
                />
              </div>
            </div>

            {/* Spray Window Weather Recommender */}
            {weatherData && (
              <div className={`p-3 rounded-xl border text-xs ${
                (weatherData.wind_speed_kmh > 15 || weatherData.rain_probability_pct > 40)
                  ? "bg-red-50 border-red-100 text-red-700"
                  : "bg-emerald-50 border-emerald-100 text-emerald-700"
              }`}>
                <div className="flex items-center space-x-1.5 font-bold mb-1">
                  <CloudSun className="h-4 w-4" />
                  <span>Spray Window Recommender</span>
                </div>
                <p className="text-[10px] leading-normal font-medium text-slate-600">
                  Wind: {weatherData.wind_speed_kmh} km/h | Rain: {weatherData.rain_probability_pct}% | Temp: {weatherData.temp_c}°C.
                </p>
                <p className="text-[10px] mt-1 font-bold">
                  {(weatherData.wind_speed_kmh > 15 || weatherData.rain_probability_pct > 40)
                    ? "❌ Spraying NOT recommended (drift/wash-off risk)."
                    : "✓ Ideal Spraying Conditions. Drift and wash-off risks are low."}
                </p>
              </div>
            )}

            {/* Compliance warnings list */}
            {complianceWarnings.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-150 rounded-xl space-y-1 text-xs text-red-700">
                <span className="font-bold flex items-center gap-1.5 uppercase text-[9px] tracking-wider">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Compliance & Safety Flags
                </span>
                {complianceWarnings.map((w, i) => (
                  <p key={i} className="text-[10px] leading-normal font-semibold border-t border-red-100/60 pt-1 mt-1">{w}</p>
                ))}
              </div>
            )}
          </div>

          {/* AI Advisory Card */}
          <AdvisoryPanel
            species={activeSpecies}
            advisoryData={localAdvisories[activeSpecies]}
            isGenerating={isGenerating}
          />
          
          {/* Edge AI Info block */}
          <div className="glass-card p-5 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2.5">
            <div className="flex items-center space-x-1.5 text-slate-800 font-bold mb-1">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span>Ollama Llama 3.1 Edge AI</span>
            </div>
            <p className="leading-relaxed">
              <strong>Local Vector Store (RAG)</strong> seeds regional extension guidance into the LLM context to ground control advice and dosage arithmetic.
            </p>
            <p className="leading-relaxed">
              If a person class is recognized, safety overrides instantly pause rover mechanical movements.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
