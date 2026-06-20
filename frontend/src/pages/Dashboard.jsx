import React, { useEffect, useState } from "react";
import { SensorCard } from "../components/SensorCard";
import { AlertBanner } from "../components/AlertBanner";
import { useTranslation } from "../context/TranslationContext";
import OnboardingWalkthrough from "../components/OnboardingWalkthrough";
import { 
  Play, Square, Compass, Clock, Bug, Shield, ShieldAlert, Cpu, 
  MessageSquare, Download, Users, Network, Sliders, Calendar, 
  Battery, Sun, Wifi, AlertCircle, Trash2, Plus, ArrowUp, 
  ArrowDown, Eye, EyeOff, Languages, HelpCircle, Settings, Check 
} from "lucide-react";

export const Dashboard = ({
  telemetry,
  alerts,
  onAcknowledgeAlert,
  backendUrl,
  navigateToReports,
  userRole = "farmer"
}) => {
  const { t, language, setLanguage } = useTranslation();
  
  const [activeSession, setActiveSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionTime, setSessionTime] = useState("00:00");

  // Settings & Onboarding state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // ONNX model export & Twilio settings state
  const [exportingModel, setExportingModel] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  
  const [twilioSid, setTwilioSid] = useState(() => localStorage.getItem("twilio_sid") || "");
  const [twilioToken, setTwilioToken] = useState(() => localStorage.getItem("twilio_token") || "");
  const [twilioFrom, setTwilioFrom] = useState(() => localStorage.getItem("twilio_from") || "");
  const [twilioTo, setTwilioTo] = useState(() => localStorage.getItem("twilio_to") || "");
  
  const [sendingSms, setSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);

  // Scheduled runs state
  const [schedule, setSchedule] = useState([]);
  const [schedTime, setSchedTime] = useState("06:00");
  const [schedLabel, setSchedLabel] = useState("Daily Scan Route");
  
  const [sensorHealth, setSensorHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Notification Channels & Frequency Preferences
  const [notifChannels, setNotifChannels] = useState({
    sms: false,
    email: false,
    whatsapp: false
  });
  const [notifFrequency, setNotifFrequency] = useState("instant");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsStatus, setPrefsStatus] = useState(null);

  // Layout settings (Dynamic order + toggle panel visibility)
  const DEFAULT_WIDGET_ORDER = [
    "sensors",
    "session_control",
    "rover_telemetry",
    "schedule",
    "iot_network",
    "edge_onnx",
    "sms_alerts",
    "low_confidence",
    "agronomist_hub",
    "ab_testing",
    "erp_webhook"
  ];

  const [widgetOrder, setWidgetOrder] = useState(() => {
    const saved = localStorage.getItem("dashboard_widget_order");
    return saved ? JSON.parse(saved) : DEFAULT_WIDGET_ORDER;
  });

  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem("dashboard_visible_widgets");
    return saved ? JSON.parse(saved) : {
      sensors: true,
      session_control: true,
      rover_telemetry: true,
      schedule: true,
      iot_network: true,
      edge_onnx: true,
      sms_alerts: true,
      low_confidence: true,
      agronomist_hub: true,
      ab_testing: true,
      erp_webhook: true
    };
  });

  // Admin Webhooks state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savedWebhooks, setSavedWebhooks] = useState([]);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [challengerDeployed, setChallengerDeployed] = useState(false);
  const [triggeringWebhook, setTriggeringWebhook] = useState(false);

  // Load layout/prefs on mount
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/v1/auth/me`);
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user?.notification_prefs) {
            const prefs = data.user.notification_prefs;
            setNotifChannels({
              sms: prefs.channels?.includes("sms") || false,
              email: prefs.channels?.includes("email") || false,
              whatsapp: prefs.channels?.includes("whatsapp") || false
            });
            setNotifFrequency(prefs.frequency || "instant");
          }
        }
      } catch (err) {
        console.error("Error fetching user prefs:", err);
      }
    };
    fetchPrefs();
  }, [backendUrl]);

  const handleSaveNotifPrefs = async () => {
    setSavingPrefs(true);
    setPrefsStatus(null);
    const channels = Object.keys(notifChannels).filter(k => notifChannels[k]);
    const prefs = { channels, frequency: notifFrequency };
    
    try {
      const response = await fetch(`${backendUrl}/api/v1/auth/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_prefs: prefs })
      });
      
      if (response.ok) {
        setPrefsStatus({ success: true, message: "Preferences saved successfully!" });
      } else {
        localStorage.setItem("notif_prefs", JSON.stringify(prefs));
        setPrefsStatus({ success: true, message: "Saved locally (Not logged in)." });
      }
    } catch (err) {
      console.error(err);
      localStorage.setItem("notif_prefs", JSON.stringify(prefs));
      setPrefsStatus({ success: true, message: "Saved locally (Offline)." });
    } finally {
      setSavingPrefs(false);
    }
  };

  const moveWidget = (index, direction) => {
    const newOrder = [...widgetOrder];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      setWidgetOrder(newOrder);
      localStorage.setItem("dashboard_widget_order", JSON.stringify(newOrder));
    }
  };

  const toggleWidgetVisibility = (widgetId) => {
    const newVisible = { ...visibleWidgets, [widgetId]: !visibleWidgets[widgetId] };
    setVisibleWidgets(newVisible);
    localStorage.setItem("dashboard_visible_widgets", JSON.stringify(newVisible));
  };

  const fetchSchedule = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/rover/schedule`);
      if (response.ok) {
        const data = await response.json();
        setSchedule(data.schedule || []);
      }
    } catch (err) {
      console.error("Error fetching schedule:", err);
    }
  };

  const fetchSensorHealth = async () => {
    setLoadingHealth(true);
    try {
      const response = await fetch(`${backendUrl}/api/sensors/health`);
      if (response.ok) {
        const data = await response.json();
        setSensorHealth(data);
      }
    } catch (err) {
      console.error("Error fetching sensor health:", err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    fetchSensorHealth();
    const interval = setInterval(fetchSensorHealth, 4000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const handleAddSchedule = async () => {
    if (!schedTime) return;
    const newSchedule = [...schedule, { id: `sched_${Date.now()}`, time: schedTime, label: schedLabel }];
    try {
      const response = await fetch(`${backendUrl}/api/rover/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule })
      });
      if (response.ok) {
        setSchedule(newSchedule);
        setSchedLabel("Daily Scan Route");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (id) => {
    const newSchedule = schedule.filter(item => item.id !== id);
    try {
      const response = await fetch(`${backendUrl}/api/rover/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule })
      });
      if (response.ok) {
        setSchedule(newSchedule);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartRover = async () => {
    try {
      await fetch(`${backendUrl}/api/rover/run`, { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseRover = async () => {
    try {
      await fetch(`${backendUrl}/api/rover/pause`, { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceNodeOffline = async (nodeId) => {
    try {
      const response = await fetch(`${backendUrl}/api/sensors/debug/offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId })
      });
      if (response.ok) {
        fetchSensorHealth();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/webhooks/config`);
      if (response.ok) {
        const data = await response.json();
        setSavedWebhooks(data.urls || []);
      }
    } catch (err) {
      console.error("Error fetching webhooks:", err);
    }
  };

  useEffect(() => {
    if (userRole === "admin") {
      fetchWebhooks();
    }
  }, [userRole, backendUrl]);

  const handleSaveWebhook = async () => {
    if (!webhookUrl) return;
    const newUrls = [...savedWebhooks, webhookUrl];
    try {
      const response = await fetch(`${backendUrl}/api/webhooks/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: newUrls })
      });
      if (response.ok) {
        setSavedWebhooks(newUrls);
        setWebhookUrl("");
        setWebhookStatus({ success: true, message: "Webhook URL configured!" });
      } else {
        setWebhookStatus({ error: "Failed to configure Webhook." });
      }
    } catch (err) {
      console.error(err);
      setWebhookStatus({ error: "Network error saving Webhook." });
    }
  };

  const handleClearWebhooks = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/webhooks/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [] })
      });
      if (response.ok) {
        setSavedWebhooks([]);
        setWebhookStatus({ success: true, message: "Webhooks cleared!" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerWebhook = async () => {
    setTriggeringWebhook(true);
    try {
      const response = await fetch(`${backendUrl}/api/webhooks/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            event: "severe_pest_alert",
            species: "Locust (Schistocerca gregaria)",
            confidence: 0.96,
            gps: { lat: 36.7783, lng: -119.4179 },
            timestamp: Date.now() / 1000
          }
        })
      });
      if (response.ok) {
        setWebhookStatus({ success: true, message: "Webhook test payload dispatched!" });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggeringWebhook(false);
    }
  };

  const handleExportModel = async () => {
    setExportingModel(true);
    setExportResult(null);
    try {
      const response = await fetch(`${backendUrl}/api/model/export`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setExportResult(data);
      } else {
        setExportResult({ error: "Failed to connect to export service." });
      }
    } catch (err) {
      console.error(err);
      setExportResult({ error: "Network error exporting model." });
    } finally {
      setExportingModel(false);
    }
  };

  const handleSaveTwilio = () => {
    localStorage.setItem("twilio_sid", twilioSid);
    localStorage.setItem("twilio_token", twilioToken);
    localStorage.setItem("twilio_from", twilioFrom);
    localStorage.setItem("twilio_to", twilioTo);
    alert("Alert credentials saved locally!");
  };

  const handleTestSms = async () => {
    setSendingSms(true);
    setSmsStatus(null);
    try {
      const response = await fetch(`${backendUrl}/api/alerts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Smart Pest Detector AI Test: System alerts configured for phone ${twilioTo || "+1XXXXX"}.`
        })
      });
      if (response.ok) {
        const data = await response.json();
        setSmsStatus({ success: true, message: data.message || "Test dispatch initiated!" });
      } else {
        setSmsStatus({ error: "Failed to dispatch test SMS." });
      }
    } catch (err) {
      console.error(err);
      setSmsStatus({ error: "Network error sending test SMS." });
    } finally {
      setSendingSms(false);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/reports/session/active`);
      if (response.ok) {
        const data = await response.json();
        setActiveSession(data);
      }
    } catch (error) {
      console.error("Error fetching active session:", error);
    }
  };

  useEffect(() => {
    fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 3000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  useEffect(() => {
    if (!activeSession || activeSession.start_time === 0) return;
    
    const updateTime = () => {
      const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - activeSession.start_time));
      const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const secs = String(elapsed % 60).padStart(2, "0");
      setSessionTime(`${mins}:${secs}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const handleEndSession = async () => {
    setLoadingSession(true);
    try {
      const response = await fetch(`${backendUrl}/api/reports/session/end`, {
        method: "POST"
      });
      if (response.ok) {
        navigateToReports();
      } else {
        alert("Failed to compile session. Please check if you have active telemetry logs.");
      }
    } catch (err) {
      console.error("Error ending session:", err);
      alert("Network error ending session.");
    } finally {
      setLoadingSession(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-wide">{t('dashboardTitle')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time IoT environmental readings & biological threat tracking.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center space-x-3 text-xs">
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all"
          >
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            <span>{t('startOnboarding')}</span>
          </button>
          
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-lg transition-all"
          >
            <Settings className="h-4 w-4" />
            <span>{t('preferences')}</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-agrogreen-500 animate-ping"></span>
            <span className="text-slate-600 font-semibold uppercase tracking-wider">
              Telemetry Feed Online
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Preferences & Customization panel */}
      {isSettingsOpen && (
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xl animate-fadeIn space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <Sliders className="h-5 w-5 text-emerald-600" />
              <span>Dashboard Customization & Preferences</span>
            </h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Language settings */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Languages className="h-4 w-4 text-emerald-600" />
                <span>{t('language')}</span>
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => setLanguage('en')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    language === 'en'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-50 border-slate-250 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t('english')}
                </button>
                <button
                  onClick={() => setLanguage('ta')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    language === 'ta'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-50 border-slate-250 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t('tamil')}
                </button>
              </div>
            </div>

            {/* 2. Notification Preferences */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <span>{t('notifications')}</span>
              </h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-4 text-xs font-medium text-slate-700">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifChannels.sms}
                      onChange={(e) => setNotifChannels({ ...notifChannels, sms: e.target.checked })}
                      className="rounded text-emerald-605 focus:ring-emerald-500"
                    />
                    <span>SMS</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifChannels.email}
                      onChange={(e) => setNotifChannels({ ...notifChannels, email: e.target.checked })}
                      className="rounded text-emerald-605 focus:ring-emerald-500"
                    />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifChannels.whatsapp}
                      onChange={(e) => setNotifChannels({ ...notifChannels, whatsapp: e.target.checked })}
                      className="rounded text-emerald-605 focus:ring-emerald-500"
                    />
                    <span>WhatsApp</span>
                  </label>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="notif_freq"
                      value="instant"
                      checked={notifFrequency === 'instant'}
                      onChange={() => setNotifFrequency('instant')}
                      className="text-emerald-605 focus:ring-emerald-500"
                    />
                    <span>{t('instant')}</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="radio"
                      name="notif_freq"
                      value="daily"
                      checked={notifFrequency === 'daily'}
                      onChange={() => setNotifFrequency('daily')}
                      className="text-emerald-605 focus:ring-emerald-500"
                    />
                    <span>{t('daily')}</span>
                  </label>
                </div>

                <button
                  onClick={handleSaveNotifPrefs}
                  disabled={savingPrefs}
                  className="w-full py-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all disabled:opacity-50"
                >
                  {savingPrefs ? "Saving..." : t('savePrefs')}
                </button>

                {prefsStatus && (
                  <p className={`text-[10px] font-bold ${prefsStatus.success ? 'text-emerald-600' : 'text-red-500'}`}>
                    {prefsStatus.message}
                  </p>
                )}
              </div>
            </div>

            {/* 3. Panel layout configurations */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Sliders className="h-4 w-4 text-emerald-600" />
                <span>Layout Settings</span>
              </h4>
              <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-2 space-y-1.5">
                {widgetOrder.map((widgetId, index) => {
                  if (widgetId === 'agronomist_hub' && userRole !== 'agronomist') return null;
                  if ((widgetId === 'ab_testing' || widgetId === 'erp_webhook') && userRole !== 'admin') return null;

                  const widgetNames = {
                    sensors: "Environmental Sensors Grid",
                    session_control: "Monitoring Session Control",
                    rover_telemetry: "Rover Health & Telemetry",
                    schedule: "Scheduled Scan Runs",
                    iot_network: "IoT Sensor Node Network",
                    edge_onnx: "Edge ONNX Model Deployment",
                    sms_alerts: "SMS Notification Settings",
                    low_confidence: "Low-Confidence Review Queue",
                    agronomist_hub: "Agronomist Cooperative Hub",
                    ab_testing: "YOLO Model A/B Deployment",
                    erp_webhook: "ERP Webhook Integration"
                  };

                  const isVisible = visibleWidgets[widgetId];

                  return (
                    <div key={widgetId} className="flex justify-between items-center py-1.5 text-xs">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleWidgetVisibility(widgetId)}
                          className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                            isVisible ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                          title={isVisible ? 'Hide Panel' : 'Show Panel'}
                        >
                          {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <span className={`font-semibold ${isVisible ? 'text-slate-805' : 'text-slate-400 line-through'}`}>
                          {widgetNames[widgetId] || widgetId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => moveWidget(index, -1)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveWidget(index, 1)}
                          disabled={index === widgetOrder.length - 1}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flashing Alert Banner */}
      <AlertBanner alerts={alerts} onAcknowledge={onAcknowledgeAlert} />

      {/* Dynamic Widgets Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {widgetOrder.map((widgetId) => {
          if (!visibleWidgets[widgetId]) return null;

          if (widgetId === 'agronomist_hub' && userRole !== 'agronomist') return null;
          if ((widgetId === 'ab_testing' || widgetId === 'erp_webhook') && userRole !== 'admin') return null;

          switch(widgetId) {
            case "sensors":
              return (
                <div key={widgetId} className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <SensorCard
                    title="Dust Count (PM2.5)"
                    value={telemetry?.pm25 !== undefined ? telemetry.pm25 : "15.0"}
                    unit="µg/m³"
                    type="pm25"
                  />
                  <SensorCard
                    title="Air Quality (MQ135)"
                    value={telemetry?.mq135_ppm !== undefined ? telemetry.mq135_ppm : "200.0"}
                    unit="PPM"
                    type="mq135"
                  />
                  <SensorCard
                    title="Soil Moisture"
                    value={telemetry?.soil_moisture !== undefined ? telemetry.soil_moisture : "35.0"}
                    unit="%"
                    type="soil"
                  />
                  <SensorCard
                    title="PIR Motion Sensor"
                    value={telemetry?.motion_detected}
                    type="motion"
                  />
                </div>
              );

            case "session_control":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200/85 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <Shield className="h-5 w-5 text-agrogreen-600" />
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        Monitoring Session Control
                      </h3>
                    </div>
                    
                    {activeSession ? (
                      <div className="grid grid-cols-3 gap-4 py-2">
                        <div className="text-center p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                          <Clock className="h-4 w-4 mx-auto mb-1 text-agrogreen-600" />
                          <span className="text-[10px] text-slate-500 font-bold block">DURATION</span>
                          <span className="text-sm font-extrabold text-slate-800">{sessionTime}</span>
                        </div>
                        <div className="text-center p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                          <Bug className="h-4 w-4 mx-auto mb-1 text-red-500" />
                          <span className="text-[10px] text-slate-500 font-bold block">PESTS DETECTED</span>
                          <span className="text-sm font-extrabold text-slate-800">
                            {activeSession.pest_count || 0}
                          </span>
                        </div>
                        <div className="text-center p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                          <Compass className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                          <span className="text-[10px] text-slate-500 font-bold block">SAMPLES</span>
                          <span className="text-sm font-extrabold text-slate-800">
                            {activeSession.telemetry_count || 0}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Loading current session telemetry logs...</p>
                    )}
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={handleEndSession}
                      disabled={loadingSession}
                      className="w-full flex items-center justify-center space-x-2 py-3 bg-red-50 hover:bg-red-100/80 border border-red-200 disabled:opacity-50 text-red-700 font-bold rounded-xl text-xs tracking-wider transition-all"
                    >
                      {loadingSession ? (
                        <>
                          <span className="h-3 w-3 border-2 border-t-transparent border-red-700 rounded-full animate-spin"></span>
                          <span>COMPILING HEALTH REPORT VIA OLLAMA...</span>
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 fill-current" />
                          <span>END SESSION & COMPILE AI REPORT</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );

            case "rover_telemetry":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <Compass className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                          {t('roverHealth')}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                        telemetry?.rover?.status === "safety_stop" ? "bg-red-50 border-red-200 text-red-700 animate-pulse" :
                        telemetry?.rover?.status === "low_battery_return" ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse" :
                        telemetry?.rover?.status === "navigating" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        telemetry?.rover?.status === "paused" ? "bg-slate-50 border-slate-200 text-slate-650" :
                        "bg-slate-100 border-slate-200 text-slate-650"
                      }`}>
                        {telemetry?.rover?.status || "offline"}
                      </span>
                    </div>

                    {/* Status Warning Banner for safety stop */}
                    {telemetry?.rover?.status === "safety_stop" && (
                      <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-[10px] text-red-700 font-bold flex items-center space-x-1.5 animate-pulse">
                        <AlertCircle className="h-4.5 w-4.5 text-red-650" />
                        <span>{t('personDetected')}</span>
                      </div>
                    )}
                    {telemetry?.rover?.status === "low_battery_return" && (
                      <div className="p-2.5 bg-amber-50 border border-amber-150 rounded-xl text-[10px] text-amber-700 font-bold flex items-center space-x-1.5 animate-pulse">
                        <AlertCircle className="h-4.5 w-4.5 text-amber-650" />
                        <span>LOW BATTERY: Rover returning to home dock.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">{t('battery')}:</span>
                          <span className={`font-bold ${telemetry?.rover?.battery_pct < 25 ? "text-red-600" : "text-emerald-700"}`}>
                            {telemetry?.rover?.battery_pct !== undefined ? `${telemetry.rover.battery_pct}%` : "100.0%"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">{t('runtime')}:</span>
                          <span className="text-slate-800 font-semibold">
                            {telemetry?.rover?.estimated_runtime_mins !== undefined ? `${telemetry.rover.estimated_runtime_mins} mins` : "350 mins"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">{t('speed')}:</span>
                          <span className="text-slate-800 font-mono font-bold">
                            {telemetry?.rover?.speed_mps !== undefined ? `${telemetry.rover.speed_mps} m/s` : "0.00 m/s"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">{t('heading')}:</span>
                          <span className="text-slate-800 font-bold">
                            {telemetry?.rover?.heading_deg !== undefined ? `${telemetry.rover.heading_deg}°` : "0°"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">{t('signalStrength')}:</span>
                          <span className="text-slate-800 font-semibold font-mono">
                            {telemetry?.rover?.signal_rssi !== undefined ? `${telemetry.rover.signal_rssi} dBm` : "-45.0 dBm"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">{t('motorTemp')}:</span>
                          <span className={`font-bold ${telemetry?.rover?.motor_temp_c > 65 ? "text-red-650" : "text-slate-850"}`}>
                            {telemetry?.rover?.motor_temp_c !== undefined ? `${telemetry.rover.motor_temp_c} °C` : "38.0 °C"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">GPS Lock:</span>
                          <span className="text-emerald-700 font-bold">
                            {telemetry?.rover?.gps ? "3D DGPS Fix" : "Offline"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">Progress:</span>
                          <span className="text-slate-800 font-bold font-mono">
                            {telemetry?.rover?.current_waypoint_idx !== undefined ? `${telemetry.rover.current_waypoint_idx}/${telemetry.rover.total_waypoints}` : "0/6"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="flex justify-between">
                        <span>LAT: {telemetry?.rover?.gps?.lat?.toFixed(6) || "36.778300"}</span>
                        <span>LNG: {telemetry?.rover?.gps?.lng?.toFixed(6) || "-119.417900"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={handleStartRover}
                      disabled={telemetry?.rover?.status === "navigating" || telemetry?.rover?.status === "low_battery_return"}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm shadow-emerald-600/10"
                    >
                      {t('runRoute')}
                    </button>
                    <button
                      onClick={handlePauseRover}
                      disabled={telemetry?.rover?.status === "docked" || telemetry?.rover?.status === "safety_stop"}
                      className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {telemetry?.rover?.status === "paused" ? t('resumeRover') : t('pauseRover')}
                    </button>
                  </div>
                </div>
              );

            case "schedule":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {t('scheduledRuns')}
                    </h3>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-normal">
                    Configure target times for the rover to autonomously depart the dock and execute the scan path.
                  </p>

                  <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <input
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="border border-slate-250 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-xs text-slate-800 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Run Description"
                      value={schedLabel}
                      onChange={(e) => setSchedLabel(e.target.value)}
                      className="flex-1 border border-slate-250 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-xs text-slate-700 font-semibold"
                    />
                    <button
                      onClick={handleAddSchedule}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center"
                      title="Add Schedule"
                    >
                      <Plus className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                    {schedule.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">No scheduled scans configured.</p>
                    ) : (
                      schedule.map((sched) => (
                        <div key={sched.id} className="flex justify-between items-center p-3 bg-slate-50/70 border border-slate-150 rounded-xl text-xs">
                          <div>
                            <span className="font-mono font-bold text-emerald-750 text-sm">{sched.time}</span>
                            <span className="ml-3 text-slate-700 font-medium">{sched.label}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteSchedule(sched.id)}
                            className="p-1 text-slate-400 hover:text-red-650 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );

            case "iot_network":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <Wifi className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-850 text-sm uppercase tracking-wider">
                      IoT Sensor Node Network
                    </h3>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-normal">
                    Status rollup of distributed telemetry sensors nodes publishing via simulated MQTT broker.
                  </p>

                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                    {sensorHealth?.nodes?.map((node) => (
                      <div key={node.id} className="p-3 bg-slate-50/60 border border-slate-150 rounded-xl text-xs flex justify-between items-center">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-850 uppercase text-[10px]">{node.id}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-medium bg-slate-150/60 px-1 rounded">
                              {node.type} • Zone {node.zone_id}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono">
                            <span className="flex items-center space-x-0.5">
                              <Battery className="h-3.5 w-3.5" />
                              <span>{Math.round(node.battery_pct)}%</span>
                              {node.solar_charging && <Sun className="h-3 w-3 text-amber-500 fill-amber-500" />}
                            </span>
                            {node.soil_moisture !== undefined && (
                              <span>Moist: {node.soil_moisture}%</span>
                            )}
                            {node.temperature !== undefined && (
                              <span>{node.temperature}°C</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                            node.status === "online" 
                              ? "bg-emerald-50 border-emerald-250 text-emerald-700" 
                              : "bg-red-50 border-red-200 text-red-700 animate-pulse"
                          }`}>
                            {node.status}
                          </span>
                          
                          {node.status === "online" && (
                            <button
                              onClick={() => handleForceNodeOffline(node.id)}
                              className="px-1.5 py-0.5 text-[8px] bg-slate-200 hover:bg-red-50 hover:text-red-750 font-bold border border-slate-300 rounded transition-all"
                              title="Disconnect node for testing alerts"
                            >
                              FAULT
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );

            case "edge_onnx":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <Cpu className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        Edge ONNX Model Deployment
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-normal">
                      Compile and export the latest active YOLOv11 weights to an optimized ONNX runtime format for hardware edge execution on the Raspberry Pi rover.
                    </p>
                    
                    {exportResult && (
                      <div className={`p-3.5 rounded-xl border text-xs ${exportResult.error ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                        {exportResult.error ? (
                          <strong>Error: {exportResult.error}</strong>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="font-bold block">✓ {exportResult.message}</span>
                            <span className="font-mono text-[10px] break-all bg-white/60 p-1.5 rounded border block">Path: {exportResult.path}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handleExportModel}
                    disabled={exportingModel}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs tracking-wider transition-all disabled:opacity-55 shadow shadow-emerald-600/10 text-center"
                  >
                    {exportingModel ? (
                      <>
                        <span className="h-3 w-3 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                        <span>EXPORTING MODEL WEIGHTS...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>COMPILE & EXPORT MODEL TO ONNX</span>
                      </>
                    )}
                  </button>
                </div>
              );

            case "sms_alerts":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <MessageSquare className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        SMS Notification Settings
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3.5 text-[10px]">
                      <div>
                        <label className="block font-bold text-slate-550 uppercase mb-1">Twilio Account SID</label>
                        <input
                          type="password"
                          placeholder="ACxxxxxxxxxxxxxxxx"
                          value={twilioSid}
                          onChange={(e) => setTwilioSid(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-550 uppercase mb-1">Twilio Auth Token</label>
                        <input
                          type="password"
                          placeholder="token-value"
                          value={twilioToken}
                          onChange={(e) => setTwilioToken(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-550 uppercase mb-1">From Number</label>
                        <input
                          type="text"
                          placeholder="+1205XXXXXXX"
                          value={twilioFrom}
                          onChange={(e) => setTwilioFrom(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-550 uppercase mb-1">Farmer Phone (To)</label>
                        <input
                          type="text"
                          placeholder="+1916XXXXXXX"
                          value={twilioTo}
                          onChange={(e) => setTwilioTo(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700 text-xs"
                        />
                      </div>
                    </div>

                    {smsStatus && (
                      <div className={`p-2.5 rounded-xl border text-[10px] ${smsStatus.error ? 'bg-red-50 border-red-100 text-red-750' : 'bg-emerald-50 border-emerald-100 text-emerald-755'}`}>
                        {smsStatus.error ? <strong>{smsStatus.error}</strong> : <span>✓ {smsStatus.message}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveTwilio}
                      className="flex-1 py-2.5 border border-slate-250 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wide transition-colors"
                    >
                      Save Config
                    </button>
                    <button
                      onClick={handleTestSms}
                      disabled={sendingSms}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all disabled:opacity-60 text-center"
                    >
                      {sendingSms ? "Sending..." : "Test SMS"}
                    </button>
                  </div>
                </div>
              );

            case "low_confidence":
              return (
                <div key={widgetId} className="col-span-full glass-card p-6 rounded-2xl border border-slate-200">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
                    <ShieldAlert className="h-5 w-5 text-amber-500 animate-pulse" />
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        Low-Confidence Review Queue
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Validate or discard early YOLO detections with confidence metrics under 55%.
                      </p>
                    </div>
                  </div>

                  {(!activeSession?.pest_detections || activeSession.pest_detections.filter(d => d.needs_review).length === 0) ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      🎉 No low-confidence detections pending human review.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeSession.pest_detections
                        .filter(d => d.needs_review)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-slate-800 capitalize block">{item.species}</span>
                                <span className="text-[9px] text-slate-500">
                                  Confidence: <strong className="text-amber-600">{Math.round(item.confidence * 100)}%</strong>
                                </span>
                              </div>
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded font-bold uppercase">
                                Unverified
                              </span>
                            </div>

                            <div className="flex space-x-2">
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch(`${backendUrl}/api/feedback`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        predicted_label: item.species,
                                        was_correct: true,
                                        confidence: item.confidence
                                      })
                                    });
                                    item.needs_review = false;
                                    fetchActiveSession();
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] uppercase transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch(`${backendUrl}/api/feedback`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        predicted_label: item.species,
                                        was_correct: false,
                                        corrected_label: "None",
                                        confidence: item.confidence
                                      })
                                    });
                                    item.needs_review = false;
                                    fetchActiveSession();
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-lg text-[10px] uppercase transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );

            case "agronomist_hub":
              return (
                <div key={widgetId} className="col-span-full glass-card p-6 rounded-2xl border border-slate-200 mt-6 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <Users className="h-5 w-5 text-emerald-600 animate-pulse" />
                    <div>
                      <h3 className="font-bold text-slate-805 text-sm uppercase tracking-wider">
                        Agronomist Cooperative Hub
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Cooperative rollup view across multiple farms in your district.
                      </p>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-650">
                      <thead className="bg-slate-50 text-[10px] text-slate-450 uppercase font-extrabold border-b border-slate-100">
                        <tr>
                          <th className="p-3">Farm Name</th>
                          <th className="p-3">Active Session</th>
                          <th className="p-3">Current Crop</th>
                          <th className="p-3">Pest Incidents</th>
                          <th className="p-3">District Alarms</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-805">Valley Green Farm</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">Active</span>
                          </td>
                          <td className="p-3 font-medium">Roma Tomato</td>
                          <td className="p-3 font-semibold text-slate-800">{activeSession?.pest_count || 0}</td>
                          <td className="p-3 text-emerald-600 font-bold">None</td>
                          <td className="p-3 text-right">
                            <button className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors mr-2">Advisory</button>
                            <button onClick={navigateToReports} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors">Reports</button>
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-805">Sunny Hill Ranch</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">Standby</span>
                          </td>
                          <td className="p-3 font-medium">Almonds</td>
                          <td className="p-3 font-semibold text-slate-800">5 logged</td>
                          <td className="p-3 text-emerald-600 font-bold">None</td>
                          <td className="p-3 text-right">
                            <button className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors mr-2">Advisory</button>
                            <button className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors">Reports</button>
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-805">Desert River Agro</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">Active</span>
                          </td>
                          <td className="p-3 font-medium">Red Grapes</td>
                          <td className="p-3 font-semibold text-red-650 font-bold">14 logged</td>
                          <td className="p-3 text-red-600 font-bold animate-pulse">1 Critical Alarm (Locusts)</td>
                          <td className="p-3 text-right">
                            <button className="px-2.5 py-1 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors mr-2">Emergency Advice</button>
                            <button className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-colors">Reports</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );

            case "ab_testing":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <Sliders className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                      YOLO Model A/B Deployment
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-normal">
                    Compare local inference performance and recognition rates of model variations before rolling upgrades.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                      <span className="font-bold text-slate-800 uppercase text-[10px] block">A: Active (YOLOv11n)</span>
                      <div className="space-y-1 text-slate-600">
                        <p>mAP@50-95: <strong>89.2%</strong></p>
                        <p>Precision: <strong>87.5%</strong></p>
                        <p>Inference: <strong>12 ms</strong></p>
                        <p>Detections in queue: <strong className="text-emerald-700">Clean</strong></p>
                      </div>
                    </div>
                    <div className="p-3.5 bg-emerald-50/30 border border-emerald-100 rounded-xl space-y-2">
                      <span className="font-bold text-emerald-800 uppercase text-[10px] block">B: Challenger (YOLOv11m)</span>
                      <div className="space-y-1 text-emerald-700">
                        <p>mAP@50-95: <strong>93.4%</strong></p>
                        <p>Precision: <strong>92.1%</strong></p>
                        <p>Inference: <strong>24 ms</strong></p>
                        <p>Detections in queue: <strong className="text-emerald-700">Clean</strong></p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setChallengerDeployed(prev => !prev);
                      alert(challengerDeployed ? "Reverted back to YOLOv11n weights." : "De-prioritized YOLOv11n. Now routing edge inferencing to YOLOv11m-DeepLeaf weights (+4.2% mAP increase).");
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow text-center"
                  >
                    {challengerDeployed ? "✓ Revert to YOLOv11n (Active)" : "Upgrade Edge Rover to YOLOv11m-DeepLeaf"}
                  </button>
                </div>
              );

            case "erp_webhook":
              return (
                <div key={widgetId} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <Network className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        ERP Webhook Integration
                      </h3>
                    </div>
                    
                    <p className="text-xs text-slate-500 leading-normal">
                      Sync live biological detection frames and reports into farm management ERP systems (e.g. FarmLogs, Agworld).
                    </p>
                    
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="https://api.my-farm-erp.com/webhook"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium text-slate-700 text-xs"
                      />
                      <button
                        onClick={handleSaveWebhook}
                        className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all text-center"
                      >
                        Bind
                      </button>
                    </div>
                    
                    {savedWebhooks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Endpoints</span>
                          <button onClick={handleClearWebhooks} className="text-[9px] font-bold text-red-650 uppercase hover:underline">Clear All</button>
                        </div>
                        <div className="max-h-[80px] overflow-y-auto space-y-1.5 pr-1 text-slate-755">
                          {savedWebhooks.map((url, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-mono break-all select-all">
                              <span>{url}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {webhookStatus && (
                      <div className={`p-2.5 rounded-xl border text-[10px] ${webhookStatus.error ? 'bg-red-50 border-red-100 text-red-750' : 'bg-emerald-50 border-emerald-100 text-emerald-750'}`}>
                        {webhookStatus.error ? <strong>{webhookStatus.error}</strong> : <span>✓ {webhookStatus.message}</span>}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handleTriggerWebhook}
                    disabled={triggeringWebhook || savedWebhooks.length === 0}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-650 hover:bg-emerald-755 text-white font-bold rounded-xl text-xs uppercase tracking-wider disabled:opacity-50 transition-all shadow text-center"
                  >
                    {triggeringWebhook ? "Triggering..." : "Simulate Webhook Severe Pest Dispatch"}
                  </button>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>

      <OnboardingWalkthrough isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />
    </div>
  );
};
