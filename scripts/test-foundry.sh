#!/bin/bash

# Script to run Foundry tests
# Usage: ./scripts/test-foundry.sh [options]
# Options:
#   --match-test <pattern>  - Run tests matching pattern
#   --match-contract <pattern> - Run tests in contracts matching pattern
#   -v, -vv, -vvv          - Verbose output
#   --gas-report            - Show gas report
#   --coverage              - Generate coverage report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if forge is available
if ! command -v forge &> /dev/null; then
    # Try to use foundry from ~/.foundry/bin
    if [ -f "$HOME/.foundry/bin/forge" ]; then
        export PATH="$HOME/.foundry/bin:$PATH"
    else
        echo -e "${RED}❌ Error: forge command not found!${NC}"
        echo ""
        echo "Please install Foundry first by running:"
        echo "  ./scripts/install-foundry.sh"
        echo ""
        exit 1
    fi
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project directory
cd "$PROJECT_DIR"

echo -e "${GREEN}🧪 Running Foundry tests...${NC}"
echo ""

# Check if forge-std is installed
if [ ! -d "lib/forge-std" ]; then
    echo -e "${YELLOW}⚠️  forge-std not found. Installing...${NC}"
    forge install foundry-rs/forge-std
    echo ""
fi

# Run forge test with all passed arguments
if [ $# -eq 0 ]; then
    # No arguments, run all tests
    forge test
else
    # Pass all arguments to forge test
    forge test "$@"
fi

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed!${NC}"
fi

exit $TEST_EXIT_CODE

