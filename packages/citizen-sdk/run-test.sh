#!/bin/bash
# Helper script to run connected accounts tests with example addresses
# 
# Usage:
#   ./run-test.sh
#
# Or with custom addresses:
#   MAIN_ACCOUNT=0x... CONNECTED_ACCOUNT=0x... ./run-test.sh

# Example test addresses (replace with real ones)
# These are example addresses - you need to replace them with actual test accounts
MAIN_ACCOUNT=${MAIN_ACCOUNT:-"0x0Fe3A9B6D34693e6e0DEd6BD006dD062D6F59d2c"}
CONNECTED_ACCOUNT=${CONNECTED_ACCOUNT:-"0x0Fe3A9B6D34693e6e0DEd6BD006dD062D6F59d2c"}
NON_WHITELISTED_ACCOUNT=${NON_WHITELISTED_ACCOUNT:-"0x0000000000000000000000000000000000000001"}
ENV=${ENV:-"development"}

echo "🧪 Running Connected Accounts Test"
echo ""
echo "Configuration:"
echo "  Main Account: $MAIN_ACCOUNT"
echo "  Connected Account: $CONNECTED_ACCOUNT"
echo "  Non-Whitelisted: $NON_WHITELISTED_ACCOUNT"
echo "  Environment: $ENV"
echo ""

MAIN_ACCOUNT=$MAIN_ACCOUNT \
CONNECTED_ACCOUNT=$CONNECTED_ACCOUNT \
NON_WHITELISTED_ACCOUNT=$NON_WHITELISTED_ACCOUNT \
ENV=$ENV \
node test-connected-accounts.js
