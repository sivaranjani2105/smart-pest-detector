import React, { useEffect, useState } from "react";
import { 
  FileText, Calendar, Bug, Compass, Wind, Activity, ArrowLeft, 
  RefreshCw, Coins, ShieldCheck, Award, Leaf, Sliders, Download, 
  Eye, EyeOff, Trash2 
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// Helper for leaf timelapses showing damage or recovery
const LeafTimelapse = ({ week, treated }) => {
  let leafColor = "#10b981"; // default emerald-500
  let health = 100;
  let spots = [];
  
  if (treated) {
    if (week === 1) {
      leafColor = "#84cc16"; // lime-500
      health = 45;
      spots = [
        { cx: 80, cy: 90, r: 8, color: "#a16207" },
        { cx: 120, cy: 110, r: 12, color: "#a16207" },
        { cx: 90, cy: 140, r: 10, color: "#854d0e" },
        { cx: 110, cy: 70, r: 6, color: "#a16207" },
      ];
    } else if (week === 2) {
      leafColor = "#22c55e"; // green-500
      health = 70;
      spots = [
        { cx: 80, cy: 90, r: 5, color: "#ca8a04", opacity: 0.6 },
        { cx: 120, cy: 110, r: 7, color: "#ca8a04", opacity: 0.6 },
        { cx: 90, cy: 140, r: 5, color: "#ca8a04", opacity: 0.5 },
      ];
    } else {
      leafColor = "#10b981"; // emerald-500
      health = 95;
      spots = [
        { cx: 120, cy: 110, r: 3, color: "#eab308", opacity: 0.2 },
      ];
    }
  } else {
    if (week === 1) {
      leafColor = "#84cc16"; // lime-500
      health = 45;
      spots = [
        { cx: 80, cy: 90, r: 8, color: "#a16207" },
        { cx: 120, cy: 110, r: 12, color: "#a16207" },
        { cx: 90, cy: 140, r: 10, color: "#854d0e" },
        { cx: 110, cy: 70, r: 6, color: "#a16207" },
      ];
    } else if (week === 2) {
      leafColor = "#b45309"; // amber-700/brownish
      health = 20;
      spots = [
        { cx: 80, cy: 90, r: 15, color: "#78350f" },
        { cx: 120, cy: 110, r: 20, color: "#78350f" },
        { cx: 90, cy: 140, r: 16, color: "#451a03" },
        { cx: 110, cy: 70, r: 12, color: "#78350f" },
        { cx: 130, cy: 150, r: 8, color: "#78350f" },
        { cx: 70, cy: 120, r: 10, color: "#451a03" },
      ];
    } else {
      leafColor = "#451a03"; // dark brown/dead
      health = 5;
      spots = [
        { cx: 80, cy: 90, r: 20, color: "#291303" },
        { cx: 120, cy: 110, r: 25, color: "#291303" },
        { cx: 90, cy: 140, r: 22, color: "#1a0f00" },
        { cx: 110, cy: 70, r: 16, color: "#291303" },
        { cx: 130, cy: 150, r: 12, color: "#291303" },
        { cx: 70, cy: 120, r: 14, color: "#1a0f00" },
        { cx: 100, cy: 100, r: 18, color: "#291303" },
      ];
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200/50 rounded-2xl w-full h-[180px]">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-32 h-32 drop-shadow-lg transition-all duration-500">
          <path d="M100 170 C100 170 100 190 100 195" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
          <path 
            d="M100 25 C150 70 170 130 100 170 C30 130 50 70 100 25 Z" 
            fill={leafColor} 
            className="transition-colors duration-500"
            stroke="#15803d"
            strokeWidth="2"
          />
          <path d="M100 25 L100 170" stroke="#166534" strokeWidth="2" opacity="0.25" />
          <path d="M100 70 Q130 60 145 55" stroke="#166534" strokeWidth="1.5" opacity="0.2" fill="none" />
          <path d="M100 70 Q70 60 55 55" stroke="#166534" strokeWidth="1.5" opacity="0.2" fill="none" />
          <path d="M100 100 Q140 90 155 85" stroke="#166534" strokeWidth="1.5" opacity="0.2" fill="none" />
          <path d="M100 100 Q60 90 45 85" stroke="#166534" strokeWidth="1.5" opacity="0.2" fill="none" />
          <path d="M100 130 Q130 120 145 115" stroke="#166534" strokeWidth="1.5" opacity="0.2" fill="none" />
          <path d="M100 130 Q70 120 55 115" stroke="#166534" strokeWidth="1.5" opacity="0.2" fill="none" />

          {spots.map((spot, i) => (
            <circle 
              key={i} 
              cx={spot.cx} 
              cy={spot.cy} 
              r={spot.r} 
              fill={spot.color} 
              opacity={spot.opacity !== undefined ? spot.opacity : 0.8}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <span className={`absolute bottom-0 right-0 px-2 py-0.5 text-[9px] font-extrabold rounded-full border text-white ${
          health >= 80 ? 'bg-emerald-600 border-emerald-500' :
          health >= 40 ? 'bg-amber-500 border-amber-400' : 'bg-red-600 border-red-500'
        }`}>
          Health: {health}%
        </span>
      </div>
    </div>
  );
};

// Maps coordinates to a 1-9 zone grid index (matches backend model)
const getZoneFromGps = (lat, lng) => {
  if (!lat || !lng) return 1;
  let row = 0;
  if (lat > 36.7787) {
    row = 0;
  } else if (lat >= 36.7781) {
    row = 1;
  } else {
    row = 2;
  }
  
  let col = 0;
  if (lng < -119.4180) {
    col = 0;
  } else if (lng <= -119.4170) {
    col = 1;
  } else {
    col = 2;
  }
  return row * 3 + col + 1;
};

// Helper for generating dynamic sustainability scorecard metrics
const getSustainabilityStats = (pestDetections = []) => {
  let organicCount = 0;
  let chemicalCount = 0;
  
  pestDetections.forEach(pest => {
    const species = (pest.species || "").toLowerCase();
    if (species.includes("aphid") || species.includes("mite") || species.includes("whitefly")) {
      organicCount += 2;
      chemicalCount += 1;
    } else if (species.includes("locust") || species.includes("armyworm") || species.includes("caterpillar") || species.includes("beetle")) {
      organicCount += 1;
      chemicalCount += 2;
    } else {
      organicCount += 1;
      chemicalCount += 1;
    }
  });
  
  if (pestDetections.length === 0) {
    return { organicRatio: 75, organicCount: 3, chemicalCount: 1, grade: "A", badge: "Eco-Certified" };
  }
  
  const total = organicCount + chemicalCount;
  const organicRatio = Math.round((organicCount / total) * 100);
  
  let grade = "C";
  let badge = "Standard";
  if (organicRatio >= 80) {
    grade = "A+";
    badge = "Eco-Platinum";
  } else if (organicRatio >= 70) {
    grade = "A";
    badge = "Eco-Gold";
  } else if (organicRatio >= 55) {
    grade = "B";
    badge = "Eco-Silver";
  } else if (organicRatio >= 40) {
    grade = "C";
    badge = "IPM Compliant";
  } else {
    grade = "D";
    badge = "Chem-Heavy";
  }
  
  return { organicRatio, organicCount, chemicalCount, grade, badge };
};

// Helper for preparing Recharts data binned across the session timeline
const prepareChartData = (detail) => {
  if (!detail) return [];
  const start = detail.start_time;
  const end = detail.end_time || (start + 600); // fallback 10 mins if not finished
  const duration = end - start;
  if (duration <= 0) return [];

  const numBins = 10;
  const binWidth = duration / numBins;

  const bins = Array.from({ length: numBins }, (_, i) => ({
    timeLabel: `${Math.round((i * binWidth) / 60)}m`,
    soilMoistures: [],
    pestCount: 0,
  }));

  // Populate telemetry (soil moisture)
  if (detail.telemetry_logs && detail.telemetry_logs.length > 0) {
    detail.telemetry_logs.forEach((log) => {
      const elapsed = log.timestamp - start;
      const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor(elapsed / binWidth)));
      if (log.soil_moisture !== undefined) {
        bins[binIdx].soilMoistures.push(log.soil_moisture);
      }
    });
  }

  // Populate pest detections count
  if (detail.pest_detections && detail.pest_detections.length > 0) {
    detail.pest_detections.forEach((pest) => {
      const elapsed = pest.timestamp - start;
      const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor(elapsed / binWidth)));
      bins[binIdx].pestCount += 1;
    });
  }

  // Map to final Recharts format
  return bins.map((bin) => {
    const avgMoisture = bin.soilMoistures.length > 0
      ? Math.round((bin.soilMoistures.reduce((a, b) => a + b, 0) / bin.soilMoistures.length) * 10) / 10
      : 35.0; // default/fallback average
    return {
      time: bin.timeLabel,
      "Pest Count": bin.pestCount,
      "Soil Moisture (%)": avgMoisture,
    };
  });
};

export const Reports = ({ backendUrl }) => {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Interactive yield loss estimator state
  const [estFieldSize, setEstFieldSize] = useState(10);
  const [estCropRate, setEstCropRate] = useState(800);

  // Timelapse & insurance state
  const [timelapseWeek, setTimelapseWeek] = useState(1);
  const [timelapseTreated, setTimelapseTreated] = useState(false);
  const [exportingInsurance, setExportingInsurance] = useState(false);

  // Advanced Filters states
  const [filterSpecies, setFilterSpecies] = useState("all");
  const [filterMinConfidence, setFilterMinConfidence] = useState(0.4);
  const [filterZone, setFilterZone] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Export to CSV Log
  const handleExportCSV = () => {
    if (!reportDetail || !reportDetail.pest_detections) return;
    
    const headers = ["Timestamp", "Species", "Confidence", "Latitude", "Longitude", "Zone", "Life Stage", "Severity", "Track ID", "Verification Status"];
    
    const rows = filteredDetections.map(d => {
      const lat = d.gps?.lat || "";
      const lng = d.gps?.lng || "";
      const zone = getZoneFromGps(lat, lng);
      const dateStr = new Date(d.timestamp * 1000).toISOString();
      return [
        dateStr,
        d.species || "",
        d.confidence || "",
        lat,
        lng,
        zone,
        d.life_stage || "N/A",
        d.severity || "N/A",
        d.track_id || "N/A",
        d.needs_review ? "Pending Review" : "Verified"
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smart_pest_detections_report_${selectedReportId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler for exporting geotagged insurance claim certificate PDF
  const handleExportInsurancePDF = async () => {
    setExportingInsurance(true);
    const input = document.getElementById("insurance-certificate-content");
    if (!input) {
      setExportingInsurance(false);
      return;
    }
    
    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Smart Pest Detector_Insurance_Certificate_${selectedReportId}.pdf`);
    } catch (error) {
      console.error("Error generating Insurance Certificate PDF:", error);
      alert("Failed to export Insurance Certificate. Please try again.");
    } finally {
      setExportingInsurance(false);
    }
  };

  // Fetch reports list
  const fetchReportsList = async () => {
    setLoadingList(true);
    try {
      const response = await fetch(`${backendUrl}/api/reports`);
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchReportsList();
  }, [backendUrl]);

  // Fetch report details
  const fetchReportDetail = async (id) => {
    setLoadingDetail(true);
    setSelectedReportId(id);
    try {
      const response = await fetch(`${backendUrl}/api/reports/${id}`);
      if (response.ok) {
        const data = await response.json();
        setReportDetail(data);
      }
    } catch (error) {
      console.error("Error fetching report details:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedReportId(null);
    setReportDetail(null);
    fetchReportsList();
  };

  const handleExportPDF = async () => {
    const input = document.getElementById("report-pdf-content");
    if (!input) return;

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Smart Pest Detector_Report_${selectedReportId}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to export PDF report. Please try again.");
    }
  };

  // Basic markdown compiler for report summaries
  const renderMarkdown = (text) => {
    if (!text) return null;
    
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("# ")) {
        return (
          <h3 key={idx} className="text-xl font-extrabold text-slate-800 mt-6 mb-3 border-b border-slate-100 pb-2">
            {line.replace("# ", "").trim()}
          </h3>
        );
      } else if (line.startsWith("## ")) {
        return (
          <h4 key={idx} className="text-lg font-bold text-slate-800 mt-5 mb-2.5">
            {line.replace("## ", "").trim()}
          </h4>
        );
      } else if (line.startsWith("### ")) {
        return (
          <h5 key={idx} className="text-sm font-bold text-emerald-650 mt-4 mb-2">
            {line.replace("### ", "").trim()}
          </h5>
        );
      } else if (line.startsWith("- ")) {
        const parts = line.replace("- ", "").trim().split(":");
        if (parts.length > 1) {
          return (
            <div key={idx} className="pl-4 py-1 text-xs text-slate-600">
              <strong className="text-emerald-700 font-semibold">{parts[0]}:</strong>
              {parts.slice(1).join(":")}
            </div>
          );
        }
        return (
          <div key={idx} className="pl-4 py-1 text-xs text-slate-600 list-item list-disc list-inside">
            {line.replace("- ", "").trim()}
          </div>
        );
      } else if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <p key={idx} className="text-xs font-bold text-slate-800 my-2">
            {line.replace(/\*\*/g, "").trim()}
          </p>
        );
      }
      return line.trim() ? (
        <p key={idx} className="text-xs text-slate-600 leading-relaxed my-2">
          {line}
        </p>
      ) : (
        <div key={idx} className="h-2" />
      );
    });
  };

  // Filter archived reports list by date range
  const filteredReportsList = reports.filter(r => {
    if (filterStartDate) {
      const startLimit = new Date(filterStartDate).getTime() / 1000;
      if (r.start_time < startLimit) return false;
    }
    if (filterEndDate) {
      const endLimit = (new Date(filterEndDate).getTime() / 1000) + 86400;
      if (r.start_time > endLimit) return false;
    }
    return true;
  });

  // Filter detections inside a specific report detail
  const filteredDetections = (reportDetail?.pest_detections || []).filter(d => {
    if (filterSpecies !== "all") {
      const sp = (d.species || "").toLowerCase();
      if (filterSpecies === "beneficial") {
        if (!d.beneficial) return false;
      } else {
        if (!sp.includes(filterSpecies)) return false;
      }
    }
    
    if (filterZone !== "all") {
      const z = getZoneFromGps(d.gps?.lat, d.gps?.lng);
      if (String(z) !== filterZone) return false;
    }
    
    if (d.confidence < filterMinConfidence) return false;
    
    return true;
  });

  const severeCount = filteredDetections.filter(d => d.severity === "severe").length;
  const moderateCount = filteredDetections.filter(d => d.severity === "moderate").length;
  const lowCount = filteredDetections.filter(d => d.severity === "low" || !d.severity).length;
  const lossPercent = Math.min(85, (severeCount * 7.0) + (moderateCount * 3.0) + (lowCount * 1.0));
  const financialLoss = estFieldSize * estCropRate * (lossPercent / 100);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Detail View */}
      {selectedReportId ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCloseDetail}
                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800 capitalize tracking-wide">
                  Session Report Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: {selectedReportId}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-705 font-bold rounded-xl text-xs tracking-wider transition-all shadow-sm"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                <span>EXPORT CSV LOG</span>
              </button>
              <button
                onClick={handleExportInsurancePDF}
                disabled={exportingInsurance}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs tracking-wider transition-all shadow-sm"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>{exportingInsurance ? "GENERATING CERT..." : "EXPORT INSURANCE EVIDENCE"}</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white font-bold rounded-xl text-xs tracking-wider transition-all shadow-md shadow-emerald-600/10"
              >
                <FileText className="h-4 w-4" />
                <span>EXPORT PDF REPORT</span>
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="glass-card p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="h-8 w-8 text-agrogreen-650 animate-spin" />
              <p className="text-xs text-slate-500">Retrieving full crop health report...</p>
            </div>
          ) : (
            reportDetail && (
              <div id="report-pdf-content" className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white p-4 rounded-2xl">
                {/* Left 2 Columns: Summary document */}
                <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                    <FileText className="h-5 w-5 text-agrogreen-655" />
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      AI Generated Analysis
                    </h3>
                  </div>

                  <div className="prose max-w-none">
                    {renderMarkdown(reportDetail.report_summary)}
                  </div>

                  {/* Pest Pressure & Soil Moisture Analytics */}
                  <div className="border-t border-slate-100 pt-6 mt-6 space-y-4">
                    <div className="flex items-center space-x-2 pb-2">
                      <Activity className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                        Pest Pressure & Soil Moisture Timeseries
                      </h3>
                    </div>
                    <div className="h-[250px] w-full bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={prepareChartData(reportDetail)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis yAxisId="left" stroke="#10b981" fontSize={10} tickLine={false} allowDecimals={false} label={{ value: 'Pest Detections', angle: -90, position: 'insideLeft', offset: 10, fill: '#059669', fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={10} tickLine={false} label={{ value: 'Soil Moisture (%)', angle: 90, position: 'insideRight', offset: 10, fill: '#1d4ed8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', color: '#1e293b' }} />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          <Bar yAxisId="left" dataKey="Pest Count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                          <Line yAxisId="right" type="monotone" dataKey="Soil Moisture (%)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      Correlates localized biological pest counts with real-time soil moisture sensors across the session timeline.
                    </p>
                  </div>

                  {/* Infestation Progression Timelapse & Sustainability Scorecard */}
                  <div className="border-t border-slate-100 pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Timelapse card */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Sliders className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                          Infestation Progression Timelapse
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Visualize simulated crop health and pest damage decay/recovery over a 3-week interval.
                      </p>
                      
                      <LeafTimelapse week={timelapseWeek} treated={timelapseTreated} />

                      {/* Interactive Controls */}
                      <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                          <span>Timeline Stage:</span>
                          <span className="text-emerald-700 font-bold">Week {timelapseWeek}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          value={timelapseWeek}
                          onChange={(e) => setTimelapseWeek(Number(e.target.value))}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-slate-650">Treatment Plan:</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setTimelapseTreated(false)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                !timelapseTreated 
                                  ? 'bg-amber-600 border-amber-500 text-white' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              Untreated
                            </button>
                            <button
                              onClick={() => setTimelapseTreated(true)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                timelapseTreated 
                                  ? 'bg-emerald-600 border-emerald-500 text-white' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              Treated
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sustainability Scorecard card */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Award className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                          Sustainability Scorecard
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Tracks biological/organic recommendations compared to chemical treatments for local crop management.
                      </p>

                      {(() => {
                        const stats = getSustainabilityStats(reportDetail.pest_detections);
                        return (
                          <div className="p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl space-y-4 flex flex-col justify-between h-[230px]">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Eco-Grade</span>
                                <span className="text-3xl font-extrabold text-emerald-805 tracking-tight">{stats.grade}</span>
                              </div>
                              <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex items-center space-x-1">
                                <Leaf className="h-3 w-3 text-emerald-700 fill-emerald-700" opacity="0.8" />
                                <span className="text-[9px] font-extrabold text-emerald-805 uppercase tracking-wider">{stats.badge}</span>
                              </div>
                            </div>

                            {/* Ratio Gauge Bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-slate-600">Organic IPM Ratio:</span>
                                <span className="text-emerald-700 font-bold">{stats.organicRatio}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                                <div style={{ width: `${stats.organicRatio}%` }} className="bg-emerald-600 h-full" />
                                <div style={{ width: `${100 - stats.organicRatio}%` }} className="bg-slate-300 h-full" />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 font-medium">
                                <span>Organic: {stats.organicCount} recommendations</span>
                                <span>Chemical: {stats.chemicalCount}</span>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-500 leading-normal italic pt-2 border-t border-slate-100">
                              {stats.organicRatio >= 60 
                                ? "Excellent! Your IPM workflow minimizes chemical residues and qualifies for local eco-certified marketing badges."
                                : "IPM Alert: High reliance on chemical agents. Consider biological releases (e.g. Chrysoperla carnea) to boost your eco-grade."
                              }
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Column: Telemetry Summary & Detections List */}
                <div className="space-y-6">
                  {/* Session specs details */}
                  <div className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <Calendar className="h-5 w-5 text-slate-500" />
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Session Specs
                      </h3>
                    </div>
                    
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Started:</span>
                        <span className="text-slate-800 font-bold">
                          {new Date(reportDetail.start_time * 1000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Ended:</span>
                        <span className="text-slate-800 font-bold">
                          {reportDetail.end_time
                            ? new Date(reportDetail.end_time * 1000).toLocaleString()
                            : "In progress"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Telemetry Logs:</span>
                        <span className="text-slate-800 font-mono font-bold">
                          {reportDetail.telemetry_logs?.length || 0} frames
                        </span>
                      </div>
                      {reportDetail.summary_stats && (
                        <>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500 font-medium">Avg PM2.5:</span>
                            <span className="text-slate-800 font-bold">
                              {reportDetail.summary_stats.avg_pm25} ug/m3
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500 font-medium">Avg Air Quality:</span>
                            <span className="text-slate-800 font-bold">
                              {reportDetail.summary_stats.avg_mq135} PPM
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Avg Soil Moisture:</span>
                            <span className="text-slate-800 font-bold">
                              {reportDetail.summary_stats.avg_soil_moisture || 35.0}%
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pest list with Advanced Filtering */}
                  <div className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <Bug className="h-5 w-5 text-red-500" />
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                          Detections Feed Log
                        </h3>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded font-extrabold">
                        {filteredDetections.length} showing
                      </span>
                    </div>

                    {/* Filter fields */}
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-550 uppercase tracking-wider mb-1">Filter Species</label>
                          <select
                            value={filterSpecies}
                            onChange={(e) => setFilterSpecies(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700 text-[11px] cursor-pointer"
                          >
                            <option value="all">All Species</option>
                            <option value="locust">Locust</option>
                            <option value="armyworm">Fall Armyworm</option>
                            <option value="aphid">Aphids</option>
                            <option value="mite">Spider Mites</option>
                            <option value="beneficial">Beneficial Insects</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-550 uppercase tracking-wider mb-1">Filter Zone</label>
                          <select
                            value={filterZone}
                            onChange={(e) => setFilterZone(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700 text-[11px] cursor-pointer"
                          >
                            <option value="all">All Zones</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(z => (
                              <option key={z} value={String(z)}>Zone {z}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-550 uppercase tracking-wider mb-1">
                          <span>Min Confidence:</span>
                          <span className="text-emerald-700 font-extrabold">{Math.round(filterMinConfidence * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="0.95"
                          step="0.05"
                          value={filterMinConfidence}
                          onChange={(e) => setFilterMinConfidence(Number(e.target.value))}
                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                      </div>
                    </div>

                    {filteredDetections.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2 text-center italic">No detections match the filters.</p>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                        {filteredDetections.map((d, idx) => {
                          const isBeneficial = d.beneficial || false;
                          const zoneId = getZoneFromGps(d.gps?.lat, d.gps?.lng);
                          return (
                            <div
                              key={idx}
                              className={`p-3 border rounded-xl text-xs flex justify-between items-center ${
                                isBeneficial 
                                  ? 'bg-emerald-50/40 border-emerald-100' 
                                  : 'bg-slate-50/50 border-slate-205'
                              }`}
                            >
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="font-bold text-slate-805 capitalize">{d.species}</p>
                                  <span className="text-[9px] font-bold bg-slate-200/80 px-1 rounded text-slate-600">
                                    Zone {zoneId}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(d.timestamp * 1000).toLocaleTimeString()}
                                </span>
                              </div>
                              <span className={`text-[10px] font-extrabold ${isBeneficial ? 'text-emerald-700' : 'text-red-650'}`}>
                                {Math.round(d.confidence * 100)}% Match
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Yield Loss Financial Impact Estimator Card */}
                  <div className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                      <Coins className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Yield Loss Estimator
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {/* Interactive inputs */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                            <span>Field Size:</span>
                            <span className="text-emerald-700 font-bold">{estFieldSize} Acres</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={estFieldSize}
                            onChange={(e) => setEstFieldSize(Number(e.target.value))}
                            className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                            <span>Expected Crop Rate:</span>
                            <span className="text-emerald-700 font-bold">${estCropRate} / Acre</span>
                          </div>
                          <input
                            type="range"
                            min="100"
                            max="5000"
                            step="50"
                            value={estCropRate}
                            onChange={(e) => setEstCropRate(Number(e.target.value))}
                            className="w-full h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>
                      </div>

                      {/* Calculations display */}
                      <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-650 font-medium">Calculated Loss Risk:</span>
                          <span className={`font-bold uppercase ${lossPercent > 20 ? 'text-red-650' : lossPercent > 5 ? 'text-orange-600' : lossPercent > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {lossPercent > 20 ? 'Severe Risk' : lossPercent > 5 ? 'Moderate Risk' : lossPercent > 0 ? 'Low Risk' : 'No Threat'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-650 font-medium">Estimated Yield Loss %:</span>
                          <span className="text-slate-800 font-extrabold">{lossPercent.toFixed(1)}%</span>
                        </div>
                        <div className="border-t border-emerald-100/60 pt-2 flex justify-between items-center">
                          <span className="text-xs text-slate-650 font-bold">Est. Financial Impact:</span>
                          <span className="text-base font-extrabold text-emerald-800">
                            ${financialLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 leading-normal bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-705 block mb-0.5">Calculation Formula:</span>
                        Acres ({estFieldSize}) &times; Severity Multiplier ({ (lossPercent / 100).toFixed(3) }) &times; Crop Value (${estCropRate}). 
                        Detections: {severeCount} severe (7% loss each), {moderateCount} moderate (3% loss each), {lowCount} low (1% loss each).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insurance Claim Evidence Document (Preview & Download Panel) */}
                <div className="col-span-full glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Insurance Claim Evidence Certificate Preview
                      </h3>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                    <div 
                      id="insurance-certificate-content" 
                      className="min-w-[650px] w-full max-w-[700px] bg-white text-slate-900 p-8 border-[6px] border-double border-emerald-700 rounded-lg shadow-sm space-y-6"
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      <div className="border border-emerald-600 p-6 space-y-6">
                        {/* Certificate Header */}
                        <div className="text-center space-y-2 border-b-2 border-emerald-700 pb-4">
                          <h2 className="text-xl font-bold uppercase tracking-wider text-emerald-800">
                            Certificate of Crop Damage & Infestation Evidence
                          </h2>
                          <p className="text-[10px] uppercase font-sans tracking-widest text-slate-500 font-bold">
                            Verified by Smart Pest Detector AI Platform
                          </p>
                        </div>

                        {/* Certificate Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                          <div className="space-y-1.5">
                            <p><span className="text-slate-500 font-semibold uppercase text-[9px]">Certificate ID:</span> <span className="font-mono font-bold text-slate-800">AS-CERT-{selectedReportId?.substring(0, 8).toUpperCase() || "N/A"}</span></p>
                            <p><span className="text-slate-500 font-semibold uppercase text-[9px]">Timestamp:</span> <span className="font-bold text-slate-800">{new Date(reportDetail.start_time * 1000).toLocaleString()}</span></p>
                            <p><span className="text-slate-500 font-semibold uppercase text-[9px]">Location (GPS):</span> <span className="font-bold text-emerald-750">36.7783° N, -119.4179° W (Zone {getZoneFromGps(reportDetail.pest_detections?.[0]?.gps?.lat, reportDetail.pest_detections?.[0]?.gps?.lng)})</span></p>
                          </div>
                          <div className="space-y-1.5 text-right">
                            <p><span className="text-slate-500 font-semibold uppercase text-[9px]">Platform Signature:</span> <span className="font-mono font-bold text-xs text-slate-800">SHA256:{selectedReportId?.substring(0, 16) || "hash"}</span></p>
                            <p><span className="text-slate-500 font-semibold uppercase text-[9px]">Device ID:</span> <span className="font-bold text-slate-800">Rover-Edge-Pi-4B-01</span></p>
                            <p><span className="text-slate-500 font-semibold uppercase text-[9px]">Status:</span> <span className="font-bold text-red-650 uppercase border border-red-205 px-1.5 py-0.5 rounded bg-red-50">Verified Damage</span></p>
                          </div>
                        </div>

                        {/* Damage Summary Table */}
                        <div className="space-y-2">
                          <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                            Verified Biological Detections
                          </h3>
                          <table className="w-full text-xs font-sans">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[9px] font-bold text-left">
                                <th className="py-1">Pest Species</th>
                                <th className="py-1 text-center">Count</th>
                                <th className="py-1 text-right">Avg Confidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(
                                (filteredDetections || []).reduce((acc, curr) => {
                                  acc[curr.species] = acc[curr.species] || { count: 0, sumConf: 0 };
                                  acc[curr.species].count += 1;
                                  acc[curr.species].sumConf += curr.confidence;
                                  return acc;
                                }, {})
                              ).map(([species, stats]) => (
                                <tr key={species} className="border-b border-slate-100 text-slate-800">
                                  <td className="py-1.5 font-semibold capitalize">{species}</td>
                                  <td className="py-1.5 text-center font-bold">{stats.count}</td>
                                  <td className="py-1.5 text-right font-mono">{(stats.sumConf / stats.count * 100).toFixed(1)}%</td>
                                </tr>
                              ))}
                              {(filteredDetections.length === 0) && (
                                <tr>
                                  <td colSpan="3" className="py-3 text-center text-slate-500 italic">No pest detections match the filters.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Financial & Yield Estimates */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-center font-sans">
                          <div>
                            <span className="text-[9px] text-slate-500 font-semibold uppercase block">Affected Area</span>
                            <span className="text-sm font-bold text-slate-800">{estFieldSize} Acres</span>
                          </div>
                          <div className="border-x border-slate-200">
                            <span className="text-[9px] text-slate-500 font-semibold uppercase block">Est. Yield Loss</span>
                            <span className="text-sm font-bold text-red-650">{lossPercent.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-semibold uppercase block">Certified Loss Value</span>
                            <span className="text-sm font-extrabold text-emerald-800">${financialLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-8 pt-8 font-sans">
                          <div className="space-y-4">
                            <div className="border-t border-slate-300 text-center pt-1.5">
                              <p className="text-[9px] font-semibold uppercase text-slate-500">System Validator Signature</p>
                              <p className="font-mono text-[8px] text-slate-400 mt-0.5">Digital Sign: [Rover-Inference-Engine]</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="border-t border-slate-300 text-center pt-1.5">
                              <p className="text-[9px] font-semibold uppercase text-slate-500">Authorized Crop Witness</p>
                              <p className="font-mono text-[8px] text-slate-400 mt-0.5">Signature: ______________________</p>
                            </div>
                          </div>
                        </div>

                        {/* Footer legal text */}
                        <p className="text-[8px] text-slate-400 text-center leading-normal pt-4 font-sans">
                          Disclaimer: This certificate is programmatically compiled based on edge-rover AI camera detections and real-time environment telemetry. It serves as secondary verification evidence for crop loss underwriting.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        /* Reports List View */
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-wide">AI Session Reports</h2>
              <p className="text-xs text-slate-500 mt-1">
                Access archive files of previous crop monitoring runs with LLM health summaries.
              </p>
            </div>
            <button
              onClick={fetchReportsList}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-colors shadow-sm"
              title="Refresh List"
            >
              <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Collapsible Date Filter Panel */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-emerald-600" />
              <span>Filter Archived Sessions by Date Range</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-slate-400">Start Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-slate-400">End Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterStartDate("");
                    setFilterEndDate("");
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                >
                  Reset Date Filter
                </button>
              </div>
            </div>
          </div>

          {loadingList ? (
            <div className="glass-card p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="h-8 w-8 text-agrogreen-650 animate-spin" />
              <p className="text-xs text-slate-500">Loading session history...</p>
            </div>
          ) : filteredReportsList.length === 0 ? (
            <div className="glass-card p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-600" />
              <h4 className="font-bold text-slate-800 text-sm">No Compiled Sessions Found</h4>
              <p className="text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
                No archived session reports match your specified date range filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredReportsList.map((report) => (
                <div
                  key={report.id}
                  onClick={() => fetchReportDetail(report.id)}
                  className="glass-card glass-card-hover p-6 rounded-2xl border border-slate-200 flex flex-col justify-between cursor-pointer space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">
                        {report.id.replace("_", " ")}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {new Date(report.start_time * 1000).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-slate-650 font-bold uppercase tracking-wider">
                      Archived
                    </span>
                  </div>

                  {report.summary_stats && (
                    <div className="grid grid-cols-3 gap-3 text-center text-xs py-1">
                      <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        <Bug className="h-3.5 w-3.5 mx-auto mb-1 text-red-500" />
                        <span className="text-[9px] text-slate-500 font-bold block">PESTS</span>
                        <span className="font-extrabold text-slate-850">
                          {report.summary_stats.pest_count || 0}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        <Wind className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-650" />
                        <span className="text-[9px] text-slate-500 font-bold block">AVG PM</span>
                        <span className="font-extrabold text-slate-850">
                          {report.summary_stats.avg_pm25 || 15}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-200/60">
                        <Activity className="h-3.5 w-3.5 mx-auto mb-1 text-blue-500" />
                        <span className="text-[9px] text-slate-500 font-bold block">AVG GAS</span>
                        <span className="font-extrabold text-slate-850">
                          {report.summary_stats.avg_mq135 || 200}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-emerald-700 font-bold flex items-center justify-end">
                    View Complete Report &rarr;
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
