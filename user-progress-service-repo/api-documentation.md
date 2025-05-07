# User Progress Service API Documentation

This document provides comprehensive information about the RESTful API endpoints available in the User Progress Service, intended for frontend developers integrating with this service.

## What is the User & Progress Service?

Think of the User & Progress Service as the central brain for the student's learning journey. It's responsible for:

- **Identity**: Knowing who the user is (handling login/registration and user profiles).
- **History**: Tracking what the user has already done (which vocabulary words they've seen, speaking tasks they've completed, writing assignments finished, and maybe how well they did).
- **Planning**: Deciding what the user should do next based on their history and a predefined learning path (the Table of Content - ToC).
- **Review**: Remembering what the user needs to practice again based on learning principles like Spaced Repetition (SRS).

Essentially, it manages the student's account and orchestrates their personalized learning path through the application.

## How it Attaches to the Frontend

The Frontend application talks to the User & Progress Service primarily through standard REST API calls over HTTP/S. Here's the flow:

1. **Authentication**: When the user logs in via the Frontend (LoginPage.tsx), the Frontend sends the email/password to the `/auth/login` endpoint of this service. The service verifies the credentials and sends back a JSON Web Token (JWT).
2. **Storing the Token**: The Frontend securely stores this JWT (e.g., in LocalStorage or a secure cookie).
3. **Authenticated Requests**: For almost all subsequent interactions with this service (and potentially others), the Frontend includes this JWT in the `Authorization: Bearer <token>` header of its HTTP requests.
4. **API Client**: The Frontend typically has dedicated functions (often in an `src/api/` directory) that handle making these API calls (using fetch or axios) and automatically attaching the stored JWT to the headers.

## Frontend Files Affected by it (Directly or Indirectly)

- **`src/pages/LoginPage.tsx`** (or similar auth components): Directly calls the `/auth/login` and `/auth/register` endpoints.
- **`src/App.tsx` or `src/state/sessionStore.ts`** (or similar state management):
  - Stores the JWT received after login.
  - Stores the logged-in user's profile information (fetched from `/auth/me`).
  - Handles logout logic (clearing the stored JWT).
  - May initiate the call to `/users/me/toc/next` when the app loads or a task finishes to determine where to navigate.
- **`src/api/userService.ts`, `src/api/progressService.ts`** (or similar API client files): Contains the actual fetch/axios code to call the different endpoints of this service (e.g., functions like `loginUser`, `registerUser`, `getCurrentUserProfile`, `getNextTask`, `recordTaskCompletion`, `getSrsReviewItems`).
- **Components ending a task** (e.g., `VocabPage.tsx`, `SpeakingPage.tsx`, `WritingPage.tsx`): Logic within these pages (like clicking "Next Word" or finishing a timer) will trigger calls to the `recordTaskCompletion` function in the API client, which hits the `POST /users/me/progress` endpoint.
- **(Future) `src/pages/ProgressPage.tsx` or `Dashboard.tsx`**: Any component displaying historical progress or stats would call endpoints like `GET /users/me/progress`.
- **(Future) SRS-related components**: Any UI specifically for vocabulary review would call `GET /users/me/srs/review-items`.
- **Router logic** (`src/router.tsx` or logic within `App.tsx`): Uses the response from the `getNextTask` API call to programmatically navigate the user to the correct next page (`/vocab/:wordId`, `/speaking/:topicId`, etc.).

In essence, any part of the Frontend that needs to know who the user is, what they should do next, or needs to report task completion will interact with the User & Progress Service via its REST API, authenticated using the JWT.

## Base URL

All API endpoints are relative to the base URL:

```
http://localhost:3000/api
```

## Authentication

Most endpoints in this API require authentication using JSON Web Tokens (JWT). To authenticate:

1. Obtain a JWT by calling the login or register endpoint
2. Include the token in the Authorization header of subsequent requests:

```
Authorization: Bearer <your_jwt_token>
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "message": "Descriptive error message"
}
```

Common HTTP status codes:
- 200: Success
- 201: Resource created
- 400: Bad request (invalid input)
- 401: Unauthorized (missing or invalid token)
- 403: Forbidden (valid token but insufficient permissions)
- 404: Resource not found
- 500: Server error

## API Endpoints

### Authentication

#### Register a new user

```
POST /auth/register
```

**Request Body:**
```json
{
  "name": "User's Full Name",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (201 Created):**
```json
{
  "token": "jwt_token_here",
  "user": {
    "userId": "uuid-string",
    "name": "User's Full Name",
    "email": "user@example.com",
    "createdAt": "2025-04-24T12:00:00.000Z",
    "updatedAt": "2025-04-24T12:00:00.000Z"
  }
}
```

#### User Login

```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200 OK):**
```json
{
  "token": "jwt_token_here",
  "user": {
    "userId": "uuid-string",
    "name": "User's Full Name",
    "email": "user@example.com",
    "createdAt": "2025-04-24T12:00:00.000Z",
    "updatedAt": "2025-04-24T12:00:00.000Z"
  }
}
```

#### Get Current User

```
GET /auth/me
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "userId": "uuid-string",
  "name": "User's Full Name",
  "email": "user@example.com",
  "createdAt": "2025-04-24T12:00:00.000Z",
  "updatedAt": "2025-04-24T12:00:00.000Z"
}
```

### User Profile and Progress

#### Get User Profile

```
GET /users/me
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "userId": "uuid-string",
  "name": "User's Full Name",
  "email": "user@example.com",
  "createdAt": "2025-04-24T12:00:00.000Z",
  "updatedAt": "2025-04-24T12:00:00.000Z"
}
```

#### Get User Progress

```
GET /users/me/progress
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
[
  {
    "userId": "uuid-string",
    "taskId": "task-uuid-string",
    "completedAt": "2025-04-24T12:00:00.000Z",
    "score": 85,
    "performanceData": {
      "timeSpent": 120,
      "correctAnswers": 17,
      "totalQuestions": 20
    }
  },
  {
    "userId": "uuid-string",
    "taskId": "another-task-uuid",
    "completedAt": "2025-04-23T14:30:00.000Z",
    "score": 92,
    "performanceData": {
      "timeSpent": 90,
      "correctAnswers": 12,
      "totalQuestions": 15
    }
  }
]
```

#### Record Task Completion

```
POST /users/me/progress
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "taskId": "task-uuid-string",
  "score": 85,
  "performanceData": {
    "timeSpent": 120,
    "correctAnswers": 17,
    "totalQuestions": 20
  },
  "srsItemId": "vocab-123",
  "srsCorrect": true
}
```

**Response (201 Created):**
```json
{
  "userId": "uuid-string",
  "taskId": "task-uuid-string",
  "completedAt": "2025-04-25T06:15:00.000Z",
  "score": 85,
  "performanceData": {
    "timeSpent": 120,
    "correctAnswers": 17,
    "totalQuestions": 20
  }
}
```

### Table of Contents (ToC)

#### Get Next Task

```
GET /users/me/next-task
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "taskId": "task-uuid-string",
  "taskType": "lesson",
  "contentRefId": "intro-lesson-2",
  "difficultyLevel": 1
}
```

If all tasks are completed:
```json
{
  "message": "All tasks completed!"
}
```

### Spaced Repetition System (SRS)

#### Get SRS Review Items

```
GET /users/me/srs/review-items?itemType=vocab&limit=10
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Parameters:**
- `itemType` (required): Type of items to review (e.g., "vocab", "grammar")  
- `limit` (optional): Maximum number of items to return (default: 10)

**Response (200 OK):**
```json
[
  {
    "userId": "uuid-string",
    "itemId": "vocab-123",
    "itemType": "vocab",
    "nextReviewAt": "2025-04-25T06:00:00.000Z"
  },
  {
    "userId": "uuid-string",
    "itemId": "vocab-456",
    "itemType": "vocab",
    "nextReviewAt": "2025-04-25T07:30:00.000Z"
  }
]
```

## Database Schema

For reference, the service uses the following database schema:

### Users
- `user_id` (UUID, primary key)
- `name` (VARCHAR)
- `email` (VARCHAR, unique)
- `password_hash` (VARCHAR)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Task Definitions
- `task_id` (UUID, primary key)
- `task_type` (VARCHAR) - e.g., 'lesson', 'exercise', 'quiz'
- `content_ref_id` (VARCHAR) - Reference to content in external system
- `difficulty_level` (INTEGER) - Optional difficulty rating
- `sequence_order` (INTEGER) - For ordering in table of contents
- `created_at` (TIMESTAMP)

### User Task Progress
- `user_id` (UUID, foreign key to users)
- `task_id` (UUID, foreign key to task_definitions)
- `completed_at` (TIMESTAMP)
- `score` (NUMERIC) - Optional score (e.g., 0-100)
- `performance_data` (JSONB) - Flexible performance metrics
- Primary key: (user_id, task_id)

### User SRS Items
- `user_id` (UUID, foreign key to users)
- `item_id` (VARCHAR) - ID of the item (e.g., vocabulary word)
- `item_type` (VARCHAR) - e.g., 'vocab', 'grammar'
- `last_reviewed_at` (TIMESTAMP)
- `next_review_at` (TIMESTAMP)
- `current_interval` (INTERVAL) - Interval for spaced repetition
- `ease_factor` (REAL) - SM-2 algorithm ease factor
- Primary key: (user_id, item_id, item_type)

## Implementation Notes

1. All protected endpoints require valid JWT token authentication
2. The SRS system implements a modified version of the SuperMemo 2 (SM-2) algorithm
3. User IDs are UUIDs for enhanced security and to prevent sequential ID guessing
4. Task progress can optionally include SRS item updates using the srsItemId and srsCorrect fields
