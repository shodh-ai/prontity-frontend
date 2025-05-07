# AI-Powered Essay Service

This project is a full-stack web application designed to assist users in writing essays by providing a rich text editing environment coupled with AI-powered feedback, real-time collaboration features, and background grading capabilities.

## Features

*   **Rich Text Editing:** Uses the [Tiptap](https://tiptap.dev/) headless editor framework for a modern writing experience.
*   **AI Analysis & Feedback:** Integrates with the OpenAI API (GPT models) to provide inline suggestions and comments on essay content based on specific criteria (e.g., TOEFL rubrics).
*   **Real-time Collaboration:** Supports simultaneous editing by multiple users using Tiptap's collaboration extensions powered by Yjs and WebSockets.
*   **Background Grading:** Offloads potentially long-running grading tasks to a background worker using BullMQ and Redis.
*   **Database Storage:** Persists essay content, user data (implicitly), and comments in a PostgreSQL database.

## Tech Stack

*   **Frontend:**
    *   Framework: Next.js (v15+) with App Router
    *   Language: TypeScript
    *   UI: React (v19+), TailwindCSS
    *   Editor: Tiptap (v2+)
    *   State Management/Fetching: Tanstack Query
    *   Real-time: Socket.IO Client, Yjs, y-websocket
*   **Backend:**
    *   Runtime: Node.js
    *   Framework: Express.js
    *   Language: JavaScript (ES modules implied by setup)
    *   Database: PostgreSQL (with `pg` driver)
    *   Job Queue: BullMQ
    *   Cache/Messaging: Redis
    *   AI Integration: OpenAI Node.js Library
    *   Real-time: Socket.IO
*   **Development:**
    *   Package Management: npm
    *   Linting: ESLint
    *   Dev Server: Nodemon (backend)

## Project Structure

```
/essay-service-page
├── backend/         # Node.js/Express backend service
│   ├── src/         # Source code (server, routes, services, config, worker)
│   ├── .env.example # Environment variable template
│   └── package.json
├── frontend/        # Next.js frontend application
│   ├── src/         # Source code (app router, components, lib)
│   └── package.json
├── db_schema.sql    # SQL script for setting up the database schema
└── README.md        # This file
```

## Setup & Installation

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)
*   [Git](https://git-scm.com/)
*   [PostgreSQL](https://www.postgresql.org/) database server
*   [Redis](https://redis.io/) server
*   (Optional) [Docker](https://www.docker.com/) and Docker Compose can be used to easily run PostgreSQL and Redis.

### Steps

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd essay-service-page
    ```

2.  **Setup Backend:**
    *   Navigate to the backend directory:
        ```bash
        cd backend
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   Create the environment file from the example:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file with your specific configuration:
        *   `DATABASE_URL`: Your PostgreSQL connection string (e.g., `postgresql://user:password@host:port/database`).
        *   `OPENAI_API_KEY`: Your API key from OpenAI.
        *   `REDIS_HOST`: Hostname for your Redis server (e.g., `localhost`).
        *   `REDIS_PORT`: Port for your Redis server (e.g., `6379`).
        *   `REDIS_PASSWORD`: Password for Redis, if applicable (uncomment if needed).
        *   `PORT`: Port for the backend server (defaults to `3001`).
    *   **Database Setup:**
        *   Ensure your PostgreSQL server is running.
        *   Create a database for this project (e.g., `essay_service_db`).
        *   Connect to your database using `psql` or a GUI tool.
        *   Run the schema script located in the project root:
            ```bash
            # Example using psql
            psql -U your_db_user -d your_db_name -a -f ../db_schema.sql
            ```
        *   Make sure the `DATABASE_URL` in `.env` points to this database.
    *   **Redis Setup:**
        *   Ensure your Redis server is running.
        *   Update `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` in `.env` if they differ from the defaults.

3.  **Setup Frontend:**
    *   Navigate to the frontend directory from the project root:
        ```bash
        cd ../frontend
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   *(Note: The frontend seems configured to connect to the backend at `http://localhost:3001`. If your backend runs on a different URL, you might need to update API call locations, likely within `frontend/src/lib` or where `axios` is used.)*

## Running the Application

You need to run three separate processes:

1.  **Backend Server:**
    ```bash
    cd backend
    npm run dev # For development with auto-reload
    # OR
    npm start   # For production
    ```
    *(The server typically runs on `http://localhost:3001`)*

2.  **Backend Worker:**
    ```bash
    cd backend
    npm run worker
    ```
    *(This process listens to the BullMQ job queue)*

3.  **Frontend Development Server:**
    ```bash
    cd frontend
    npm run dev
    ```
    *(The frontend is typically accessible at `http://localhost:3000`)*

Open `http://localhost:3000` in your browser to use the application.

## Reusability Notes

This project is a self-contained full-stack application. Reusing parts in another application typically involves one of the following approaches:

1.  **Using the Backend API:** Run this project's backend independently and have your other application make HTTP requests to its API endpoints (e.g., `POST /essays`, `POST /essays/:id/analyze`).
2.  **Extracting Frontend Components:** Carefully extract specific React components (like the Tiptap editor setup) from the `frontend` directory. This requires significant refactoring to remove dependencies on this project's specific state management, API structure, and styling, and adapt them to your target application.

Directly importing the entire project as a single component into another Next.js application is not feasible due to its full-stack nature.
