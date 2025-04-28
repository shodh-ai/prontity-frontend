# Project Setup Guide

This guide will help you set up the entire project in a new system.

## Prerequisites

1. Docker and Docker Compose installed
2. Git installed
3. Basic knowledge of terminal commands

## Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd project-1
   ```

2. **Make the setup script executable**
   ```bash
   chmod +x setup.sh
   ```

3. **Configure environment variables**
   - Copy `.env.local.example` to `.env`
   - Edit `.env` with your configuration:
     - Update LiveKit credentials
     - Update database URL
     - Update any other environment-specific variables

4. **Run the setup script**
   ```bash
   ./setup.sh
   ```

   This script will:
   - Check for Docker and Docker Compose
   - Create .env file if it doesn't exist
   - Build and start all services
   - Show service status

## Services and Ports

- Frontend: http://localhost:3000
- WebRTC Token Service: http://localhost:3002
- Vocabulary Canvas Service: http://localhost:3001
- LiveKit Agent Server: http://localhost:8000
- Mock Services: http://localhost:3003-3005

## Common Commands

- Start all services:
  ```bash
  docker-compose up -d
  ```

- Stop all services:
  ```bash
  docker-compose down
  ```

- View logs:
  ```bash
  docker-compose logs -f
  ```

- Rebuild and restart services:
  ```bash
  docker-compose up --build -d
  ```

## Troubleshooting

1. **Port conflicts**
   - If you get port conflict errors, check which ports are in use:
     ```bash
     sudo lsof -i -P -n | grep LISTEN
     ```
   - Update the ports in `docker-compose.yml` if needed

2. **Environment variables**
   - Make sure all required environment variables are set in `.env`
   - Check service logs for environment-related errors:
     ```bash
     docker-compose logs <service-name>
     ```

3. **Docker issues**
   - If Docker is not running:
     ```bash
     sudo systemctl start docker
     ```
   - If you get permission errors:
     ```bash
     sudo usermod -aG docker $USER
     ```
     Then log out and log back in

## Development

For development, you can run individual services:

1. **Frontend development**
   ```bash
   cd src
   npm run dev
   ```

2. **Backend services**
   ```bash
   # For Python services
   cd livekit-agent-server
   python -m full_implementation

   # For Node.js services
   cd webrtc-token-service
   npm run dev
   ```

## Support

For any issues or questions, please contact the development team or create an issue in the repository. 