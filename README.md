# Pay-as-You-Go Service Contracts
[![CI](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/egpivo/payg-service-contracts/graph/badge.svg?token=Svpf1dEEyh)](https://codecov.io/gh/egpivo/payg-service-contracts)

A Solidity base contract for pay-as-you-go services with example implementations.

## Architecture

### Core Layer
- **PayAsYouGoBase** - Base contract with core pay-per-use functionality
- **AccessLib** - Library for managing time-based access expiry

### Article Module
- **ArticlePayPerRead** - Pay-per-read article service (gas efficient, no storage writes)
- **ArticleSubscription** - Subscription-based article service (purchase once, read multiple times)
- **ArticleBundle** - Bundle multiple articles with a single payment

### Rental Module
- **RentalBase** - Base contract for rental services (asset metadata, availability, exclusivity)
- **SpacePayPerUse** - Pay-per-use space rental (provider-controlled duration)
- **SpaceSubscription** - Subscription-based space rental with security deposits
- **EquipmentPayPerUse** - Pay-per-use equipment rental (exclusive or non-exclusive)
- **DigitalPayPerUse** - Pay-per-use digital services (quantity-based billing)
- **DigitalSubscription** - Subscription-based digital services (credit-based or time-based)
- **RentalBundle** - Bundle multiple rental services with revenue sharing

## Features
- Register a service with an ID and price  
- Users pay to use a service  
- Providers withdraw the ETH they earn  

## Contracts

### PayAsYouGoBase
Base contract providing core functionality:
- `registerService(id, price)` - Register a new service
- `useService(id)` - Pay to use a service (payable)
- `withdraw()` - Withdraw accumulated earnings

### ArticlePayPerRead
Pay-per-read pattern (gas efficient):
- `publishArticle(id, price, title, contentHash)` - Publish an article
- `readArticle(id)` - Pay to read an article (payable)
- No accessExpiry storage writes (saves gas)
- Tracking via events for off-chain analytics

### ArticleSubscription
Subscription pattern (purchase once, read multiple):
- `publishArticle(id, price, title, contentHash, accessDuration)` - Publish an article
- `purchaseArticle(id)` - Purchase access (payable, sets expiry)
- `readArticle(id)` - Read after purchase (no payment, checks access)
- `hasValidAccess(user, articleId)` - Check if user has valid access

### SpacePayPerUse
Pay-per-use space rental (provider-controlled exclusivity duration):
- `listSpace(id, price, name, description, assetHash, defaultUsageDuration)` - List a space
- `useSpace(id)` - Pay to use the space (payable, provider-controlled duration)
- Exclusive spaces prevent concurrent usage during the duration

### SpaceSubscription
Subscription-based space rental with security deposits:
- `listSpace(id, price, name, description, assetHash, accessDuration, deposit)` - List a space
- `rentSpace(id)` - Rent the space (payable, deposit charged once per renter)
- `useSpace(id)` - Use the space after renting (no payment, checks access)
- `updateSpaceSettings(id, accessDuration, deposit)` - Update deposit and duration (provider only)
- `returnDeposit(id, renter)` - Return security deposit (provider only)
- Deposit is charged once per renter; only difference charged if requirement increases

### EquipmentPayPerUse
Pay-per-use equipment rental (exclusive or non-exclusive):
- `listEquipment(id, price, name, description, assetHash, exclusive, defaultUsageDuration)` - List equipment
- `useEquipment(id)` - Pay to use the equipment (payable)
- Supports both exclusive (physical) and non-exclusive (shared) equipment

### DigitalPayPerUse
Pay-per-use digital services with quantity-based billing:
- `listDigitalService(id, price, name, description, assetHash, pricePerUnit, unitName)` - List a digital service
- `useDigitalService(id, quantity)` - Pay to use the service (payable, charges per unit)
- Example: GPU hours, API credits, compute time

### DigitalSubscription
Subscription-based digital services (credit-based or time-based):
- `listDigitalService(id, price, name, description, assetHash, subType, pricePerCredit, accessDuration)` - List a digital service
- `subscribeToService(id)` - Subscribe to the service (payable)
- `useDigitalService(id, quantity)` - Use the service (consumes credits or checks time-based access)
- Supports credit-based (consumes credits) and time-based (access window) subscriptions

## Development

This project uses [Foundry](https://book.getfoundry.sh/) for development, testing, and compilation.

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - Install using `./scripts/install-foundry.sh` or `make foundry-install`

### Setup
```bash
# Install Foundry
make foundry-install

# Install OpenZeppelin Contracts
make openzeppelin-install

# Or use npm scripts
npm run foundry:install
npm run openzeppelin:install
```

### Usage
```bash
# Compile contracts
forge build
# or
make compile

# Run tests
forge test
# or
make test

# Run tests with verbose output
forge test -vv
# or
make test-verbose

# Run tests with gas report
forge test --gas-report
# or
make test-gas

# Generate coverage report
forge coverage --ir-minimum --report lcov --report summary
# or
make coverage
```

## Example

### Pay-per-Read Pattern
```solidity
ArticlePayPerRead articles = new ArticlePayPerRead();
articles.publishArticle(1, 0.001 ether, "Title", keccak256("content"));
articles.readArticle{value: 0.001 ether}(1); // Pay each time
```

### Subscription Pattern
```solidity
ArticleSubscription articles = new ArticleSubscription();
articles.publishArticle(1, 0.001 ether, "Title", keccak256("content"), 2 days);
articles.purchaseArticle{value: 0.001 ether}(1); // Purchase once
articles.readArticle(1); // Read multiple times (no payment)
```

### Space Rental (Pay-per-Use)
```solidity
SpacePayPerUse spaces = new SpacePayPerUse();
spaces.listSpace(1, 0.01 ether, "Conference Room A", "Description", keccak256("metadata"), 1 hours);
spaces.useSpace{value: 0.01 ether}(1); // Pay each time, provider controls duration
```

### Space Rental (Subscription with Deposit)
```solidity
SpaceSubscription spaces = new SpaceSubscription();
spaces.listSpace(1, 0.01 ether, "Office Space", "Description", keccak256("metadata"), 30 days, 0.1 ether);
spaces.rentSpace{value: 0.11 ether}(1); // Rent once (price + deposit)
spaces.useSpace(1); // Use multiple times (no payment)
// Deposit charged once; only difference charged if requirement increases on renewal
```

### Digital Service (Quantity-Based)
```solidity
DigitalPayPerUse digital = new DigitalPayPerUse();
digital.listDigitalService(1, 0, "GPU Compute", "Description", keccak256("metadata"), 0.001 ether, "hour");
digital.useDigitalService{value: 0.01 ether}(1, 10); // Pay for 10 GPU hours
```

### Digital Service (Credit-Based Subscription)
```solidity
DigitalSubscription digital = new DigitalSubscription();
digital.listDigitalService(1, 0.1 ether, "API Service", "Description", keccak256("metadata"), 
    DigitalSubscription.SubscriptionType.CreditBased, 0.01 ether, 0);
digital.subscribeToService{value: 0.1 ether}(1); // Get 10 credits
digital.useDigitalService(1, 3); // Consume 3 credits
```

MIT License
