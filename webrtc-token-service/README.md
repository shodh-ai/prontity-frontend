# WebRTC Token Service

A dedicated microservice for generating LiveKit WebRTC tokens, designed to be used with your web application. This service provides a secure way to generate LiveKit tokens separately from your main application.

## Features

- Secure token generation for LiveKit WebRTC
- API key authentication for protected endpoints
- CORS protection for allowed origins
- Request logging and monitoring
- Endpoint for token verification
- Health check endpoint

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the `.env.example` file to `.env` and fill in your LiveKit credentials:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your LiveKit API key, secret, and URL
5. Add a `SERVICE_API_KEY` to the `.env` file for securing the API

## Running the Service

### Development mode
```
npm run dev
```

### Production mode
```
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
No authentication required.

### Generate Token
```
GET /api/token?room={roomName}&username={userName}
```
Requires `x-api-key` header with your `SERVICE_API_KEY`.

### Verify Token (Optional)
```
POST /api/verify
```
Requires `x-api-key` header with your `SERVICE_API_KEY`.
Request body: `{ "token": "your-livekit-token" }`

## Security Considerations

- Store your LiveKit credentials securely in the `.env` file
- Set strong API keys for authentication
- Configure CORS to only allow trusted origins
- Deploy in a secure environment
