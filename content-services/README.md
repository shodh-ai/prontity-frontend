# AI English Tutor - Content Service

This microservice is responsible for storing and serving static learning content (vocabulary, speaking topics, writing prompts) for the AI English Tutor platform.

## Technology Stack

*   Node.js
*   Express.js
*   TypeScript
*   PostgreSQL (using `pg` library)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd content-service
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    *   Create a `.env` file in the root directory.
    *   Copy the contents of `.env.example` into `.env`.
    *   Fill in the required database connection details (e.g., `DATABASE_URL` or individual `PG*` variables) and the desired `PORT`.
4.  **Database Schema:**
    *   Ensure you have a PostgreSQL database running.
    *   Connect to your database and execute the SQL commands provided in the initial project description (or use a migration tool) to create the `vocab_words`, `speaking_topics`, and `writing_prompts` tables, along with the `update_timestamp` trigger.
5.  **Seed the database:**
    *   Populate the tables with initial content data (this process is outside the scope of this service's runtime operation).

## Running the Service

*   **Development (with hot-reloading):**
    ```bash
    npm run dev
    ```
    This uses `ts-node` to run the TypeScript code directly.

*   **Production:**
    1.  Build the TypeScript code:
        ```bash
        npm run build
        ```
    2.  Start the compiled JavaScript code:
        ```bash
        npm run start
        ```

## API Endpoints

*   `GET /content/vocab/:wordId`
    *   Retrieves a specific vocabulary word by its ID.
*   `GET /content/speaking/topic/:topicId`
    *   Retrieves a specific speaking topic by its ID.
*   `GET /content/writing/prompt/:promptId`
    *   Retrieves a specific writing prompt by its ID.

See the project description for detailed request/response formats.
