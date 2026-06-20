import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

// Read backend URL from Vite environment or default to localhost:5000
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export const useSensorSocket = () => {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [advisories, setAdvisories] = useState({});
  const [latestDetection, setLatestDetection] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Connect to Flask backend socket server
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

    // Cleanup connection
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Expose API to acknowledge alerts via websocket or manual http (we do manual http to match REST requirements)
  const acknowledgeAlert = async (alertId) => {
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
      // Optimistically clear alert locally
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
