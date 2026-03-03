#!/bin/bash
# Aether Sentiment Analysis Microservice Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Aether Sentiment Analysis Microservice..."

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "Virtual environment activated"
else
    echo "Error: Virtual environment not found. Run: python3 -m venv venv && pip install -r requirements.txt"
    exit 1
fi

# Start uvicorn server
echo "Starting uvicorn on http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
