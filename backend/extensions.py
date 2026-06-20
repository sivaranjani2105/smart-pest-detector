from flask_socketio import SocketIO

# Initialize SocketIO instance with CORS allowed for all origins to enable React connectivity
socketio = SocketIO(cors_allowed_origins="*")
