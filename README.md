# Pay-as-You-Go Service Contracts
[![CI](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/egpivo/payg-service-contracts/graph/badge.svg?token=Svpf1dEEyh)](https://codecov.io/gh/egpivo/payg-service-contracts)

A Solidity base contract for pay-as-you-go services with example implementations.

## Architecture

### Core Layer
- **PayAsYouGoBase** - Core pay-per-use functionality
- **AccessLib** - Time-based access expiry helpers

### Article Module
- **ArticlePayPerRead** - Pay-per-read
- **ArticleSubscription** - Subscription access
- **ArticleBundle** - Bundled access

### Rental Module
- **RentalBase** - Asset metadata, availability, exclusivity
- **SpacePayPerUse** - Pay-per-use, provider-controlled duration
- **SpaceSubscription** - Subscription with security deposits
- **EquipmentPayPerUse** - Exclusive or non-exclusive equipment
- **DigitalPayPerUse** - Quantity-based billing
- **DigitalSubscription** - Credit-based or time-based
- **RentalBundle** - Bundled rentals with revenue sharing

### Composition Layer
- **PoolRegistry** - Universal pool protocol for cross-module service aggregation
  - **Payer Membership**: Users buy access to multiple services (all-you-can-eat)
  - **Payee Membership**: Providers form alliances with revenue sharing
  - Works with any service type via IServiceRegistry interface
  - Supports weighted revenue splitting, fees (operator/affiliate), and access management

## Features
- Register a service with an ID and price
- Users pay to use a service
- Providers withdraw their earnings

## Development

This project uses [Foundry](https://book.getfoundry.sh/) for development, testing, and compilation.

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - Install using `./scripts/install-foundry.sh` or `make foundry-install`

### Setup
```bash
make foundry-install
make openzeppelin-install
npm run foundry:install
npm run openzeppelin:install
```

### Usage
```bash
forge build
make compile

forge test
make test

forge test -vv
make test-verbose

forge test --gas-report
make test-gas

forge coverage --ir-minimum --report lcov --report summary
make coverage
```

MIT License
