# Use Node.js 18 as the base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose the service port
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"] 