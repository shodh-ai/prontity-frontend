# Vocabulary Canvas Microservice

A backend microservice for storing and retrieving drawing canvas states associated with users and vocabulary words.

## Overview

This microservice is part of an AI English Tutor application and is responsible for managing canvas drawings that users create for vocabulary words. It provides a simple REST API for saving and loading canvas data, using PostgreSQL for data persistence.

## Technology Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL (using the 'pg' library)
- JSON storage in the database

## Setup and Installation

1. Make sure you have Node.js and PostgreSQL installed.

2. Install dependencies:
   ```
   npm install
   ```

3. Configure the environment variables in the `.env` file:
   ```
   PORT=3000
   NODE_ENV=development
   PGHOST=localhost
   PGUSER=postgres
   PGDATABASE=vocabulary_canvas
   PGPASSWORD=postgres
   PGPORT=5432
   ```

4. Create the PostgreSQL database:
   ```
   createdb vocabulary_canvas
   ```

5. Build the application:
   ```
   npm run build
   ```

6. Start the server:
   ```
   npm start
   ```

   For development with automatic reloading:
   ```
   npm run dev
   ```

## API Endpoints

### Save Canvas State
- **Method**: POST
- **URL**: `/api/user/:userId/word/:wordId/canvas`
- **URL Parameters**:
  - `userId`: string (User's unique identifier)
  - `wordId`: string (Vocabulary word identifier)
- **Request Body**: Array of DrawingElement objects
- **Response**:
  - 200 OK: Success
  - 400 Bad Request: Invalid input
  - 500 Internal Server Error: Database error, etc.

### Load Canvas State
- **Method**: GET
- **URL**: `/api/user/:userId/word/:wordId/canvas`
- **URL Parameters**:
  - `userId`: string (User's unique identifier)
  - `wordId`: string (Vocabulary word identifier)
- **Response**:
  - 200 OK: Returns array of DrawingElement objects
  - 404 Not Found: No canvas data exists for this user and word
  - 500 Internal Server Error: Database error, etc.

### Delete Canvas State
- **Method**: DELETE
- **URL**: `/api/user/:userId/word/:wordId/canvas`
- **URL Parameters**:
  - `userId`: string (User's unique identifier)
  - `wordId`: string (Vocabulary word identifier)
- **Response**:
  - 200 OK: Success
  - 404 Not Found: No canvas data exists for this user and word
  - 500 Internal Server Error: Database error, etc.

### Get All User Canvas States
- **Method**: GET
- **URL**: `/api/user/:userId/canvas`
- **URL Parameters**:
  - `userId`: string (User's unique identifier)
- **Response**:
  - 200 OK: Returns map of wordId to canvas state data
  - 500 Internal Server Error: Database error, etc.

## Data Model

```typescript
interface DrawingElement {
  id: string;
  type: 'path' | 'rect' | 'image' | 'text';
  x: number;
  y: number;
  rotation?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  opacity?: number;
  points?: number[];
  src?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}
```

## Database Schema

```sql
CREATE TABLE user_canvas_states (
    user_id VARCHAR(255) NOT NULL,
    word_id VARCHAR(255) NOT NULL,
    canvas_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, word_id)
);
```
