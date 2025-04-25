#!/bin/bash
# Setup script for Vocabulary Canvas PostgreSQL database

# Set color variables for output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Vocabulary Canvas Database Setup ===${NC}"

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
  echo -e "${GREEN}Loaded environment variables from .env file${NC}"
else
  echo -e "${RED}Error: .env file not found${NC}"
  exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql > /dev/null; then
  echo -e "${RED}Error: PostgreSQL is not installed. Please install PostgreSQL and try again.${NC}"
  exit 1
fi

# Function to run a PostgreSQL command
run_psql() {
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -c "$1" $2
  return $?
}

# Function to check if database exists
db_exists() {
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -lqt | cut -d \| -f 1 | grep -qw $PGDATABASE
  return $?
}

echo -e "${YELLOW}Checking if database '$PGDATABASE' exists...${NC}"
if db_exists; then
  echo -e "${GREEN}Database '$PGDATABASE' already exists.${NC}"
else
  echo -e "${YELLOW}Creating database '$PGDATABASE'...${NC}"
  run_psql "CREATE DATABASE $PGDATABASE;" postgres
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database '$PGDATABASE' created successfully.${NC}"
  else
    echo -e "${RED}Error: Failed to create database '$PGDATABASE'.${NC}"
    exit 1
  fi
fi

# Run the initialization script
echo -e "${YELLOW}Initializing database schema...${NC}"
npx ts-node src/data/init-db.ts

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Database schema initialized successfully.${NC}"
else
  echo -e "${RED}Error: Failed to initialize database schema.${NC}"
  exit 1
fi

echo -e "${GREEN}Database setup completed successfully!${NC}"
echo -e "${YELLOW}You can now start the Vocabulary Canvas service.${NC}"
