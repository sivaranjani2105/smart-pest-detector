FROM python:3.11-slim

# Install system dependencies for OpenCV and building packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements list
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose Flask default port
EXPOSE 5000

# Run entrypoint server
CMD ["python", "app.py"]
