#!/bin/bash

# Script to install Foundry
# Usage: ./scripts/install-foundry.sh

set -e

echo "🔧 Installing Foundry..."

# Check if foundryup already exists
if command -v foundryup &> /dev/null; then
    echo "✅ Foundry is already installed!"
    foundryup
    exit 0
fi

# Check if ~/.foundry/bin/foundryup exists
if [ -f "$HOME/.foundry/bin/foundryup" ]; then
    echo "✅ Foundry installation script found, running foundryup..."
    "$HOME/.foundry/bin/foundryup"
    exit 0
fi

# Install foundryup
echo "📥 Downloading foundryup installation script..."
curl -L https://foundry.paradigm.xyz | bash

# Add foundry to PATH for current session
export PATH="$HOME/.foundry/bin:$PATH"

# Run foundryup to install Foundry tools
echo "📦 Installing Foundry tools (forge, cast, anvil, chisel)..."
"$HOME/.foundry/bin/foundryup"

# Install forge-std if not already installed
if [ ! -d "lib/forge-std" ]; then
    echo "📚 Installing forge-std library..."
    "$HOME/.foundry/bin/forge" install foundry-rs/forge-std
fi

echo ""
echo "✅ Foundry installation completed!"
echo ""
echo "To use Foundry in your current shell, run:"
echo "  export PATH=\"\$HOME/.foundry/bin:\$PATH\""
echo ""
echo "Or add this to your ~/.zshrc or ~/.bashrc:"
echo "  export PATH=\"\$HOME/.foundry/bin:\$PATH\""
echo ""
echo "To verify installation, run:"
echo "  forge --version"

