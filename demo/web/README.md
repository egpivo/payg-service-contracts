# PAYG Pool Protocol - Web Demo

Minimal Web UI demonstration for the PAYG Pool Protocol.

## Features

This demo implements three core interactions:

1. **Create Pool** - Create a new pool with multiple service members
2. **Purchase Pool** - Purchase access to a pool
3. **Inspect Earnings / Access** - View earnings and access expiry

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update contract addresses in `../contracts.json`

3. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the demo.

## Architecture

- **Next.js** - React framework
- **wagmi** - Ethereum React hooks
- **viem** - TypeScript Ethereum library
- **TypeScript** - Type safety

## Note

This is a **demo/example** implementation, not a production application.







