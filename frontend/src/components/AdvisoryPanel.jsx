import React from "react";
import { Sparkles, Sprout, ShieldAlert, CheckCircle2, RotateCw } from "lucide-react";

export const AdvisoryPanel = ({ species, advisoryData, isGenerating }) => {
  if (!species) {
    return (
      <div className="glass-card p-6 rounded-2xl border border-slate-200 text-center text-slate-500">
        <Sprout className="h-8 w-8 mx-auto mb-2 opacity-40 text-agrogreen-500" />
        <p className="text-sm">No pest species currently active for advisory.</p>
        <p className="text-xs mt-1">Start camera scanning to detect and analyze threats.</p>
      </div>
    );
  }

  const adviceText = advisoryData?.advice;
  const confidence = advisoryData?.confidence;
  const isPending = isGenerating || !adviceText || adviceText === "Generating advice...";

  // Format markdown helper (supports basic markdown headings and bullet lists)
  const renderAdviceBody = (text) => {
    if (!text) return null;
    
    // Split into sections or lines
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("###")) {
        return (
          <h5 key={idx} className="text-sm font-extrabold text-slate-800 mt-4 mb-2 flex items-center space-x-2">
            <span className="h-1.5 w-1.5 rounded-full bg-agrogreen-500"></span>
            <span>{line.replace("###", "").trim()}</span>
          </h5>
        );
      } else if (line.startsWith("-")) {
        const parts = line.replace("-", "").trim().split(":");
        if (parts.length > 1) {
          return (
            <div key={idx} className="pl-4 py-1 text-xs text-slate-700 leading-relaxed">
              <strong className="text-agrogreen-700 font-semibold">{parts[0]}:</strong>
              {parts.slice(1).join(":")}
            </div>
          );
        }
        return (
          <div key={idx} className="pl-4 py-1 text-xs text-slate-700 leading-relaxed list-item list-disc list-inside">
            {line.replace("-", "").trim()}
          </div>
        );
      }
      return line.trim() ? (
        <p key={idx} className="text-xs text-slate-600 leading-relaxed my-1">
          {line}
        </p>
      ) : (
        <div key={idx} className="h-2" />
      );
    });
  };

  return (
    <div className="glass-card p-6 rounded-2xl border border-agrogreen-500/30 relative overflow-hidden">
      {/* Background Accent glow */}
      <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-agrogreen-500/5 blur-xl"></div>
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
          <h3 className="font-bold text-base text-slate-800 tracking-wide">Smart Pest Detector AI Advisory</h3>
        </div>
        {confidence && (
          <span className="text-[10px] bg-agrogreen-50 border border-agrogreen-200 text-agrogreen-700 font-bold px-2 py-0.5 rounded-full">
            Match: {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block">
            Target Organism
          </span>
          <h4 className="text-lg font-bold text-slate-850 capitalize">{species}</h4>
        </div>

        {isPending ? (
          /* Loading Skeletal State */
          <div className="space-y-4 pt-2 animate-pulse">
            <div className="flex items-center space-x-2 text-agrogreen-600 text-xs font-semibold">
              <RotateCw className="h-4 w-4 animate-spin" />
              <span>Ollama Llama 3.1 is formulating organic & chemical treatments...</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 rounded w-1/3"></div>
              <div className="h-2 bg-slate-200 rounded w-5/6"></div>
              <div className="h-2 bg-slate-200 rounded w-4/5"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 rounded w-1/4"></div>
              <div className="h-2 bg-slate-200 rounded w-3/4"></div>
              <div className="h-2 bg-slate-200 rounded w-5/6"></div>
            </div>
          </div>
        ) : (
          /* Advisory Body */
          <div className="pt-2 scroll-y max-h-[350px] overflow-y-auto pr-1">
            {renderAdviceBody(adviceText)}
            <div className="mt-5 border-t border-slate-100 pt-3 flex items-center text-[10px] text-slate-500 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-agrogreen-500 mr-1.5" />
              Verified agronomy recommendations
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
