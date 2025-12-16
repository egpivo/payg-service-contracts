.PHONY: help install compile test coverage clean foundry-install openzeppelin-install test-verbose test-gas

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

# Foundry installation
foundry-install:
	@echo "Installing Foundry..."
	@./scripts/install-foundry.sh

# OpenZeppelin Contracts installation
openzeppelin-install:
	@echo "Installing OpenZeppelin Contracts..."
	@./scripts/install-openzeppelin.sh
