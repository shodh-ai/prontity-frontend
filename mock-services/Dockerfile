# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the service ports (adjust based on your configuration)
EXPOSE 3003 3004 3005

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Start the mock services
CMD ["python", "-m", "mock_canvas_service.py"] 