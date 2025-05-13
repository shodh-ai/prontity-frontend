#!/bin/bash
# Script to set up the Tavus + Gemini integration

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Tavus Avatar + Google Gemini integration...${NC}"

# Activate combined environment
if [ -d "combined_env" ]; then
    echo -e "${GREEN}Activating combined environment...${NC}"
    source combined_env/bin/activate
else
    echo -e "${RED}Combined environment not found!${NC}"
    echo -e "${YELLOW}Please run setup_combined_env.sh first to create the combined environment.${NC}"
    exit 1
fi

# Check for existing .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}No .env file found in the current directory.${NC}"
    
    # Check if there are .env files in the subdirectories
    if [ -f "full_implementation/.env" ]; then
        echo -e "${GREEN}Found .env file in full_implementation directory. Copying...${NC}"
        cp full_implementation/.env ./.env
    elif [ -f "vpa_new/.env" ]; then
        echo -e "${GREEN}Found .env file in vpa_new directory. Copying...${NC}"
        cp vpa_new/.env ./.env
    else
        echo -e "${RED}No .env files found in subdirectories!${NC}"
        echo -e "${YELLOW}Please rename sample.env to .env and fill in your credentials.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Integration setup complete!${NC}"
echo -e "${YELLOW}To run the integrated agent with Tavus avatar:${NC}"
echo -e "python tavus_gemini_integration.py --room YourRoomName --avatar"
echo -e ""
echo -e "${YELLOW}To run the integrated agent without avatar:${NC}"
echo -e "python tavus_gemini_integration.py --room YourRoomName"
