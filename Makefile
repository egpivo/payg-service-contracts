.PHONY: help install compile test coverage format lint deploy node clean

# Default target
help:
	@echo "Available targets:"
	@echo "  make install    - Install dependencies (env builder)"
	@echo "  make compile    - Compile Solidity contracts"
	@echo "  make test       - Run all tests"
	@echo "  make coverage   - Run tests with coverage report"
	@echo "  make format     - Format all files with Prettier"
	@echo "  make lint       - Lint JavaScript and Solidity files"
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

# Run tests with coverage
coverage:
	@echo "Running tests with coverage..."
	npm run coverage
	@echo "Coverage report generated in coverage/ directory!"

# Format code
format:
	@echo "Formatting code..."
	npm run format
	@echo "Code formatted!"

# Lint code
lint:
	@echo "Linting JavaScript files..."
	npm run lint || true
	@echo "Linting Solidity files..."
	npm run lint:sol || true
	@echo "Linting completed!"

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
