#!/bin/bash

# Colors for better terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Application with Mock User Progress Service...${NC}"

# Start the main application with mock service
echo -e "${BLUE}Starting Application...${NC}"
echo -e "${BLUE}Using mock user progress service - no database needed${NC}"
echo -e "${BLUE}Test login credentials: test@example.com / password${NC}"

npm run dev
