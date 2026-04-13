#!/bin/bash

# Invoice PDF Service Setup and Run Script for Linux/Mac

echo ""
echo "========================================"
echo "Invoice PDF Processor Service"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.8+ from https://www.python.org/"
    exit 1
fi

echo "Found Python:"
python3 --version

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install requirements"
    exit 1
fi

# Copy .env.example to .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
fi

# Start the service
echo ""
echo "========================================"
echo "Starting Invoice PDF Processor Service"
echo "========================================"
echo ""
echo "Service will be available at: http://127.0.0.1:8000"
echo "API Documentation: http://127.0.0.1:8000/docs"
echo ""

python main.py
