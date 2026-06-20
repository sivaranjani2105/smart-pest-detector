import React from "react";
import { AlertTriangle, ShieldAlert, X, Eye, Info } from "lucide-react";

export const AlertBanner = ({ alerts, onAcknowledge }) => {
  if (!alerts || alerts.length === 0) return null;

  // Check if environmental/motion alerts and pest alerts overlap
  const hasEnvironmental = alerts.some(
    (a) => a.type === "environmental" || a.type === "motion"
  );
  const hasPest = alerts.some((a) => a.type === "pest");
  const isCombinedRisk = hasEnvironmental && hasPest;

  return (
    <div className="space-y-3 mb-6">
      {/* Combined Risk Warning Banner */}
      {isCombinedRisk && (
        <div className="relative overflow-hidden rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-100/50 p-5 shadow-sm animate-pulse-ring">
          <div className="flex items-start space-x-4">
            <div className="rounded-lg bg-red-600 p-2 text-white shadow-md animate-bounce">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-lg text-red-800 tracking-wide">
                CRITICAL COMBINED RISK ALARM
              </h4>
              <p className="text-sm text-red-700 mt-1 leading-relaxed">
                WARNING: Hazardous environmental levels (smoke/gas/dust) and pest infestations detected in the same quadrant. Crop vulnerability is severely elevated. Initiate containment protocols immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Individual Alerts list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((alert) => {
          const isPest = alert.type === "pest";
          const isEnv = alert.type === "environmental";
          const isMotion = alert.type === "motion";

          let borderClass = "border-yellow-200 bg-yellow-50/70 text-yellow-800";
          let icon = <Info className="h-5 w-5 text-yellow-600" />;

          if (alert.level === "danger" || isPest) {
            borderClass = "border-red-200 bg-red-50/70 text-red-800";
            icon = <AlertTriangle className="h-5 w-5 text-red-600" />;
          } else if (isMotion) {
            borderClass = "border-orange-200 bg-orange-50/70 text-orange-800";
            icon = <ShieldAlert className="h-5 w-5 text-orange-600" />;
          }

          return (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${borderClass} transition-all duration-300 shadow-sm hover:shadow`}
            >
              <div className="flex items-center space-x-3 pr-2">
                <div className="flex-shrink-0">{icon}</div>
                <div>
                  <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                  <span className="text-[10px] opacity-60">
                    {new Date(alert.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                title="Dismiss Alert"
              >
                <X className="h-4 w-4 opacity-70 hover:opacity-100" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
