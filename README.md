# Pay-as-You-Go Service Contracts

A minimal Solidity contract demonstrating a simple pay‑per‑use payment model.  
Providers register services; users pay to use them; providers withdraw earnings.

## Core Concepts
- Register a service with an ID and price  
- Pay once to use a service (`usageCount` increases)  
- Provider withdraws accumulated earnings  

## Contract
Located at `contracts/PayAsYouGo.sol`.  
Includes:
- `registerService(id, price)`
- `useService(id)` (payable)
- `withdraw()`

## Project Structure
```
payg-service-contracts/
├── contracts/
├── scripts/
├── test/
└── hardhat.config.js
```

## Quick Start
```
npm install
npm run compile
npm test
npm run deploy
```

## Example
```solidity
payAsYouGo.registerService(1, 0.001 ether);
payAsYouGo.useService{value: 0.001 ether}(1);
payAsYouGo.withdraw();
```

## License
MIT
