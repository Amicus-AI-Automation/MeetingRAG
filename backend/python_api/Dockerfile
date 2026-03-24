FROM python:3.11-slim

WORKDIR /app

# Install system dependencies:
#   ffmpeg  — audio extraction (required by audio.py)
#   build-essential — C extensions for some pip packages (e.g. tokenizers)
#   curl    — healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (context is project root, so we can reach requirements_python.txt)
COPY requirements_python.txt ./
RUN pip install --no-cache-dir -r requirements_python.txt

# Copy only the python_api source files
COPY backend/python_api/ ./

# Create placeholder directories for mounted volumes
# In Docker Compose: bound to ./backend/{data,uploads,model_cache}
# In Kubernetes: PVCs are mounted at these paths
RUN mkdir -p /data/metadata /data/transcripts /data/chroma_db /data/records \
             /uploads \
             /model_cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
