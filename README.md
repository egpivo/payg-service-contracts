# Pay-as-You-Go Service Contracts

[![Coverage Status](https://codecov.io/gh/egpivo/payg-service-contracts/branch/main/graph/badge.svg)](https://codecov.io/gh/egpivo/payg-service-contracts)

A Solidity base contract for pay-as-you-go services with example implementations.

## Architecture

- **PayAsYouGoBase** - Base contract with core pay-per-use functionality
- **ArticleSubscription** - Example service implementation for article subscriptions

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

### ArticleSubscription
Example implementation extending PayAsYouGoBase:
- `publishArticle(id, price, title, contentHash)` - Publish an article
- `readArticle(id)` - Pay to read an article
- `userHasRead(user, articleId)` - Check if user has read an article

## Usage
```
npm install
npm run compile
npm test
npm run deploy
```

## Code Quality

This project uses Prettier for formatting and ESLint/Solhint for linting.

### Formatting

```bash
# Format all files
npm run format
# or
make format

# Check formatting without changing files
npm run format:check
```

### Linting

```bash
# Lint JavaScript files
npm run lint

# Lint Solidity files
npm run lint:sol

# Fix auto-fixable linting issues
npm run lint:fix

# Run all linting
make lint
```

Pre-commit hooks automatically format staged files before each commit.

## Example
```solidity
// Using base contract
PayAsYouGoBase service = new PayAsYouGoBase();
service.registerService(1, 0.001 ether);
service.useService{value: 0.001 ether}(1);
service.withdraw();

// Using ArticleSubscription
ArticleSubscription articles = new ArticleSubscription();
articles.publishArticle(1, 0.001 ether, "Title", keccak256("content"));
articles.readArticle{value: 0.001 ether}(1);
```

MIT License
