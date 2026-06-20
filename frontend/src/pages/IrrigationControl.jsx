import React, { useEffect, useState } from "react";
import { Droplets, Power, Calendar, Clock, Trash2, RefreshCw, Cpu } from "lucide-react";

export const IrrigationControl = ({ backendUrl, telemetry }) => {
  const [pumpActive, setPumpActive] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [soilMoisture, setSoilMoisture] = useState(35.0);
  const [schedules, setSchedules] = useState([]);
  const [newTime, setNewTime] = useState("");
  const [newDuration, setNewDuration] = useState(10);
  const [loading, setLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  // Fetch current pump status and schedules
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/pump`);
      if (res.ok) {
        const data = await res.json();
        setPumpActive(data.pump_active);
        setAutoMode(data.auto_mode);
        setSoilMoisture(data.soil_moisture);
      }
    } catch (err) {
      console.error("Error fetching pump status:", err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/schedules`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error("Error fetching schedules:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSchedules();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  // Keep soil moisture in sync with real-time telemetry if available
  useEffect(() => {
    if (telemetry && telemetry.soil_moisture !== undefined) {
      setSoilMoisture(telemetry.soil_moisture);
      setPumpActive(telemetry.pump_active);
    }
  }, [telemetry]);

  // Toggle pump status
  const handleTogglePump = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/pump/toggle`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setPumpActive(data.pump_active);
      }
    } catch (err) {
      console.error("Error toggling pump:", err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle auto irrigation mode
  const handleToggleAutoMode = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/auto_mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_mode: !autoMode })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoMode(data.auto_mode);
      }
    } catch (err) {
      console.error("Error toggling auto mode:", err);
    }
  };

  // Toggle a single schedule
  const handleToggleSchedule = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/schedules/${id}/toggle`, {
        method: "POST"
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (err) {
      console.error("Error toggling schedule:", err);
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/schedules/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (err) {
      console.error("Error deleting schedule:", err);
    }
  };

  // Add new schedule
  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!newTime || !newDuration) return;
    setSchedulerLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/irrigation/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: newTime, duration: newDuration })
      });
      if (res.ok) {
        setNewTime("");
        setNewDuration(10);
        fetchSchedules();
      }
    } catch (err) {
      console.error("Error adding schedule:", err);
    } finally {
      setSchedulerLoading(false);
    }
  };

  // Helper for soil moisture status formatting
  const getMoistureStatus = (val) => {
    if (val < 30) return { label: "Dry (Alert)", color: "text-red-600 bg-red-50 border-red-200" };
    if (val < 40) return { label: "Sub-optimal (Dry)", color: "text-orange-600 bg-orange-50 border-orange-200" };
    if (val > 70) return { label: "Saturated", color: "text-red-600 bg-red-50 border-red-200" };
    if (val > 60) return { label: "Sub-optimal (Wet)", color: "text-orange-600 bg-orange-50 border-orange-200" };
    return { label: "Optimal", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  };

  const statusInfo = getMoistureStatus(soilMoisture);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-wide">Precision Irrigation Control</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage water pump states, soil hydration thresholds, and automated watering planners.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center space-x-2 text-xs">
          <span className={`h-2.5 w-2.5 rounded-full ${pumpActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`}></span>
          <span className="text-slate-600 font-semibold uppercase tracking-wider">
            Pump Status: {pumpActive ? " watering field" : " idle"}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Soil moisture Status & Pump switch */}
        <div className="lg:col-span-1 space-y-6">
          {/* Soil Moisture Gauge Card */}
          <div className="glass-card p-6 rounded-2xl border border-slate-200/80 flex flex-col items-center text-center">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4 w-full text-left flex items-center gap-2">
              <Droplets className="h-4 w-4 text-emerald-600" />
              Soil Hydration
            </h3>
            
            {/* Circle gauge */}
            <div className="relative h-36 w-36 my-2">
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="stroke-slate-100"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={`transition-all duration-500 ${soilMoisture < 30 || soilMoisture > 70 ? "stroke-red-500" : soilMoisture < 40 || soilMoisture > 60 ? "stroke-orange-400" : "stroke-emerald-500"}`}
                  strokeWidth="3.8"
                  strokeDasharray={`${soilMoisture}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-800">{soilMoisture.toFixed(1)}%</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Moisture</span>
              </div>
            </div>

            <div className={`mt-4 px-3 py-1 border rounded-full text-xs font-bold ${statusInfo.color}`}>
              {statusInfo.label}
            </div>
            
            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
              Hydration is simulated: turning the pump <strong className="text-emerald-700">ON</strong> increases moisture by 0.8% per tick. Turning it <strong className="text-slate-700">OFF</strong> allows evaporation at 0.15% per tick.
            </p>
          </div>

          {/* Manual Switch Card */}
          <div className="glass-card p-6 rounded-2xl border border-slate-200/80">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Power className="h-4 w-4 text-emerald-600" />
              Manual Override
            </h3>
            <div className="flex flex-col items-center py-2 space-y-4">
              <button
                onClick={handleTogglePump}
                disabled={loading || autoMode}
                className={`h-24 w-24 rounded-full flex flex-col items-center justify-center border transition-all duration-300 ${
                  autoMode 
                    ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" 
                    : pumpActive
                      ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/35 hover:bg-emerald-600 active:scale-95"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
                }`}
              >
                <Power className="h-8 w-8 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {pumpActive ? "ON" : "OFF"}
                </span>
              </button>
              <div className="text-center">
                <span className="text-xs text-slate-500 block">
                  {autoMode 
                    ? "Disabled in Automated Mode" 
                    : pumpActive 
                      ? "Click to halt water flow" 
                      : "Click to start water flow"
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Automated Irrigation Scheduler */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-200/80">
            
            {/* Scheduler Header with Auto mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">
                    Automated Scheduler
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Set recurring daily events to irrigate crops automatically.
                  </p>
                </div>
              </div>

              {/* Toggle switch for Auto Mode */}
              <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
                <Cpu className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-600">AUTO MODE</span>
                <button
                  onClick={handleToggleAutoMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    autoMode ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Schedule List */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Planner Settings</h4>
              {schedules.length === 0 ? (
                <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  No irrigation schedules defined. Add a schedule below.
                </div>
              ) : (
                schedules.map((sched) => (
                  <div
                    key={sched.id}
                    className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                      sched.active 
                        ? "bg-emerald-50/20 border-emerald-100" 
                        : "bg-slate-50/50 border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${sched.active ? "bg-emerald-100/50 text-emerald-700" : "bg-slate-200/50 text-slate-500"}`}>
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-extrabold text-slate-800">{sched.time}</span>
                        <span className="text-xs text-slate-500 block">
                          Runs for <strong className="text-slate-600">{sched.duration} {sensor_service_simulated_info(backendUrl)}</strong> daily
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleToggleSchedule(sched.id)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          sched.active
                            ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                        }`}
                      >
                        {sched.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(sched.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Schedule Form */}
            <form onSubmit={handleAddSchedule} className="bg-slate-50/50 border border-slate-200/60 p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Create New Schedule</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={newDuration}
                    onChange={(e) => setNewDuration(parseInt(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white text-slate-700 font-medium"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={schedulerLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs tracking-wider transition-all disabled:opacity-50"
              >
                {schedulerLoading ? "ADDING TO SCHEDULER..." : "CONFIRM NEW SCHEDULE"}
              </button>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
};

// Simple helper to warn the user about simulation speedups
function sensor_service_simulated_info(backendUrl) {
  // Let the user know minutes are simulated as seconds
  return "mins (seconds in simulation)";
}
