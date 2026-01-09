#!/bin/bash

# Start complete demo environment: Anvil + Deploy + Next.js
# Usage: ./scripts/start-demo.sh

set -e

echo "=== Starting PAYG Demo Environment ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Cleanup function to stop existing services
cleanup_existing_services() {
    echo -e "${BLUE}0. Cleaning up existing services...${NC}"
    
    # Stop existing Anvil processes
    ANVIL_PIDS=$(lsof -ti :8545 2>/dev/null || echo "")
    if [ -n "$ANVIL_PIDS" ]; then
        echo "   Stopping existing Anvil processes on port 8545..."
        echo "$ANVIL_PIDS" | xargs kill -9 2>/dev/null || true
        sleep 1
        # Double check and force kill if still running
        if lsof -ti :8545 > /dev/null 2>&1; then
            echo "   Force stopping remaining Anvil processes..."
            lsof -ti :8545 | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        echo -e "   ${GREEN}✓ Anvil processes stopped${NC}"
    else
        echo "   No existing Anvil processes found"
    fi
    
    # Stop existing Next.js dev servers
    NEXTJS_PIDS=$(lsof -ti :3000 2>/dev/null || echo "")
    if [ -n "$NEXTJS_PIDS" ]; then
        echo "   Stopping existing Next.js dev servers on port 3000..."
        echo "$NEXTJS_PIDS" | xargs kill -9 2>/dev/null || true
        sleep 1
        # Double check and force kill if still running
        if lsof -ti :3000 > /dev/null 2>&1; then
            echo "   Force stopping remaining Next.js processes..."
            lsof -ti :3000 | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        echo -e "   ${GREEN}✓ Next.js processes stopped${NC}"
    else
        echo "   No existing Next.js processes found"
    fi
    
    echo ""
}

# Always cleanup existing services before starting
cleanup_existing_services

# Check if Anvil is already running (should be false after cleanup, but check anyway)
if lsof -i :8545 > /dev/null 2>&1; then
    echo -e "${RED}⚠️  Warning: Port 8545 is still in use after cleanup${NC}"
    echo "   Attempting to force stop..."
    lsof -ti :8545 | xargs kill -9 2>/dev/null || true
    sleep 2
    if lsof -i :8545 > /dev/null 2>&1; then
        echo -e "${RED}Error: Could not free port 8545. Please manually stop the process and try again.${NC}"
        exit 1
    fi
fi

# Start Anvil
if true; then
    echo -e "${BLUE}1. Starting Anvil...${NC}"
    # Start Anvil in background with zero gas fees
    # Use nohup to ensure it keeps running even if terminal closes
    nohup anvil --base-fee 0 --gas-price 0 --block-time 0.5 > /tmp/anvil.log 2>&1 &
    ANVIL_PID=$!
    echo "   Anvil started (PID: $ANVIL_PID)"
    echo "   Logs: /tmp/anvil.log"
    
    # Wait for Anvil to be ready
    echo "   Waiting for Anvil to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8545 > /dev/null 2>&1; then
            echo -e "   ${GREEN}✓ Anvil is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "   Error: Anvil failed to start after 30 seconds"
            kill $ANVIL_PID 2>/dev/null || true
            exit 1
        fi
        sleep 1
    done
    ANVIL_RUNNING=false
    
    # Set up cleanup trap to kill Anvil and Next.js when script exits (if we started them)
    trap "echo ''; echo 'Stopping services...'; kill $ANVIL_PID 2>/dev/null || true; lsof -ti :3000 | xargs kill -9 2>/dev/null || true; echo 'Demo stopped.'" EXIT INT TERM
fi

echo ""
echo -e "${BLUE}2. Deploying contracts...${NC}"

# Check if contracts need deployment
CONTRACT_ADDRESS=$(cat demo/contracts.json 2>/dev/null | grep -o '"PoolRegistry": "[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$CONTRACT_ADDRESS" ] && [ "$CONTRACT_ADDRESS" != "0x0000000000000000000000000000000000000000" ]; then
    # Check if contract actually exists
    CODE=$(curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$CONTRACT_ADDRESS\",\"latest\"],\"id\":1}" \
        | grep -o '"result":"[^"]*"' | cut -d'"' -f4 || echo "0x")
    
    if [ "$CODE" != "0x" ] && [ -n "$CODE" ]; then
        echo -e "   ${GREEN}✓ Contract already deployed at $CONTRACT_ADDRESS${NC}"
        echo "   Skipping deployment..."
        DEPLOY_NEEDED=false
    else
        echo "   Contract address in config but code not found, redeploying..."
        DEPLOY_NEEDED=true
    fi
else
    DEPLOY_NEEDED=true
fi

if [ "$DEPLOY_NEEDED" = true ]; then
    # Run deployment script
    ./scripts/deploy-local.sh
    echo -e "   ${GREEN}✓ Contracts deployed!${NC}"
else
    echo "   Using existing deployment"
fi

echo ""
echo -e "${BLUE}3. Cleaning Next.js cache...${NC}"
cd demo/web
if [ -d ".next" ]; then
    rm -rf .next
    echo -e "   ${GREEN}✓ Next.js cache cleared${NC}"
else
    echo "   No cache to clear"
fi
cd ../..

echo ""
echo -e "${BLUE}4. Installing Web UI dependencies (if needed)...${NC}"
cd demo/web
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "   ${GREEN}✓ Dependencies installed${NC}"
else
    echo "   Dependencies already installed"
fi
cd ../..

echo ""
echo -e "${GREEN}=== Demo Environment Ready! ===${NC}"
echo ""
echo "📋 Summary:"
echo "   • Anvil: http://localhost:8545 (Chain ID: 31337)"
if [ "$ANVIL_RUNNING" = false ]; then
    echo "   • Anvil PID: $ANVIL_PID (running in background)"
fi
CONTRACT_ADDR=$(cat demo/contracts.json 2>/dev/null | grep -o '"PoolRegistry": "[^"]*"' | cut -d'"' -f4 || echo "Not deployed")
echo "   • Contract: $CONTRACT_ADDR"
echo ""
echo -e "${BLUE}5. Starting Next.js dev server...${NC}"
echo ""
echo "   🌐 Web UI: http://localhost:3000"
echo -e "   ${YELLOW}💡 Tip: If you see stale UI, do a hard refresh (Cmd+Shift+R / Ctrl+Shift+R)${NC}"
echo "   📝 Press Ctrl+C to stop all services (Anvil + Next.js)"
echo ""

# Start Next.js dev server (this will block)
cd demo/web
npm run dev
