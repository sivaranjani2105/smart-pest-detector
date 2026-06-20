import React, { useState } from "react";
import { useSensorSocket } from "./hooks/useSensorSocket";
import { Dashboard } from "./pages/Dashboard";
import { Scanner } from "./pages/Scanner";
import { MapView } from "./pages/MapView";
import { Reports } from "./pages/Reports";
import { LiveMonitor } from "./pages/LiveMonitor";
import { IrrigationControl } from "./pages/IrrigationControl";
import { AIChatWidget } from "./components/chat/AIChatWidget";
import { LayoutDashboard, Camera, Map, FileText, Sprout, Wifi, WifiOff, Activity, Droplets } from "lucide-react";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [userRole, setUserRole] = useState("farmer");
  const [chatContext, setChatContext] = useState(null);
  
  const {
    connected,
    telemetry,
    alerts,
    advisories,
    latestDetection,
    acknowledgeAlert,
    backendUrl
  } = useSensorSocket();

  // Navigation handlers
  const navigateToReports = () => setCurrentPage("reports");

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: "scanner", label: "Scanner", icon: <Camera className="h-5 w-5" /> },
    { id: "monitor", label: "Live Monitor", icon: <Activity className="h-5 w-5" /> },
    { id: "irrigation", label: "Irrigation", icon: <Droplets className="h-5 w-5" /> },
    { id: "map", label: "Map View", icon: <Map className="h-5 w-5" /> },
    { id: "reports", label: "Reports", icon: <FileText className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 font-sans">
      
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-slate-200 p-5 space-y-6 flex-shrink-0 shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center space-x-2.5 px-2 pb-2">
          <div className="rounded-xl bg-gradient-to-br from-agrogreen-400 to-agrogreen-700 p-2 shadow-lg shadow-agrogreen-100">
            <Sprout className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base tracking-wide leading-none">Smart Pest Detector AI</h1>
            <span className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5 block">SMART PLATFORM</span>
          </div>
        </div>

        {/* WebSocket Connection Status Widget */}
        <div className={`mx-2 p-3 rounded-xl border flex items-center justify-between transition-colors ${
          connected 
            ? "bg-agrogreen-50 border-agrogreen-100 text-agrogreen-700"
            : "bg-red-50 border-red-100 text-red-700"
        }`}>
          <div className="flex items-center space-x-2">
            {connected ? (
              <Wifi className="h-4 w-4 text-agrogreen-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
            <span className="text-[10px] font-bold tracking-wider uppercase">
              {connected ? "Station Linked" : "Station Offline"}
            </span>
          </div>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-agrogreen-500 animate-pulse" : "bg-red-500"}`}></span>
        </div>
        
        {/* Role Selector Dropdown */}
        <div className="mx-2 p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col space-y-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-bold">Active User Role</label>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none text-slate-700 cursor-pointer"
          >
            <option value="farmer">Farmer (Valley Green)</option>
            <option value="agronomist">Agronomist (Coop)</option>
            <option value="admin">System Admin</option>
          </select>
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 space-y-1.5 pt-4">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                  active
                    ? "bg-agrogreen-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="text-[10px] text-slate-400 px-2 pt-2 border-t border-slate-200">
          <p>© 2026 Smart Pest Detector AI</p>
          <p className="mt-0.5 font-mono">Ver. 1.0.0 (YOLOv11+Llama3.1)</p>
        </div>
      </aside>

      {/* Top Navbar Navigation (Mobile/Tablet view) */}
      <header className="md:hidden bg-white/95 border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur shadow-sm">
        <div className="flex items-center space-x-2">
          <Sprout className="h-5 w-5 text-agrogreen-500" />
          <span className="font-extrabold text-slate-900 text-sm tracking-wide">Smart Pest Detector AI</span>
        </div>
        <div className="flex items-center space-x-3">
          {/* Mobile Connection status */}
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-agrogreen-500 animate-pulse" : "bg-red-500"}`}></span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full pb-24 md:pb-8">
        {currentPage === "dashboard" && (
          <Dashboard
            telemetry={telemetry}
            alerts={alerts}
            onAcknowledgeAlert={acknowledgeAlert}
            backendUrl={backendUrl}
            navigateToReports={navigateToReports}
            userRole={userRole}
          />
        )}
        {currentPage === "scanner" && (
          <Scanner 
            backendUrl={backendUrl} 
            advisories={advisories} 
            userRole={userRole}
            setChatContext={setChatContext}
            telemetry={telemetry}
          />
        )}
        {currentPage === "monitor" && (
          <LiveMonitor 
            telemetry={telemetry} 
          />
        )}
        {currentPage === "irrigation" && (
          <IrrigationControl 
            backendUrl={backendUrl}
            telemetry={telemetry}
          />
        )}
        {currentPage === "map" && (
          <MapView 
            telemetry={telemetry} 
            backendUrl={backendUrl}
          />
        )}
        {currentPage === "reports" && (
          <Reports 
            backendUrl={backendUrl} 
            userRole={userRole}
          />
        )}
      </main>

      {/* Bottom Navigation Bar (Mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 border-t border-slate-200 px-4 py-2.5 flex justify-around items-center z-50 backdrop-blur shadow-lg">
        {navItems.map((item) => {
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex flex-col items-center space-y-1.5 transition-colors ${
                active ? "text-agrogreen-600 font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {item.icon}
              <span className="text-[9px] uppercase tracking-wider font-semibold">{item.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating AI Chatbot Widget */}
      <AIChatWidget 
        backendUrl={backendUrl} 
        chatContext={chatContext}
        setChatContext={setChatContext}
      />
    </div>
  );
}

export default App;
