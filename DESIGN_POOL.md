# Pool Protocol Design

## Overview

Pool Protocol is a **generalized composition layer** that aggregates multiple services into a single purchasable product. It enables two distinct membership models built on the same protocol foundation.

## Core Philosophy

**"One payment, multiple providers, deterministic settlement."**

Pool Protocol provides:
- **Product Catalog**: PoolRegistry manages pools as purchasable products
- **Composition Rules**: How services are aggregated (members, weights, pricing)
- **Settlement**: Deterministic revenue distribution to providers
- **Access Management**: Time-based entitlements for users

## Two Membership Models

### A) Payer Membership (User Subscription)
**What users buy**: Access rights to a set of services for a time period (all-you-can-eat)

- Users pay once → receive access to all services in the pool
- Access is time-limited (or permanent if duration = 0)
- Example: Medium membership, venue pass, software subscription bundle

**From user perspective**:
- Purchase pool access → use any service in pool during access period
- User = Access holder (NOT a pool member)

### B) Payee Membership (Provider Alliance)
**What providers join**: A supply-side alliance that shares revenue

- Multiple providers form a pool to offer combined services
- Pool handles revenue splitting based on weights/shares
- Providers earn proportional to their contribution
- Example: Creator alliance, equipment rental consortium, API provider network

**From provider perspective**:
- Join pool → receive revenue share from pool purchases
- Provider = Pool member (supply side)

## Architecture

```
┌─────────────────────────────────────────┐
│      Pool Protocol (Composition)        │
│  - PoolRegistry                         │
│  - Revenue Splitting                    │
│  - Access Management                    │
└─────────────┬───────────────────────────┘
              │ uses
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼──────┐    ┌──────▼──────┐
│ Articles │    │  Rentals    │
│ Module   │    │  Module     │
└──────────┘    └─────────────┘
    │                │
    └────────┬───────┘
             │ implement
    ┌────────▼────────┐
    │ IServiceRegistry│
    └─────────────────┘
```

### Key Principles

1. **Decoupling**: Modules (articles, rentals) don't know pools exist
2. **Interface-Based**: Pool interacts via `IServiceRegistry` interface
3. **Module Independence**: Each module handles its own domain logic:
   - Articles: publishing, content management
   - Rentals: availability, exclusivity, asset metadata
4. **Pool Focus**: Pool only handles:
   - Bundle/pool purchase
   - Revenue split
   - Access entitlement

## Pool Data Model

```solidity
struct Pool {
    uint256 poolId;
    address creator;          // Pool creator (not a provider)
    address operator;         // Manager who can modify members
    uint16 operatorFeeBps;    // Platform fee (e.g., 200 = 2%)
    uint16 affiliateFeeBps;   // Affiliate fee (e.g., 100 = 1%)
    uint256 totalShares;      // Sum of all member shares
    bool exists;
    bool paused;
    uint256 accessDuration;   // 0 = permanent, >0 = time-limited
}

struct Member {
    uint256 serviceId;        // Service ID in its registry
    address registry;         // Service registry (IServiceRegistry)
    uint256 shares;           // Weight for revenue split
    bool exists;
}
```

## Purchase Flow

1. User calls `purchasePool(poolId, affiliate)`
2. Calculate fees:
   - `operatorFee = price * operatorFeeBps / 10_000`
   - `affiliateFee = (affiliate != 0) ? price * affiliateFeeBps / 10_000 : 0`
   - `net = price - operatorFee - affiliateFee`
3. Distribute fees to operator and affiliate (if any)
4. Split net revenue among members based on shares:
   - `payout_i = net * shares_i / totalShares`
   - Remainder → first member (deterministic tie-breaker)
5. Update user access expiry (time-based or permanent)
6. Emit events for off-chain indexing

## Pricing Models (Future Extensions)

Current implementation: **SubscriptionPool** (pay once, get access for duration)

Future pricing models can be added:
- **PayPerUsePool**: Charge per usage (e.g., shared equipment usage metering)
- **CreditPool**: Buy credits, deduct per use (perfect for rentals with usage tracking)
- **TieredPool**: Different price tiers with different access levels

All models use the same underlying Pool infrastructure, just different payment/settlement logic.

## Membership Management (Policy A)

Current implementation: **Operator-Controlled Membership**

- Only pool creator/operator can add/remove members
- Only operator can modify shares
- Operator can pause pool (disables purchases)

Future policies can be added:
- **Policy B**: Provider can join/leave (permissioned by allowlist)
- **Policy C**: Permissionless (anyone can add services)

## Security & Constraints

- **MAX_MEMBERS_PER_POOL = 25**: Prevent gas griefing
- **Bounded loops**: O(n) operations are controlled
- **Deterministic rounding**: Remainder always goes to first member
- **Reentrancy protection**: All state changes before external calls
- **Access expiry monotonicity**: Renewals extend from current expiry if not expired

## Examples

### Example 1: Creator Alliance (Payee Membership)
Multiple writers form a pool:
- Writer A: 40% share
- Writer B: 35% share  
- Writer C: 25% share

Users buy pool access → all writers get revenue share

### Example 2: Venue + Equipment Bundle (Payer Membership)
A concert venue pool includes:
- Space rental (from Rentals module)
- Equipment rental (from Rentals module)
- Lighting setup (from Rentals module)

User buys pool access → can use all services for the duration

### Example 3: Cross-Module Pool
A premium content pool:
- Article 1 (from Articles module)
- Article 2 (from Articles module)
- Exclusive video rental (from Rentals module)

Pool aggregates services from different modules via IServiceRegistry interface.

## Design Decisions

1. **Service IDs vs Registry**: Each member stores `(serviceId, registry)` because:
   - Same serviceId can exist in different modules
   - Pool can aggregate services from different modules
   - Provider lookup happens at payout time (no duplication)

2. **Shares vs BPS**: Using shares (arbitrary positive integers) instead of BPS:
   - More flexible for dynamic join/leave
   - Total shares can change without normalization
   - Easier to reason about: "member has 2x the shares = 2x the revenue"

3. **Access Duration in Pool**: Stored at pool level because:
   - All users get same access duration when purchasing
   - Can be overridden per-user in future extensions
   - 0 = permanent access (useful for one-time purchase bundles)

4. **Fees Before Split**: Fees are deducted before splitting to members:
   - Members get net revenue (after platform/affiliate fees)
   - Fees are transparent and predictable
   - Platform can earn revenue without affecting member economics

