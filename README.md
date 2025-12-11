# Pay-as-You-Go Service Contracts
[![CI](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/egpivo/payg-service-contracts/graph/badge.svg?token=Svpf1dEEyh)](https://codecov.io/gh/egpivo/payg-service-contracts)

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
