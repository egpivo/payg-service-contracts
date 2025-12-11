.PHONY: help install compile test deploy node clean

# Default target
help:
	@echo "Available targets:"
	@echo "  make install    - Install dependencies (env builder)"
	@echo "  make compile    - Compile Solidity contracts"
	@echo "  make test       - Run all tests"
	@echo "  make deploy     - Deploy contract to local network"
	@echo "  make node       - Start local Hardhat node"
	@echo "  make clean      - Clean cache and artifacts"
	@echo "  make run        - Compile, test, and deploy (full workflow)"

# 1. Environment builder - Install dependencies
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Dependencies installed!"

# 2. Compile contracts
compile:
	@echo "Compiling contracts..."
	npm run compile
	@echo "Contracts compiled!"

# 3. Run tests
test:
	@echo "Running tests..."
	npm test
	@echo "Tests completed!"

# Deploy contract
deploy:
	@echo "Deploying contract..."
	npm run deploy
	@echo "Contract deployed!"

# Start local Hardhat node
node:
	@echo "Starting local Hardhat node..."
	npm run node

# Clean build artifacts
clean:
	@echo "Cleaning cache and artifacts..."
	rm -rf cache artifacts typechain-types
	@echo "Cleaned!"

# Full workflow: compile, test, and deploy
run: compile test deploy
	@echo "Full workflow completed!"
