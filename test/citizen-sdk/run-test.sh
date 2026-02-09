#!/bin/bash
# Helper script to run connected accounts tests
# 
# Usage:
#   ./run-test.sh
#
# Configuration is loaded from .env file
# Copy .env.example to .env and add your test addresses

# Change to script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load .env file if it exists
if [ -f .env ]; then
  echo "📋 Loading configuration from .env file..."
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
  echo "⚠️  No .env file found. Checking for environment variables..."
fi

# Validate required environment variables
if [ -z "$MAIN_ACCOUNT" ] || [ -z "$CONNECTED_ACCOUNT" ] || [ -z "$NON_WHITELISTED_ACCOUNT" ]; then
  echo ""
  echo "❌ Error: Missing required environment variables"
  echo ""
  echo "Please create a .env file based on .env.example:"
  echo "  cp .env.example .env"
  echo ""
  echo "Then edit .env and add your test addresses:"
  echo "  MAIN_ACCOUNT=0x..."
  echo "  CONNECTED_ACCOUNT=0x..."
  echo "  NON_WHITELISTED_ACCOUNT=0x..."
  echo ""
  exit 1
fi

# Set defaults for optional variables
ENV=${ENV:-"development"}
RPC_URL=${RPC_URL:-"https://forno.celo.org"}

echo ""
echo "🧪 Running Connected Accounts SDK Test"
echo ""
echo "Configuration:"
echo "  Main Account: $MAIN_ACCOUNT"
echo "  Connected Account: $CONNECTED_ACCOUNT"
echo "  Non-Whitelisted: $NON_WHITELISTED_ACCOUNT"
echo "  Environment: $ENV"
echo "  RPC URL: $RPC_URL"
echo ""

# Run the test
npx tsx ./connected-accounts.ts
