# Pay-as-You-Go Service Contracts
[![CI](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/egpivo/payg-service-contracts/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/egpivo/payg-service-contracts/graph/badge.svg?token=Svpf1dEEyh)](https://codecov.io/gh/egpivo/payg-service-contracts)

A Solidity base contract for pay-as-you-go services with example implementations.

## Architecture

- **PayAsYouGoBase** - Base contract with core pay-per-use functionality
- **ArticlePayPerRead** - Pay-per-read article service (gas efficient, no storage writes)
- **ArticleSubscription** - Subscription-based article service (purchase once, read multiple times)

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

## Usage
```
npm install
npm run compile
npm test
npm run deploy
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

MIT License
