# Smart Pest Detector AI — Smart Agriculture Monitoring & Pest Detection Platform

Smart Pest Detector AI is a full-stack smart agriculture platform combining IoT telemetry monitoring with AI-driven biological threat classification. The system operates on three layers:

1. **Sensing Layer** — Simulated (fluctuating data, moving GPS coordinates) or physical Raspberry Pi 4 GPIO hardware (PIR motion, buzzer alert, serial GPS integration).
2. **AI Vision Layer** — YOLOv11 object-detection inference for identifying agricultural pests, connected to a local Ollama REST instance running the `llama3.1` model to generate organic/chemical treatment advice and session reports.
3. **Application Layer** — A React + Vite web dashboard displaying live sensor updates and alerts over WebSockets, a Leaflet tracking map, and a live pest scanner viewport using the device camera.

---

## Project Structure

```text
smart-pest-detector/
├── backend/
│   ├── app.py                # Flask entrypoint
│   ├── extensions.py         # Shared SocketIO instance
│   ├── routes/               # Blueprint endpoints
│   │   ├── detect.py         # POST /api/detect (YOLOv11 image inference)
│   │   ├── sensors.py        # GET /api/sensors (latest readings)
│   │   ├── advisory.py       # POST /api/advisory (Ollama advisory text)
│   │   ├── reports.py        # GET /api/reports (session summaries)
│   │   └── alerts.py         # GET/POST /api/alerts (active alarms)
│   ├── services/             # Core logic layers
│   │   ├── sensor_service.py # Telemetry generator / RPi GPIO
│   │   ├── yolo_service.py   # YOLOv11 model loads & mapping
│   │   ├── ollama_service.py # Ollama prompts & fallback remedies
│   │   ├── alerts_service.py # Alarm evaluations
│   │   └── session_manager.py# Telemetry & pest logging database
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Sample environment configurations
│   └── Dockerfile            # Backend Docker instructions
├── frontend/
│   ├── index.html            # Vite entrypoint
│   ├── package.json          # Node dependencies
│   ├── vite.config.js        # Vite configurations
│   ├── tailwind.config.js    # Tailwind colors & fonts configuration
│   ├── postcss.config.js     # PostCSS setup
│   ├── Dockerfile            # Frontend dev Docker instructions
│   ├── src/
│   │   ├── main.jsx          # React renderer
│   │   ├── App.jsx           # Sidebar layout & page router
│   │   ├── index.css         # Styling & Leaflet dark overrides
│   │   ├── hooks/
│   │   │   └── useSensorSocket.js # WebSocket client hook
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx # Gauges & session controls
│   │   │   ├── Scanner.jsx   # Webcam & Canvas overlay
│   │   │   ├── MapView.jsx   # Live tracking Leaflet map
│   │   │   └── Reports.jsx   # Archive reports viewer
│   │   └── components/
│   │       ├── SensorCard.jsx# Gauge circle wrapper
│   │       ├── PestDetectionFeed.jsx # Camera frame capture loop
│   │       ├── AlertBanner.jsx # Combined risk banner
│   │       └── AdvisoryPanel.jsx # AI remedy panel
│   └── Dockerfile
└── docker-compose.yml        # Multi-container coordinator
```

---

## Local Development Setup

### 1. Backend (Flask) Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure `.env`:
   Copy `.env.example` to `.env` and adjust values. By default, it operates in simulated mode.
5. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend will start on `http://localhost:5000`.

### 2. Frontend (React + Vite) Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Run with Docker Compose

To spin up the entire system including the Ollama container:

1. Make sure Docker Desktop is running.
2. Run the following command in the project root:
   ```bash
   docker-compose up --build
   ```
3. When launched, Ollama will run on `http://localhost:11434`, backend on `http://localhost:5000`, and frontend on `http://localhost:5173`.
4. The backend service will automatically pull the `llama3.1` model from the Ollama library on startup if it is not already cached in the docker volume.

---

## Swapping Simulated ➔ Real Sensors on Raspberry Pi 4

To deploy on a physical Raspberry Pi 4 and connect actual sensors:

1. Wire your sensors to the Pi:
   - **Buzzer**: Active piezo buzzer connected to GPIO 18 (default).
   - **PIR Motion Sensor**: Connected to a digital GPIO pin (e.g. GPIO 23).
   - **PM2.5 Sensor (SDS011)** & **GPS (e.g. Neo-6M)**: Connected via USB-serial interfaces or hardware UART.
2. Edit `backend/.env` on the Pi:
   ```env
   # Swap sensor mode from simulated to hardware
   SENSOR_MODE=hardware
   BUZZER_PIN=18
   ```
3. The `sensor_service.py` checks `SENSOR_MODE`. When set to `hardware`, it attempts to import `RPi.GPIO` and initialize hardware pins. The buzzer trigger calls write HIGH to GPIO 18, pauses, and writes LOW.

---

## Exposing Publicly via Cloudflare Tunnel (`cloudflared`)

To access the camera scanner from any phone browser in the field, use a Cloudflare Tunnel.

### Step 1: Install cloudflared
Download the Cloudflare Tunnel daemon for your OS (Pi, Windows, or Mac):
- **macOS**: `brew install cloudflared`
- **Linux/Raspberry Pi**: `sudo apt install cloudflared` or download Debian package.

### Step 2: Login to Cloudflare
Authenticate the daemon with your Cloudflare account:
```bash
cloudflared tunnel login
```

### Step 3: Create a Tunnel
Run the creation command:
```bash
cloudflared tunnel create smart-pest-detector-tunnel
```
This prints your tunnel's UUID and creates a credentials JSON file.

### Step 4: Configure Tunnel Routing
Since the React frontend runs in a user's browser, the browser needs to contact both the frontend site and the backend API through public, SSL-secured URLs. 
Create a configuration file `config.yml` (e.g. in `~/.cloudflared/` or project root):

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # Route API traffic to Flask Backend (Port 5000)
  - hostname: smart-pest-detector-api.yourdomain.com
    service: http://localhost:5000
  # Route Web Dashboard traffic to Vite Frontend (Port 5173)
  - hostname: smart-pest-detector.yourdomain.com
    service: http://localhost:5173
  # Catch-all rule returning 404
  - service: http_status:404
```

Map DNS records on the Cloudflare Dashboard:
```bash
cloudflared tunnel route dns smart-pest-detector-tunnel smart-pest-detector.yourdomain.com
cloudflared tunnel route dns smart-pest-detector-tunnel smart-pest-detector-api.yourdomain.com
```

### Step 5: Build and Run
Start the tunnel:
```bash
cloudflared tunnel run smart-pest-detector-tunnel
```
When running the Docker or local stack, pass the public API URL to the frontend build env so the browser knows where to reach the backend:
```bash
# In frontend/.env
VITE_BACKEND_URL=https://smart-pest-detector-api.yourdomain.com
```
Navigate your phone's browser to `https://smart-pest-detector.yourdomain.com` to scan crops in real-time!
