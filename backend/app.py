import os
from flask import Flask
from flask_cors import CORS
from extensions import socketio
from services.sensor_service import sensor_service
from services.session_manager import session_manager
from services.alerts_service import alerts_service

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'smart_pest_detector_secret_key_123')
    
    # Enable CORS for frontend connection
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Initialize SocketIO with flask app
    socketio.init_app(app)
    
    # Import Blueprints (imported inside create_app to avoid circular dependencies)
    from routes.sensors import sensors_bp
    from routes.detect import detect_bp
    from routes.advisory import advisory_bp
    from routes.reports import reports_bp
    from routes.alerts import alerts_bp
    from routes.irrigation import irrigation_bp
    from routes.chat import chat_bp
    from routes.feedback import feedback_bp
    from routes.webhooks import webhooks_bp
    from routes.auth import auth_bp
    
    app.register_blueprint(sensors_bp)
    app.register_blueprint(detect_bp)
    app.register_blueprint(advisory_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(irrigation_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(webhooks_bp)
    app.register_blueprint(auth_bp)
    
    # Telemetry WebSockets emitter
    def on_telemetry_update(readings):
        # Merge rover telemetry
        from services.rover_service import rover_service
        readings["rover"] = rover_service.get_telemetry()
        # 1. Log telemetry to the active session
        session_manager.log_telemetry(readings)
        # 2. Check and raise environmental alarms
        alerts_service.update_environmental_alerts(readings)
        # 3. Emit real-time telemetry package to dashboard clients
        socketio.emit('telemetry_update', readings)

    # Register callback and start sensor thread
    sensor_service.register_callback(on_telemetry_update)
    sensor_service.start_polling(interval=2.0)
    
    # Start Rover and MQTT background services
    from services.rover_service import rover_service
    from services.mqtt_service import mqtt_service
    rover_service.start()
    mqtt_service.start()
    
    @app.route('/')
    def index():
        return {"status": "Smart Pest Detector AI Backend Running", "mode": sensor_service.sensor_mode}

    return app

app = create_app()

@socketio.on('connect')
def handle_connect():
    print("Dashboard client connected via WebSockets.")
    # Push latest readings and alerts on connection
    socketio.emit('telemetry_update', sensor_service.get_latest_readings())
    socketio.emit('alerts_update', alerts_service.get_active_alerts())

@socketio.on('disconnect')
def handle_disconnect():
    print("Dashboard client disconnected.")

if __name__ == '__main__':
    # Running using gevent/eventlet or threading depending on available libraries
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Smart Pest Detector AI Backend server on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
