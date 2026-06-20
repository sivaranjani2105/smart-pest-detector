import React, { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { Wind, Activity, Droplets } from "lucide-react";

export const LiveMonitor = ({ telemetry }) => {
  const [history, setHistory] = useState([]);

  // Append new telemetry readings to history
  useEffect(() => {
    if (!telemetry || !telemetry.timestamp) return;

    setHistory((prev) => {
      // Check if this reading timestamp is already present to prevent duplicates
      if (prev.some((item) => item.timestamp === telemetry.timestamp)) {
        return prev;
      }
      
      const newPoint = {
        time: new Date(telemetry.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }),
        timestamp: telemetry.timestamp,
        pm25: telemetry.pm25 !== undefined ? parseFloat(telemetry.pm25) : 15.0,
        mq135: telemetry.mq135_ppm !== undefined ? parseFloat(telemetry.mq135_ppm) : 200.0,
        soil: telemetry.soil_moisture !== undefined ? parseFloat(telemetry.soil_moisture) : 35.0
      };

      // Keep only last 30 readings
      const updated = [...prev, newPoint];
      if (updated.length > 30) {
        return updated.slice(updated.length - 30);
      }
      return updated;
    });
  }, [telemetry]);

  // Pre-populate mock history if empty, so that the charts aren't completely blank initially
  useEffect(() => {
    if (history.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      const mockPoints = [];
      for (let i = 20; i >= 0; i--) {
        const t = now - i * 2;
        mockPoints.push({
          time: new Date(t * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }),
          timestamp: t,
          pm25: Math.max(5.0, Math.min(100.0, 15.0 + Math.sin(t * 0.1) * 3 + (Math.random() - 0.5) * 2)),
          mq135: Math.max(100.0, Math.min(600.0, 200.0 + Math.cos(t * 0.05) * 20 + (Math.random() - 0.5) * 10)),
          soil: Math.max(28.0, Math.min(75.0, 35.0 + Math.sin(t * 0.02) * 5 + (Math.random() - 0.5) * 0.5))
        });
      }
      setHistory(mockPoints);
    }
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-wide">Live Telemetry Monitor</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time visual graphs plotting PM2.5 particles, air quality gas concentration, and soil moisture levels.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex items-center space-x-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-slate-600 font-semibold uppercase tracking-wider">
            Live Graphing Active ({history.length} samples)
          </span>
        </div>
      </div>

      {/* Grid of charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Soil Moisture Chart */}
        <div className="glass-card p-6 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Soil Hydration Level</h3>
                <p className="text-[10px] text-slate-400">Fluctuates between 28% and 75% depending on pump status.</p>
              </div>
            </div>
            <span className="text-lg font-extrabold text-emerald-600 font-mono">
              {telemetry?.soil_moisture !== undefined ? telemetry.soil_moisture.toFixed(1) : "35.0"}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSoil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
                <YAxis domain={[20, 80]} tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "bold" }}
                  labelStyle={{ color: "#64748b" }}
                />
                <Area type="monotone" dataKey="soil" name="Soil Moisture" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSoil)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Air Quality MQ135 Chart */}
        <div className="glass-card p-6 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Air Quality (MQ135)</h3>
                <p className="text-[10px] text-slate-400">Gas concentration in parts-per-million (PPM).</p>
              </div>
            </div>
            <span className="text-lg font-extrabold text-blue-600 font-mono">
              {telemetry?.mq135_ppm !== undefined ? telemetry.mq135_ppm.toFixed(1) : "200.0"} PPM
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
                <YAxis domain={[50, 1000]} tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "bold" }}
                  labelStyle={{ color: "#64748b" }}
                />
                <Area type="monotone" dataKey="mq135" name="Air PPM" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PM2.5 Dust Chart */}
        <div className="glass-card p-6 rounded-2xl border border-slate-200/80 flex flex-col justify-between xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                <Wind className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Dust Count (PM2.5)</h3>
                <p className="text-[10px] text-slate-400">Suspended particulate matters (µg/m³).</p>
              </div>
            </div>
            <span className="text-lg font-extrabold text-orange-600 font-mono">
              {telemetry?.pm25 !== undefined ? telemetry.pm25.toFixed(1) : "15.0"} µg/m³
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
                <YAxis domain={[0, 180]} tick={{ fontSize: 9, fill: "#64748b" }} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "bold" }}
                  labelStyle={{ color: "#64748b" }}
                />
                <Area type="monotone" dataKey="pm25" name="PM2.5" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
