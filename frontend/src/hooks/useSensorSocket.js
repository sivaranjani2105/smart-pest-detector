import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

// Read backend URL from Vite environment or default to localhost:5000
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Detect if we are likely on GitHub Pages or a demo environment
const isDemoMode = window.location.hostname.includes("github.io") || window.location.hostname.includes("vercel.app") || import.meta.env.MODE === "production";

export const useSensorSocket = () => {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [advisories, setAdvisories] = useState({});
  const [latestDetection, setLatestDetection] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (isDemoMode) {
      // --- DEMO MODE SIMULATION ---
      console.log("Running in DEMO MODE with simulated data.");
      setConnected(true);
      
      const updateTelemetry = () => {
        setTelemetry({
          temperature: (22 + Math.random() * 5).toFixed(1),
          humidity: (60 + Math.random() * 15).toFixed(1),
          soil_moisture: (45 + Math.random() * 10).toFixed(1),
          light_level: Math.floor(700 + Math.random() * 300),
          battery: Math.floor(85 + Math.random() * 10),
          nitrogen: Math.floor(45 + Math.random() * 15),
          phosphorus: Math.floor(35 + Math.random() * 10),
          potassium: Math.floor(55 + Math.random() * 15),
          ph: (6.2 + Math.random() * 0.8).toFixed(1),
        });
      };
      
      updateTelemetry();
      const telemetryInterval = setInterval(updateTelemetry, 4000);

      // Initial Demo Data
      setAlerts([
        { 
          id: "alert-1", 
          type: "PEST_DETECTED", 
          severity: "high", 
          message: "Whiteflies detected in Sector A (Tomato crop). Exceeds safety threshold.", 
          timestamp: new Date().toISOString(), 
          location: "Sector A" 
        },
        { 
          id: "alert-2", 
          type: "MOISTURE_LOW", 
          severity: "medium", 
          message: "Soil moisture critically low in Sector B. Irrigation recommended.", 
          timestamp: new Date(Date.now() - 3600000).toISOString(), 
          location: "Sector B" 
        }
      ]);

      setAdvisories({
        "whitefly": {
          advice: "Recommend immediate deployment of yellow sticky traps and targeted application of neem oil spray. Avoid using broad-spectrum synthetic pesticides to protect beneficial insects like ladybugs and lacewings.",
          confidence: 0.94,
          generatedAt: new Date().toISOString()
        }
      });

      setLatestDetection({
        species: "whitefly",
        confidence: 0.94,
        count: 5,
        timestamp: new Date().toISOString(),
        image_url: "https://images.unsplash.com/photo-1596783074918-c84cb06531ca?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" // Demo placeholder image of a leaf
      });

      return () => {
        clearInterval(telemetryInterval);
      };
    } else {
      // --- REAL BACKEND CONNECTION ---
      const socket = io(BACKEND_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });
      
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("WebSocket connected to:", BACKEND_URL);
        setConnected(true);
      });

      socket.on("disconnect", () => {
        console.log("WebSocket disconnected");
        setConnected(false);
      });

      socket.on("telemetry_update", (data) => {
        setTelemetry(data);
      });

      socket.on("alerts_update", (data) => {
        setAlerts(data);
      });

      socket.on("pest_detection", (data) => {
        setLatestDetection(data);
      });

      socket.on("pest_advisory", (data) => {
        setAdvisories((prev) => ({
          ...prev,
          [data.species]: {
            advice: data.advice,
            confidence: data.confidence,
            generatedAt: data.generated_at,
          },
        }));
      });

      return () => {
        if (socket) {
          socket.disconnect();
        }
      };
    }
  }, []);

  const acknowledgeAlert = async (alertId) => {
    if (isDemoMode) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/acknowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alert_id: alertId }),
      });
      if (!response.ok) {
        throw new Error("Failed to acknowledge alert");
      }
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error("Acknowledge alert error:", error);
    }
  };

  return {
    connected,
    telemetry,
    alerts,
    advisories,
    latestDetection,
    acknowledgeAlert,
    backendUrl: BACKEND_URL,
  };
};
