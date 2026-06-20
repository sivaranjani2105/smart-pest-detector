import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Rectangle } from "react-leaflet";
import L from "leaflet";
import { Compass, Navigation, Radio, Map as MapIcon, Sliders, Droplets, Globe, ExternalLink } from "lucide-react";
import { useTranslation } from "../context/TranslationContext";

// Fix for Leaflet default icon path issues in React build systems
// We define a high-tech glowing SVG divIcon instead of loading image files
const createRoverIcon = () => {
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center h-8 w-8">
        <div class="absolute h-8 w-8 rounded-full bg-agrogreen-500/30 animate-ping"></div>
        <div class="absolute h-5 w-5 rounded-full bg-agrogreen-600/60 border border-agrogreen-300"></div>
        <div class="h-2.5 w-2.5 rounded-full bg-white shadow-sm"></div>
      </div>
    `,
    className: "custom-rover-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -10]
  });
};

// Component to dynamically pan the map viewport as the rover coordinates update
const RecenterMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center);
    }
  }, [center, map]);
  return null;
};

export const MapView = ({ telemetry, backendUrl }) => {
  const { t } = useTranslation();
  const defaultLat = 10.7905;
  const defaultLng = 78.7047;
  
  const currentLat = telemetry?.gps?.lat !== undefined ? telemetry.gps.lat : defaultLat;
  const currentLng = telemetry?.gps?.lng !== undefined ? telemetry.gps.lng : defaultLng;
  const currentPos = [currentLat, currentLng];

  const [pathHistory, setPathHistory] = useState([]);
  const [followRover, setFollowRover] = useState(true);

  // New states for risk zones and sensor node pins
  const [riskZones, setRiskZones] = useState([]);
  const [sensorHealth, setSensorHealth] = useState(null);

  const fetchRiskZones = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/pest-risk`);
      if (response.ok) {
        const data = await response.json();
        setRiskZones(data.zones || []);
      }
    } catch (err) {
      console.error("Error fetching pest risk zones:", err);
    }
  };

  const fetchSensorHealth = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/sensors/health`);
      if (response.ok) {
        const data = await response.json();
        setSensorHealth(data);
      }
    } catch (err) {
      console.error("Error fetching sensor health:", err);
    }
  };

  useEffect(() => {
    fetchRiskZones();
    fetchSensorHealth();
    const interval = setInterval(() => {
      fetchRiskZones();
      fetchSensorHealth();
    }, 4000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  // Append new telemetry coordinate to the path history trail
  useEffect(() => {
    if (telemetry?.gps?.lat && telemetry?.gps?.lng) {
      setPathHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last[0] === telemetry.gps.lat && last[1] === telemetry.gps.lng) {
          return prev;
        }
        return [...prev, [telemetry.gps.lat, telemetry.gps.lng]].slice(-200);
      });
    }
  }, [telemetry]);

  const clearPathTrail = () => {
    setPathHistory([]);
  };

  // Helper mapping 1-9 zone IDs to layout offsets x, y
  const zoneOffsets = {
    1: { x: -1.5, y: 0.5, name: "Sector A1 - North West" },
    2: { x: -0.5, y: 0.5, name: "Sector A2 - North" },
    3: { x: 0.5, y: 0.5, name: "Sector A3 - North East" },
    4: { x: -1.5, y: -0.5, name: "Sector B1 - West" },
    5: { x: -0.5, y: -0.5, name: "Sector B2 - Center" },
    6: { x: 0.5, y: -0.5, name: "Sector B3 - East" },
    7: { x: -1.5, y: -1.5, name: "Sector C1 - South West" },
    8: { x: -0.5, y: -1.5, name: "Sector C2 - South" },
    9: { x: 0.5, y: -1.5, name: "Sector C3 - South East" }
  };

  const latHeight = 0.0006;
  const lngWidth = 0.0008;

  // Custom Leaflet DivIcon for IoT sensor node status
  const createSensorIcon = (status) => {
    const colorClass = status === "online" ? "bg-emerald-550 border-emerald-350" : "bg-red-500 border-red-300 animate-pulse";
    return new L.DivIcon({
      html: `
        <div class="relative flex items-center justify-center h-6 w-6">
          <div class="absolute h-6 w-6 rounded-full ${colorClass} opacity-40"></div>
          <div class="absolute h-3.5 w-3.5 rounded-full ${colorClass} border border-white"></div>
        </div>
      `,
      className: "custom-sensor-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -6]
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn h-full flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-wide">Rover Field Map</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time GPS mapping & field path coordinates of the autonomous sensor rover.
          </p>
        </div>
        <div className="mt-3 md:mt-0 flex space-x-2">
          <button
            onClick={() => setFollowRover((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              followRover
                ? "bg-agrogreen-50 border-agrogreen-200 text-agrogreen-700"
                : "bg-white border-slate-200 text-slate-500 hover:text-slate-900"
            }`}
          >
            <Navigation className={`h-3.5 w-3.5 ${followRover ? "rotate-45" : ""}`} />
            <span>{followRover ? "Lock Map Center" : "Free Roam"}</span>
          </button>
          <button
            onClick={clearPathTrail}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Clear Trail
          </button>
        </div>
      </div>

      {/* Map Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
        {/* Left Column: Coordinates details */}
        <div className="glass-card p-6 rounded-2xl border border-slate-200 flex flex-col justify-between lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Radio className="h-5 w-5 text-agrogreen-600 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                Telemetry Station
              </h3>
            </div>
            
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                  Latitude
                </span>
                <span className="text-base font-mono font-extrabold text-slate-800">
                  {currentLat.toFixed(7)}
                </span>
              </div>
              
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                  Longitude
                </span>
                <span className="text-base font-mono font-extrabold text-slate-800">
                  {currentLng.toFixed(7)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                  Path Coordinates Logged
                </span>
                <span className="text-base font-extrabold text-agrogreen-700">
                  {pathHistory.length} nodes
                </span>
              </div>
            </div>

            {/* Closed-loop Smart Sprayer Nozzle Status Card */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              telemetry?.sprayer_active 
                ? "bg-emerald-50 border-emerald-350 text-emerald-800 animate-pulse" 
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}>
              <div className="flex items-center space-x-2">
                <Droplets className={`h-5 w-5 ${telemetry?.sprayer_active ? 'text-emerald-600 animate-bounce' : 'text-slate-400'}`} />
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest block">Closed-Loop Sprayer</span>
                  <span className="text-xs font-bold text-slate-800">
                    {telemetry?.sprayer_active ? "SPRAY NOZZLE ACTIVE" : "SPRAYER STANDBY"}
                  </span>
                </div>
              </div>
              {telemetry?.sprayer_active && (
                <p className="text-[9px] text-emerald-705 mt-2 font-medium bg-white/70 p-1.5 rounded border border-emerald-250 leading-normal">
                  ⚠️ [AUTO-ACTUATOR TRIGGERED] Spot spraying severe locust zone. Applying targeted dosage: {telemetry.sprayer_dosage_rate || 2.5} L/Acre.
                </p>
              )}
            </div>

            {/* Tamil Nadu e-Sevai Services Integration */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Globe className="h-4 w-4 text-agrogreen-600 animate-spin-slow" />
                <div>
                  <h4 className="text-xs font-bold text-slate-850 tracking-wide">
                    {t('esevaiPortal')}
                  </h4>
                  <span className="text-[9px] text-slate-400 block leading-tight mt-0.5">
                    {t('esevaiSubtitle')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1.5 text-[10px]">
                <a
                  href="https://www.tnesevai.tn.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded bg-white hover:bg-slate-50 border border-slate-150 transition-colors font-medium text-slate-700"
                >
                  <span>{t('esevaiApplySubsidies')}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
                <a
                  href="https://www.tnesevai.tn.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded bg-white hover:bg-slate-50 border border-slate-150 transition-colors font-medium text-slate-700"
                >
                  <span>{t('esevaiCropInsurance')}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
                <a
                  href="https://www.tnesevai.tn.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded bg-white hover:bg-slate-50 border border-slate-150 transition-colors font-medium text-slate-700"
                >
                  <span>{t('esevaiPestCompensation')}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <MapIcon className="h-4 w-4 text-agrogreen-600" />
              <span>Map Layer: OpenStreetMap</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              GPS telemetry traces a light map overlay to outline agricultural path coverage. Ensure internet access is active to load map tiles online.
            </p>
          </div>
        </div>

        {/* Right 3 Columns: Leaflet Map */}
        <div className="lg:col-span-3 h-full rounded-2xl overflow-hidden border border-slate-200 bg-white relative shadow-inner">
          <MapContainer
            center={currentPos}
            zoom={16}
            scrollWheelZoom={true}
            className="w-full h-full min-h-[480px]"
          >
            {/* OpenStreetMap TileLayer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Rover Path Polyline */}
            {pathHistory.length > 1 && (
              <Polyline
                positions={pathHistory}
                color="#4c9062"
                weight={4}
                opacity={0.8}
                dashArray="10, 8"
              />
            )}
            
            {/* Rover Position Marker */}
            <Marker position={currentPos} icon={createRoverIcon()}>
              <Popup>
                <div className="text-xs p-1">
                  <strong className="text-agrogreen-700">Smart Pest Detector Rover</strong>
                  <div className="mt-1">
                    <p>Lat: {currentLat.toFixed(5)}</p>
                    <p>Lng: {currentLng.toFixed(5)}</p>
                    <p>Status: Navigating Sector</p>
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Field Zoning Predictive Risk Heatmap Grid */}
            {Object.entries(zoneOffsets).map(([zoneIdStr, offset]) => {
              const zoneId = parseInt(zoneIdStr);
              const latMin = defaultLat + (offset.y * latHeight);
              const latMax = latMin + latHeight;
              const lngMin = defaultLng + (offset.x * lngWidth);
              const lngMax = lngMin + lngWidth;
              const bounds = [[latMin, lngMin], [latMax, lngMax]];
              
              // Find the risk info from backend state
              const riskInfo = riskZones.find(z => z.zone_id === zoneId) || {
                zone_id: zoneId,
                risk_score: 10,
                level: "safe",
                dominant_threat: "General Pests",
                recommendation: "Regular surveillance active.",
                metrics: { temperature: 24, humidity: 50, soil_moisture: 35 }
              };
              
              let rectColor = "#10b981"; // safe green
              let fillOp = 0.05;
              if (riskInfo.level === "danger") {
                rectColor = "#ef4444"; // red
                fillOp = 0.35;
              } else if (riskInfo.level === "warning") {
                rectColor = "#f97316"; // orange
                fillOp = 0.22;
              } else if (riskInfo.risk_score > 20) {
                rectColor = "#eab308"; // yellow
                fillOp = 0.12;
              }
              
              // If sprayer active and rover is inside this specific zone boundary, highlight it
              const isRoverInZone = currentLat > latMin && currentLat < latMax && currentLng > lngMin && currentLng < lngMax;
              const borderWeight = (isRoverInZone && telemetry?.sprayer_active) ? 4 : 1;
              const borderColor = (isRoverInZone && telemetry?.sprayer_active) ? "#10b981" : "#cbd5e1";
              
              return (
                <Rectangle
                  key={zoneId}
                  bounds={bounds}
                  pathOptions={{
                    color: borderColor,
                    weight: borderWeight,
                    fillColor: rectColor,
                    fillOpacity: fillOp
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1 space-y-1 text-slate-808 w-[180px]">
                      <strong className="text-emerald-700 block border-b border-slate-100 pb-1">Zone {zoneId}: {offset.name}</strong>
                      <p>Dominant Threat: <strong>{riskInfo.dominant_threat}</strong></p>
                      <p>Pest Risk Index: <strong className={riskInfo.level === "danger" ? "text-red-650 font-bold" : "font-semibold text-slate-700"}>{riskInfo.risk_score}%</strong></p>
                      <p>Sensor Temp: <strong>{riskInfo.metrics.temperature}°C</strong></p>
                      <p>Sensor Moisture: <strong>{riskInfo.metrics.soil_moisture}%</strong></p>
                      <div className="border-t border-slate-100 pt-1.5 mt-1 bg-slate-50 p-1.5 rounded text-[9px] text-slate-500 leading-normal">
                        <span className="font-bold text-slate-700 block mb-0.5">Risk Recommendation:</span>
                        <span>{riskInfo.recommendation}</span>
                      </div>
                    </div>
                  </Popup>
                </Rectangle>
              );
            })}

            {/* IoT Sensor Node markers */}
            {sensorHealth?.nodes?.map((node) => {
              const nodePos = [node.gps.lat, node.gps.lng];
              return (
                <Marker 
                  key={node.id} 
                  position={nodePos} 
                  icon={createSensorIcon(node.status)}
                >
                  <Popup>
                    <div className="text-xs p-1 space-y-1 text-slate-800">
                      <strong className="text-emerald-700 block border-b border-slate-100 pb-1 font-bold">IoT Node: {node.id.toUpperCase()}</strong>
                      <p>Type: <span className="capitalize font-semibold">{node.type}</span></p>
                      <p>Zone ID: <strong>{node.zone_id}</strong></p>
                      <p>Battery Level: <strong>{Math.round(node.battery_pct)}%</strong> {node.solar_charging && "(Solar Charging)"}</p>
                      {node.soil_moisture !== undefined && (
                        <p>Soil Moisture: <strong>{node.soil_moisture}%</strong></p>
                      )}
                      {node.temperature !== undefined && (
                        <p>Temp / Humid: <strong>{node.temperature}°C / {node.humidity}%</strong></p>
                      )}
                      <p>Status: <span className={`font-bold ${node.status === 'online' ? 'text-emerald-700' : 'text-red-600 animate-pulse'}`}>{node.status.toUpperCase()}</span></p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* Recenter viewport loop */}
            {followRover && <RecenterMap center={currentPos} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
export default MapView;
