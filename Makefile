.PHONY: help install compile test coverage deploy node clean foundry-install foundry-test foundry-test-verbose foundry-test-gas

# Default target
help:
	@echo "Available targets:"
	@echo "  make install    - Install dependencies (env builder)"
	@echo "  make compile    - Compile Solidity contracts"
	@echo "  make test       - Run all tests (Hardhat)"
	@echo "  make coverage   - Run tests with coverage report"
	@echo "  make deploy     - Deploy contract to local network"
	@echo "  make node       - Start local Hardhat node"
	@echo "  make clean      - Clean cache and artifacts"
	@echo "  make run        - Compile, test, and deploy (full workflow)"
	@echo ""
	@echo "Foundry targets:"
	@echo "  make foundry-install      - Install Foundry"
	@echo "  make foundry-test        - Run Foundry tests"
	@echo "  make foundry-test-verbose - Run Foundry tests with verbose output"
	@echo "  make foundry-test-gas    - Run Foundry tests with gas report"

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

# Run tests with coverage
coverage:
	@echo "Running tests with coverage..."
	npm run coverage
	@echo "Coverage report generated in coverage/ directory!"

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
	rm -rf cache artifacts typechain-types coverage coverage.json
	@echo "Cleaned!"

# Full workflow: compile, test, and deploy
run: compile test deploy
	@echo "Full workflow completed!"

# Foundry installation
foundry-install:
	@echo "Installing Foundry..."
	@./scripts/install-foundry.sh

# Foundry tests
foundry-test:
	@echo "Running Foundry tests..."
	@./scripts/test-foundry.sh

# Foundry tests with verbose output
foundry-test-verbose:
	@echo "Running Foundry tests with verbose output..."
	@./scripts/test-foundry.sh -vv

# Foundry tests with gas report
foundry-test-gas:
	@echo "Running Foundry tests with gas report..."
	@./scripts/test-foundry.sh --gas-report
