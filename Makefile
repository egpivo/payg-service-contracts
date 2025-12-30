.PHONY: help install compile test coverage clean clean-all foundry-install openzeppelin-install test-verbose test-gas web-install web-dev web-build web-start web-clean

# Default target
help:
	@echo "Available targets:"
	@echo "  make install           - Install Foundry and dependencies"
	@echo "  make compile           - Compile Solidity contracts (forge build)"
	@echo "  make test              - Run all Foundry tests"
	@echo "  make test-verbose      - Run tests with verbose output"
	@echo "  make test-gas          - Run tests with gas report"
	@echo "  make coverage          - Generate test coverage report"
	@echo "  make clean             - Clean cache and artifacts"
	@echo ""
	@echo "Installation targets:"
	@echo "  make foundry-install      - Install Foundry"
	@echo "  make openzeppelin-install - Install OpenZeppelin Contracts"
	@echo "  make web-install          - Install Web UI dependencies (demo/web)"
	@echo ""
	@echo "Web UI targets (demo/web):"
	@echo "  make web-dev              - Run Web UI development server"
	@echo "  make web-build            - Build Web UI for production"
	@echo "  make web-start            - Start production Web UI server"
	@echo "  make web-clean            - Clean Web UI node_modules and build artifacts"

# Install Foundry and dependencies
install: foundry-install openzeppelin-install
	@echo "Installation completed!"

# Compile contracts
compile:
	@echo "Compiling contracts with Foundry..."
	@forge build
	@echo "Contracts compiled!"

# Run tests
test:
	@echo "Running Foundry tests..."
	@./scripts/test-foundry.sh
	@echo "Tests completed!"

# Run tests with verbose output
test-verbose:
	@echo "Running Foundry tests with verbose output..."
	@./scripts/test-foundry.sh -vv

# Run tests with gas report
test-gas:
	@echo "Running Foundry tests with gas report..."
	@./scripts/test-foundry.sh --gas-report

# Generate coverage report
coverage:
	@echo "Generating coverage report..."
	@forge coverage --ir-minimum --report lcov --report summary
	@echo "Coverage report generated!"

# Clean build artifacts
clean:
	@echo "Cleaning cache and artifacts..."
	@rm -rf cache out artifacts coverage lcov.info
	@echo "Cleaned!"

# Clean everything (including Web UI)
clean-all: clean web-clean
	@echo "Everything cleaned!"

# Foundry installation
foundry-install:
	@echo "Installing Foundry..."
	@./scripts/install-foundry.sh

# OpenZeppelin Contracts installation
openzeppelin-install:
	@echo "Installing OpenZeppelin Contracts..."
	@./scripts/install-openzeppelin.sh

# Web UI installation
web-install:
	@echo "Installing Web UI dependencies..."
	@cd demo/web && npm install
	@echo "Web UI dependencies installed!"

# Web UI development server
web-dev:
	@echo "Starting Web UI development server..."
	@cd demo/web && \
	if [ ! -d "node_modules" ]; then \
		echo "Dependencies not found. Installing..." ; \
		npm install ; \
	fi && \
	npm run dev

# Web UI build for production
web-build:
	@echo "Building Web UI for production..."
	@cd demo/web && \
	if [ ! -d "node_modules" ]; then \
		echo "Dependencies not found. Installing..." ; \
		npm install ; \
	fi && \
	npm run build
	@echo "Web UI build completed!"

# Web UI start production server
web-start:
	@echo "Starting Web UI production server..."
	@cd demo/web && \
	if [ ! -d "node_modules" ]; then \
		echo "Dependencies not found. Installing..." ; \
		npm install ; \
	fi && \
	if [ ! -d ".next" ]; then \
		echo "Build not found. Building..." ; \
		npm run build ; \
	fi && \
	npm run start

# Web UI clean
web-clean:
	@echo "Cleaning Web UI node_modules and build artifacts..."
	@cd demo/web && rm -rf node_modules .next out package-lock.json
	@echo "Web UI cleaned!"
