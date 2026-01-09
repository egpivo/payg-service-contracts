#!/bin/bash

# Script to restart Anvil with optimized settings for fast local development

echo "🔄 Restarting Anvil with optimized settings..."

# Kill existing Anvil processes on port 8545
echo "Stopping existing Anvil processes..."
lsof -ti:8545 | xargs kill -9 2>/dev/null || echo "No existing Anvil process found"

# Wait a moment for port to be released
sleep 1

# Check if port is free
if lsof -ti:8545 > /dev/null 2>&1; then
    echo "⚠️  Warning: Port 8545 is still in use. Trying again..."
    sleep 2
    lsof -ti:8545 | xargs kill -9 2>/dev/null
    sleep 1
fi

# Start Anvil with optimized settings
echo ""
echo "🚀 Starting Anvil with optimized settings:"
echo "   - Block Time: 0.5 seconds (very fast)"
echo "   - Gas Price: 0 (free transactions)"
echo "   - Base Fee: 0"
echo "   - RPC URL: http://localhost:8545"
echo "   - Chain ID: 31337"
echo ""

anvil \
  --base-fee 0 \
  --gas-price 0 \
  --block-time 0.5 \
  --host 0.0.0.0 \
  --port 8545




