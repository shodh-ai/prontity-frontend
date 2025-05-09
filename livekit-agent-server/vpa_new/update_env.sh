#!/bin/bash

# Backup original .env file
cp .env .env.backup

# Update the MY_CUSTOM_AGENT_URL to use port 5005 instead of 5000
sed -i '' 's|MY_CUSTOM_AGENT_URL=http://localhost:5000/process|MY_CUSTOM_AGENT_URL=http://localhost:5005/process|g' .env

echo "Updated MY_CUSTOM_AGENT_URL in .env file to use port 5005"
grep MY_CUSTOM_AGENT_URL .env
