# Mock Services

This directory contains mock implementations of the external services used by the application. These mock services are useful for development and testing without needing to connect to the real services.

## Services Included

- **Content Service** (`mock_content_service.py`): Provides vocabulary words, speaking topics, and writing prompts.
- **User Progress Service** (`mock_user_progress_service.py`): Handles user progress tracking and next task recommendations.
- **Canvas Service** (`mock_canvas_service.py`): Manages canvas drawing states for vocabulary practice.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv mock-services-env
   ```

2. Activate the virtual environment:
   ```bash
   # On macOS/Linux
   source mock-services-env/bin/activate
   # On Windows
   mock-services-env\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Services

### Content Service
```bash
python mock_content_service.py
```
Default port: 3001

### User Progress Service
```bash
python mock_user_progress_service.py
```
Default port: 8001

### Canvas Service
```bash
python mock_canvas_service.py
```
Default port: 3002

## Environment Variables

You can customize the ports by setting environment variables:

- `MOCK_CONTENT_SERVICE_PORT`: Port for the Content Service (default: 3001)
- `MOCK_USER_PROGRESS_SERVICE_PORT`: Port for the User Progress Service (default: 8001)
- `MOCK_CANVAS_SERVICE_PORT`: Port for the Canvas Service (default: 3002)

## API Endpoints

See each mock service file for details on the available endpoints and their expected request/response formats.
