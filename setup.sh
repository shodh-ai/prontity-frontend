#!/bin/bash

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.local.example .env
    echo "Please edit .env file with your configuration"
fi

# Build and start all services
echo "Building and starting all services..."
docker-compose up --build -d

# Check if services are running
echo "Checking service status..."
docker-compose ps

echo "Setup complete! Services are running."
echo "Frontend: http://localhost:3000"
echo "WebRTC Token Service: http://localhost:3002"
echo "Vocabulary Canvas Service: http://localhost:3001"
echo "LiveKit Agent Server: http://localhost:8000"
echo "Mock Services: http://localhost:3003-3005" 