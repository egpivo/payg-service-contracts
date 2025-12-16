#!/bin/bash

# Script to install OpenZeppelin Contracts library
# Usage: ./scripts/install-openzeppelin.sh [version]
# Example: ./scripts/install-openzeppelin.sh v5.5.0

set -e

VERSION="${1:-latest}"

echo "🔧 Installing OpenZeppelin Contracts library..."

# Check if forge is available
if ! command -v forge &> /dev/null; then
    echo "❌ Error: forge command not found!"
    echo "   Please install Foundry first by running: ./scripts/install-foundry.sh"
    exit 1
fi

# Check if lib directory exists, create if not
if [ ! -d "lib" ]; then
    echo "📁 Creating lib directory..."
    mkdir -p lib
fi

# Check if already installed
if [ -d "lib/openzeppelin-contracts" ]; then
    echo "⚠️  OpenZeppelin Contracts is already installed in lib/openzeppelin-contracts"
    echo "   To reinstall, please remove it first: rm -rf lib/openzeppelin-contracts"
    read -p "   Do you want to reinstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Skipping installation."
        exit 0
    fi
    echo "🗑️  Removing existing installation..."
    rm -rf lib/openzeppelin-contracts
fi

# Install OpenZeppelin Contracts
if [ "$VERSION" = "latest" ]; then
    echo "📥 Installing latest version of OpenZeppelin Contracts..."
    forge install OpenZeppelin/openzeppelin-contracts
else
    echo "📥 Installing OpenZeppelin Contracts version $VERSION..."
    forge install OpenZeppelin/openzeppelin-contracts@$VERSION
fi

# Verify installation
if [ -d "lib/openzeppelin-contracts" ]; then
    echo ""
    echo "✅ OpenZeppelin Contracts installation completed!"
    echo ""
    echo "📦 Installed location: lib/openzeppelin-contracts"
    echo ""
    echo "💡 Make sure your foundry.toml includes the remapping:"
    echo "   remappings = ["
    echo "       \"@openzeppelin/=lib/openzeppelin-contracts/contracts/\""
    echo "   ]"
    echo ""
    echo "📚 Available contracts:"
    echo "   - @openzeppelin/access/Ownable.sol"
    echo "   - @openzeppelin/utils/ReentrancyGuard.sol"
    echo "   - @openzeppelin/access/AccessControl.sol"
    echo "   - And many more..."
else
    echo "❌ Error: Installation failed!"
    exit 1
fi

