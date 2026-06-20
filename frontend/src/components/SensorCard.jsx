import React from "react";
import { Wind, Activity, Zap, Shield, ShieldAlert, Droplets } from "lucide-react";

export const SensorCard = ({ title, value, unit, type, status }) => {
  // Determine state levels and colors
  let colorTheme = {
    ring: "stroke-agrogreen-500",
    text: "text-agrogreen-400",
    bg: "bg-agrogreen-500/10",
    border: "border-agrogreen-500/20",
    label: "Safe",
    percent: 30
  };

  if (type === "pm25") {
    const val = parseFloat(value) || 0;
    colorTheme.percent = Math.min(100, (val / 150) * 100);
    if (val > 100) {
      colorTheme.ring = "stroke-red-500";
      colorTheme.text = "text-red-400";
      colorTheme.bg = "bg-red-500/10";
      colorTheme.border = "border-red-500/30";
      colorTheme.label = "Danger";
    } else if (val > 35) {
      colorTheme.ring = "stroke-orange-500";
      colorTheme.text = "text-orange-400";
      colorTheme.bg = "bg-orange-500/10";
      colorTheme.border = "border-orange-500/30";
      colorTheme.label = "Warning";
    }
  } else if (type === "mq135") {
    const val = parseFloat(value) || 0;
    colorTheme.percent = Math.min(100, (val / 1000) * 100);
    if (val > 600) {
      colorTheme.ring = "stroke-red-500";
      colorTheme.text = "text-red-400";
      colorTheme.bg = "bg-red-500/10";
      colorTheme.border = "border-red-500/30";
      colorTheme.label = "Hazardous";
    } else if (val > 350) {
      colorTheme.ring = "stroke-orange-500";
      colorTheme.text = "text-orange-400";
      colorTheme.bg = "bg-orange-500/10";
      colorTheme.border = "border-orange-500/30";
      colorTheme.label = "Moderate";
    } else {
      colorTheme.label = "Excellent";
    }
  } else if (type === "motion") {
    const val = !!value;
    colorTheme.percent = val ? 100 : 0;
    if (val) {
      colorTheme.ring = "stroke-red-500 animate-pulse";
      colorTheme.text = "text-red-400";
      colorTheme.bg = "bg-red-500/10";
      colorTheme.border = "border-red-500/40 animate-pulse";
      colorTheme.label = "MOVEMENT!";
    } else {
      colorTheme.label = "Secure";
      colorTheme.ring = "stroke-agrogreen-500";
    }
  } else if (type === "soil") {
    const val = parseFloat(value) || 0;
    colorTheme.percent = Math.min(100, val);
    if (val < 30 || val > 70) {
      colorTheme.ring = "stroke-red-500";
      colorTheme.text = "text-red-400";
      colorTheme.bg = "bg-red-500/10";
      colorTheme.border = "border-red-500/30";
      colorTheme.label = val < 30 ? "Dry Alert" : "Saturated";
    } else if (val < 40 || val > 60) {
      colorTheme.ring = "stroke-orange-500";
      colorTheme.text = "text-orange-400";
      colorTheme.bg = "bg-orange-500/10";
      colorTheme.border = "border-orange-500/30";
      colorTheme.label = "Sub-optimal";
    } else {
      colorTheme.ring = "stroke-agrogreen-500";
      colorTheme.text = "text-agrogreen-400";
      colorTheme.bg = "bg-agrogreen-500/10";
      colorTheme.border = "border-agrogreen-500/20";
      colorTheme.label = "Optimal";
    }
  }

  // Get matching icon
  const getIcon = () => {
    switch (type) {
      case "pm25":
        return <Wind className={`h-5 w-5 ${colorTheme.text}`} />;
      case "mq135":
        return <Activity className={`h-5 w-5 ${colorTheme.text}`} />;
      case "soil":
        return <Droplets className={`h-5 w-5 ${colorTheme.text}`} />;
      case "motion":
        return value ? (
          <ShieldAlert className={`h-5 w-5 text-red-500`} />
        ) : (
          <Shield className={`h-5 w-5 text-agrogreen-400`} />
        );
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  return (
    <div className={`glass-card glass-card-hover p-6 rounded-2xl flex items-center justify-between border ${colorTheme.border}`}>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-lg ${colorTheme.bg}`}>{getIcon()}</div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-extrabold tracking-tight text-slate-800">
            {type === "motion" ? (value ? "Active" : "None") : value}
          </span>
          {unit && <span className="text-sm text-slate-500 font-medium">{unit}</span>}
        </div>
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${colorTheme.bg} ${colorTheme.text}`}>
          {colorTheme.label}
        </span>
      </div>

      {/* High-tech Circular Progress Ring */}
      <div className="relative h-20 w-20 flex-shrink-0">
        <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
          {/* Background track circle */}
          <path
            className="stroke-slate-200"
            strokeWidth="3"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Animated active path circle */}
          <path
            className={colorTheme.ring}
            strokeWidth="3.2"
            strokeDasharray={`${colorTheme.percent}, 100`}
            strokeLinecap="round"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-bold text-slate-600">
          {type === "motion" ? (
            value ? "ALERT" : "OK"
          ) : (
            `${Math.round(colorTheme.percent)}%`
          )}
        </div>
      </div>
    </div>
  );
};
