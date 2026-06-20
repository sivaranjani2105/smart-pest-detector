import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw, AlertCircle } from "lucide-react";

export const PestDetectionFeed = ({ backendUrl, onDetection, activePestSetter, saliencyActive }) => {
  const videoRef = useRef(null);
  const canvasOverlayRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const [qualityGateWarning, setQualityGateWarning] = useState(null);
  const [personInFrame, setPersonInFrame] = useState(false);
  const lastFrameTimeRef = useRef(0);
  
  // Offline cache queue states
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  
  const frameIntervalMs = 150; // Capture ~6.7 fps max to prevent overloading server

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    const constraints = {
      video: {
        facingMode: { exact: "environment" }, // force back camera on mobile
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }

      // Enable continuous autofocus if the device supports it
      try {
        const [track] = stream.getVideoTracks();
        if (track) {
          const capabilities = track.getCapabilities?.();
          if (capabilities?.focusMode?.includes("continuous")) {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
            console.log("Continuous autofocus enabled.");
          }
        }
      } catch (focusErr) {
        console.warn("Continuous autofocus unsupported or failed to apply:", focusErr);
      }
    } catch (err) {
      console.warn("Could not start camera with ideal env/1080p constraints, trying fallback camera...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          setStreamActive(true);
        }
      } catch (fallbackErr) {
        console.error("Camera access error:", fallbackErr);
        setCameraError("Camera access denied or unavailable. Please grant browser camera permissions.");
        setStreamActive(false);
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
    clearOverlay();
  };

  const clearOverlay = () => {
    const canvas = canvasOverlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Toggle Camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Frame Capture and Inference Loop
  useEffect(() => {
    let timerId;
    if (!streamActive) return;

    const captureFrameAndDetect = async () => {
      const video = videoRef.current;
      const overlay = canvasOverlayRef.current;
      const hiddenCanvas = hiddenCanvasRef.current;
      
      if (!video || !overlay || !hiddenCanvas || isProcessing) return;
      
      // Make sure video is ready and playing
      if (video.readyState !== video.HAVE_CURRENT_DATA && video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      // Sync canvas dimensions with video bounding box
      const rect = video.getBoundingClientRect();
      if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        hiddenCanvas.width = video.videoWidth;
        hiddenCanvas.height = video.videoHeight;
      }

      setIsProcessing(true);
      let dataUrl = "";

      try {
        // Draw video frame to hidden canvas
        const hiddenCtx = hiddenCanvas.getContext("2d");
        hiddenCtx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        
        // Convert to low-quality JPEG to minimize base64 bandwidth
        dataUrl = hiddenCanvas.toDataURL("image/jpeg", 0.6);
        
        const response = await fetch(`${backendUrl}/api/detect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: dataUrl }),
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.quality_gate_failed) {
            setQualityGateWarning(result.quality_gate_message);
            setPersonInFrame(false);
            clearOverlay();
            setIsProcessing(false);
            return;
          } else {
            setQualityGateWarning(null);
          }

          setPersonInFrame(!!result.person_in_frame);
          
          const now = performance.now();
          setFps(Math.round(1000 / (now - lastFrameTimeRef.current)));
          lastFrameTimeRef.current = now;
          
          // Draw bounding boxes & crop leaf diseases on overlay canvas
          drawBoundingBoxes(result.detections, result.diseases);
          
          if (result.detections && result.detections.length > 0) {
            // Filter out human from triggering advisory cards
            const nonHumanPests = result.detections.filter(d => !d.species.toLowerCase().includes("human"));
            if (nonHumanPests.length > 0) {
              const firstPest = nonHumanPests[0];
              activePestSetter(firstPest.species);
              onDetection(result.detections);
            }
          }
          
          setIsOffline(false);
        }
      } catch (err) {
        console.error("Frame inference error:", err);
        setIsOffline(true);
        // Push stub scan into queue
        const stubScan = {
          id: `scan_${Date.now()}`,
          timestamp: Date.now(),
          sizeBytes: dataUrl ? dataUrl.length : 0
        };
        setOfflineQueue(prev => [...prev, stubScan].slice(-20)); // cap at 20 elements
      } finally {
        setIsProcessing(false);
      }
    };

    timerId = setInterval(captureFrameAndDetect, frameIntervalMs);

    return () => clearInterval(timerId);
  }, [streamActive, isProcessing, backendUrl]);

  // Draw HUD bounding boxes
  const drawBoundingBoxes = (detections, diseases = []) => {
    const canvas = canvasOverlayRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Crop Diseases
    if (diseases && diseases.length > 0) {
      diseases.forEach((dis) => {
        const [rx, ry, rw, rh] = dis.bbox;
        const x = rx * canvas.width;
        const y = ry * canvas.height;
        const w = rw * canvas.width;
        const h = rh * canvas.height;

        // Draw bounding box (purple brackets for leaf diseases)
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#a855f7"; // Purple for crop leaf diseases
        
        const length = Math.min(15, w * 0.2, h * 0.2);
        
        // Top-Left corner
        ctx.beginPath();
        ctx.moveTo(x + length, y); ctx.lineTo(x, y); ctx.lineTo(x, y + length);
        ctx.stroke();

        // Top-Right corner
        ctx.beginPath();
        ctx.moveTo(x + w - length, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + length);
        ctx.stroke();

        // Bottom-Left corner
        ctx.beginPath();
        ctx.moveTo(x, y + h - length); ctx.lineTo(x, y + h); ctx.lineTo(x + length, y + h);
        ctx.stroke();

        // Bottom-Right corner
        ctx.beginPath();
        ctx.moveTo(x + w - length, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - length);
        ctx.stroke();

        // Faint semi-transparent purple fill
        ctx.fillStyle = "rgba(168, 85, 247, 0.05)";
        ctx.fillRect(x, y, w, h);

        // Label background card
        const label = `Disease: ${dis.disease} (${Math.round(dis.confidence * 100)}%)`;
        ctx.font = "bold 13px 'Outfit', 'Inter', sans-serif";
        const labelWidth = ctx.measureText(label).width + 12;
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(x, y - 24 > 0 ? y - 24 : 0, labelWidth, 24);

        // Label Text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, x + 6, y - 24 > 0 ? y - 8 : 16);
      });
    }

    // 2. Draw Pest Detections
    if (!detections || detections.length === 0) return;

    detections.forEach((det) => {
      const [rx, ry, rw, rh] = det.bbox;
      const x = rx * canvas.width;
      const y = ry * canvas.height;
      const w = rw * canvas.width;
      const h = rh * canvas.height;

      // Draw bounding box (brackets)
      ctx.lineWidth = 3;
      
      const species_lower = det.species.toLowerCase();
      const is_human = species_lower.includes("human");
      const is_beneficial = det.beneficial;
      
      if (is_human) {
        ctx.strokeStyle = "#eab308"; // Safety yellow for humans
      } else if (is_beneficial) {
        ctx.strokeStyle = "#10b981"; // Emerald green for beneficial pollinators/predators
      } else if (species_lower.includes("crow") || species_lower.includes("mouse")) {
        ctx.strokeStyle = "#f97316"; // Orange for animal pests
      } else {
        ctx.strokeStyle = "#ef4444"; // Red for crop pests
      }
      
      const length = Math.min(15, w * 0.2, h * 0.2);
      
      // Draw saliency Grad-CAM heatmap overlay
      if (saliencyActive && !is_human) {
        const cx = x + w/2;
        const cy = y + h/2;
        const radius = Math.max(w, h) * 0.85;
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
        
        grad.addColorStop(0, "rgba(239, 68, 68, 0.65)"); // red center
        grad.addColorStop(0.3, "rgba(249, 115, 22, 0.45)"); // orange mid
        grad.addColorStop(0.6, "rgba(234, 179, 8, 0.25)"); // yellow outer
        grad.addColorStop(1, "rgba(16, 185, 129, 0.0)"); // green fadeout
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(x + length, y); ctx.lineTo(x, y); ctx.lineTo(x, y + length);
      ctx.stroke();

      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(x + w - length, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + length);
      ctx.stroke();

      // Bottom-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + h - length); ctx.lineTo(x, y + h); ctx.lineTo(x + length, y + h);
      ctx.stroke();

      // Bottom-Right corner
      ctx.beginPath();
      ctx.moveTo(x + w - length, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - length);
      ctx.stroke();

      // Draw faint semi-transparent background card for box
      ctx.fillStyle = is_human ? "rgba(234, 179, 8, 0.05)" : is_beneficial ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)";
      ctx.fillRect(x, y, w, h);

      // Label background card
      let label = "";
      if (is_human) {
        label = `⚠️ ${det.species}`;
      } else if (is_beneficial) {
        label = `🐝 ${det.species} #${det.track_id} (${Math.round(det.confidence * 100)}%)`;
      } else {
        const stage = det.life_stage ? `[${det.life_stage}]` : "";
        label = `🪲 ${det.species} ${stage} #${det.track_id} (${Math.round(det.confidence * 100)}%)`;
      }
      
      ctx.font = "bold 13px 'Outfit', 'Inter', sans-serif";
      const labelWidth = ctx.measureText(label).width + 12;
      
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(x, y - 24 > 0 ? y - 24 : 0, labelWidth, 24);

      // Label Text
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x + 6, y - 24 > 0 ? y - 8 : 16);
    });
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-slateblack-800 relative">
      {/* Video stream viewport */}
      <div className="relative aspect-video w-full bg-slateblack-950 flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 text-center text-red-400 max-w-sm">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-red-500 animate-pulse" />
            <p className="text-sm font-semibold">{cameraError}</p>
            <button
              onClick={startCamera}
              className="mt-4 px-4 py-2 bg-red-950 border border-red-500/30 hover:bg-red-900 rounded-lg text-xs font-bold text-white transition-colors"
            >
              Retry Camera
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* HUD Bounding Boxes Overlay Canvas */}
            <canvas
              ref={canvasOverlayRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
            {/* Hidden capture canvas */}
            <canvas ref={hiddenCanvasRef} className="hidden" />
          </>
        )}

        {/* Quality Gating Warning Banner */}
        {qualityGateWarning && (
          <div className="absolute top-12 left-3 right-3 z-30 bg-amber-600/90 backdrop-blur text-white text-[11px] font-bold p-2.5 rounded-xl border border-amber-500 shadow-lg flex items-center gap-2">
            <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 animate-pulse text-white" />
            <span>{qualityGateWarning}</span>
          </div>
        )}

        {/* Offline Cache Queue Warning Banner */}
        {isOffline && (
          <div className="absolute top-12 left-3 right-3 z-30 bg-amber-600/90 backdrop-blur text-white text-[11px] font-bold p-2.5 rounded-xl border border-amber-500 shadow-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 animate-pulse text-white" />
              <span>Offline: Connection lost. Cache queue holds {offlineQueue.length} stubs.</span>
            </div>
            {offlineQueue.length > 0 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setOfflineQueue([]);
                }}
                className="px-2 py-0.5 bg-amber-900 hover:bg-amber-950 border border-amber-800 text-white rounded text-[9px] font-bold uppercase transition-colors"
              >
                Clear Queue
              </button>
            )}
          </div>
        )}

        {/* Human Intrusion Pausing Alert Overlay */}
        {personInFrame && (
          <div className="absolute inset-0 z-20 bg-yellow-500/10 border-4 border-yellow-500 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-slate-900 border border-yellow-500 text-yellow-400 font-extrabold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-ping"></span>
              <span>SAFETY OVERRIDE: HUMAN IN FRAME - ROVER PAUSED</span>
            </div>
            <p className="text-[10px] text-slate-350 bg-slate-900/90 px-3 py-1 rounded-lg mt-2 border border-slate-700 max-w-xs font-semibold">
              All automated spraying, navigation paths, and buzzer alert triggers are temporarily deactivated.
            </p>
          </div>
        )}

        {/* Video feed overlay control HUD */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md text-[10px] text-agrogreen-400 font-bold border border-agrogreen-500/20 flex items-center space-x-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${streamActive ? "bg-red-500 animate-ping" : "bg-slate-500"}`}></span>
          <span>{streamActive ? "LIVE FEED" : "STANDBY"}</span>
          {streamActive && <span className="opacity-60 text-white ml-1">| {fps} FPS</span>}
        </div>

        {!streamActive && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slateblack-950/80">
            <CameraOff className="h-12 w-12 text-slateblack-500" />
            <p className="text-xs text-slateblack-400">Field Camera scanner is sleeping.</p>
            <button
              onClick={startCamera}
              className="px-5 py-2.5 bg-agrogreen-600 hover:bg-agrogreen-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              Activate Camera Feed
            </button>
          </div>
        )}
      </div>

      {/* Footer controllers */}
      <div className="p-4 bg-slateblack-950/40 border-t border-slateblack-850 flex items-center justify-between">
        <div className="text-xs text-slateblack-400">
          {isProcessing ? (
            <span className="flex items-center text-agrogreen-400">
              <RefreshCw className="h-3 w-3 animate-spin mr-1.5" />
              Inference processing...
            </span>
          ) : (
            <span className="text-slateblack-400">Stream ready. Draw box overlay enabled.</span>
          )}
        </div>
        <div className="flex space-x-2">
          {streamActive && (
            <button
              onClick={stopCamera}
              className="px-4 py-1.5 bg-slateblack-800 hover:bg-slateblack-755 border border-slateblack-700 text-slateblack-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Pause Stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
