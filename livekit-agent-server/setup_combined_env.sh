#!/bin/bash
# Script to set up a combined virtual environment with dependencies from both projects

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up combined virtual environment for Tavus Avatar and Gemini integration...${NC}"

# Create a new virtual environment
ENV_NAME="combined_env"
python -m venv $ENV_NAME
echo -e "${GREEN}Created new virtual environment: $ENV_NAME${NC}"

# Activate the virtual environment
source $ENV_NAME/bin/activate
echo -e "${GREEN}Activated virtual environment${NC}"

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip

# Install dependencies from combined requirements file
echo -e "${YELLOW}Installing dependencies from combined_requirements.txt...${NC}"
pip install -r combined_requirements.txt

# Install LiveKit packages from GitHub for latest features
echo -e "${YELLOW}Installing LiveKit packages from GitHub...${NC}"
pip install git+https://github.com/livekit/agents.git
pip install git+https://github.com/livekit/plugins.git

# Check if the installation was successful
echo -e "${GREEN}Checking installations...${NC}"
python -c "import livekit; import livekit.plugins; import google.generativeai; import tavus; print('All required packages imported successfully!')" || echo -e "${RED}Some packages may not have installed correctly. Please check for errors.${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating sample .env file...${NC}"
    cat > .env << EOF
# LiveKit credentials
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Tavus credentials
TAVUS_API_KEY=your_tavus_api_key
TAVUS_REPLICA_ID=your_tavus_replica_id
TAVUS_PERSONA_ID=your_tavus_persona_id

# Google credentials
GOOGLE_API_KEY=your_google_api_key

# Deepgram credentials
DEEPGRAM_API_KEY=your_deepgram_api_key

# OpenAI credentials
OPENAI_API_KEY=your_openai_api_key
EOF
    echo -e "${GREEN}.env file created. Please update it with your actual credentials.${NC}"
else
    echo -e "${YELLOW}.env file already exists. Make sure it contains all required credentials.${NC}"
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}To activate this environment in the future, run:${NC}"
echo -e "source $ENV_NAME/bin/activate"

# Instructions for running the application
echo -e "${GREEN}To run the integrated application with Tavus avatar and Gemini model:${NC}"
echo -e "python full_implementation/main.py connect --room YourRoomName --avatar"
