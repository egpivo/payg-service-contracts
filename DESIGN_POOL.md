# Pool Protocol Design

## Overview

Pool Protocol is a **generalized composition layer** that aggregates multiple services into a single purchasable product.

**Core Philosophy**: "One payment, multiple providers, deterministic settlement."

**Boundary**: Pool handles bundle/pool purchase, revenue split, and access entitlement. Domain-specific logic (availability, exclusivity, content management) remains in service modules. For rentals, pool access grants eligibility to rent, but availability/exclusivity checks remain in the rental module. A pool purchase does not bypass slot management.

## Two Membership Models

### A) Payer Membership (User Subscription)
**What users buy**: Access rights to a set of services for a time period (all-you-can-eat)
- Users pay once → receive access to all services in pool
- Access is time-limited (or permanent if duration = 0)
- User = Access holder (NOT a pool member)

### B) Payee Membership (Provider Alliance)
**What providers join**: A supply-side alliance that shares revenue
- Multiple providers form a pool to offer combined services
- Pool handles revenue splitting based on weights/shares
- Provider = Pool member (supply side)

Both models are built on the same Pool Protocol foundation.

## Interface

### IServiceRegistry (Minimal Interface)

Pool only needs three things from services:
1. Provider address (who gets paid)
2. Price (for display/validation, not used in pool pricing)
3. Existence check (validation)

```solidity
interface IServiceRegistry {
    function getService(uint256 serviceId)
        external
        view
        returns (
            uint256 price,
            address provider,
            bool exists
        );
}
```

**Key Point**: Pool doesn't need usageCount or other domain-specific data. Services can implement richer interfaces for their own needs, but Pool only requires this minimal surface.

## Data Model (v1 - MVP)

### Pool Structure

```solidity
struct Pool {
    uint256 poolId;
    address operator;         // Manager who controls membership (creator becomes operator)
    uint16 operatorFeeBps;    // Platform fee (e.g., 200 = 2%)
    uint256 totalShares;      // Sum of all member shares
    uint256 price;            // Pool purchase price (fixed, set at creation)
    uint256 accessDuration;   // 0 = permanent, >0 = time-limited
    bool exists;
    bool paused;
}

struct Member {
    uint256 serviceId;        // Service ID in its registry
    address registry;         // Service registry (IServiceRegistry)
    uint256 shares;           // Weight for revenue split
    bool exists;
}
```

### v1 Simplifications

- **Operator only**: creator and operator are the same (operator = creator at creation)
- **Affiliate tracking**: Can emit affiliate events but no fee collection in v1
- **Fixed price model**: Pool has its own fixed price (independent of member prices)
  - Member service prices are for display/validation only
  - Pool.price is set at creation and doesn't change with membership

## Purchase Flow (v1 - SubscriptionPool Only)

**v1 implements SubscriptionPool only. Other pricing models are explicitly out of scope.**

1. User calls `purchasePool(poolId, affiliate)` with `msg.value >= pool.price`
2. Calculate fees:
   - `operatorFee = pool.price * operatorFeeBps / 10_000`
   - `net = pool.price - operatorFee`
3. Credit fees to operator via `earnings[operator] += operatorFee`
   - **No direct transfers**: All payouts go through earnings accounting
   - Payees call `withdraw()` themselves (matches PayAsYouGoBase pattern)
4. Split net revenue among members:
   - For each member: `payout_i = net * shares_i / totalShares`
   - Remainder (due to rounding) → first member
   - Credit to provider via `earnings[provider] += payout_i`
5. Update user access expiry:
   - If `currentExpiry > now && currentExpiry > 0`: extend from current
   - Otherwise: start from now
   - If `duration == 0`: expiry = max(uint256) (permanent)
6. Emit events (including affiliate if provided, but no fee)
7. Refund excess payment if `msg.value > pool.price`

## Core Invariants

These invariants must hold for all operations:

1. **Conservation**: `sum(all credited earnings) == net revenue (price - fees)`
   - Every wei is accounted for: operator fee + all member payouts + remainder
   - Invariant: `operatorFee + sum(memberPayouts) + remainder == net`

2. **Deterministic Split**: Same inputs → same payouts
   - Given `(net, shares[], totalShares)`, payouts are deterministic
   - Remainder allocation is deterministic (always first member)

3. **No Overpayment Leakage**: Excess is refunded or credited deterministically
   - If `msg.value > pool.price`: refund `msg.value - pool.price`
   - Pool contract balance == total unwithdrawn earnings (modulo refunds in flight)

4. **Access Monotonicity**: Renewals extend from `max(now, currentExpiry)`
   - Access expiry never decreases: `newExpiry >= oldExpiry`
   - Expired access starts from now, active access extends from current

## Security

### Payment Flow
- **All payouts via earnings accounting**: No direct transfers during purchase
- Payees withdraw via `withdraw()` (inherited from PayAsYouGoBase)
- Prevents reentrancy and failed transfer rollbacks

### Constraints
- **MAX_MEMBERS_PER_POOL = 25**: Prevent gas griefing in loops
- **Reentrancy protection**: All state changes before external calls (CEI pattern)
- **Bounded operations**: O(n) loops are controlled by member count limit

### Access Boundary
- Pool purchase grants access eligibility, not guaranteed usage
- Service modules enforce their own rules (availability, exclusivity, capacity)
- Pool doesn't bypass service-level constraints

## Architecture

```
┌─────────────────────────────────────────┐
│      Pool Protocol (Composition)        │
│  - Purchase & Payment                   │
│  - Revenue Splitting                    │
│  - Access Management                    │
└─────────────┬───────────────────────────┘
              │ uses IServiceRegistry
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
    │ IServiceRegistry│ (minimal)
    └─────────────────┘
```

### Key Principles

1. **Decoupling**: Modules don't know pools exist
2. **Interface-Based**: Pool interacts via minimal `IServiceRegistry`
3. **Module Independence**: Each module handles its own domain logic
4. **Pool Focus**: Pool only handles purchase, split, entitlement

## Examples

### Example 1: Creator Alliance (Payee Membership)
Pool with 3 writers:
- Writer A: 40% share (shares = 4)
- Writer B: 35% share (shares = 3.5 → use 7/20)
- Writer C: 25% share (shares = 2.5 → use 5/20)
- Pool price: 0.01 ETH (independent of individual article prices)
- Operator fee: 2% → 0.0002 ETH
- Net: 0.0098 ETH split by shares

### Example 2: Venue + Equipment Bundle (Payer Membership)
Pool includes:
- Space rental (from Rentals module, serviceId = 100)
- Equipment rental (from Rentals module, serviceId = 200)
- Lighting setup (from Rentals module, serviceId = 300)
- Pool price: 0.1 ETH
- Access duration: 7 days

User buys pool → eligible to rent all services for 7 days (subject to availability)

### Example 3: Cross-Module Pool
Pool aggregates:
- Article 1 (Articles module, registry = ArticlePayPerRead address)
- Article 2 (Articles module, registry = ArticlePayPerRead address)
- Video rental (Rentals module, registry = RentalPayPerUse address)

Different registries for different service types.

## Out of Scope (v1)

These are explicitly NOT in v1:

1. **Pricing Models**: Only SubscriptionPool
   - ❌ PayPerUsePool
   - ❌ CreditPool
   - ❌ TieredPool

2. **Membership Policies**: Only Policy A (operator-controlled)
   - ❌ Policy B: Provider self-join/leave
   - ❌ Policy C: Permissionless

3. **Dynamic Pricing**: Pool price is fixed at creation
   - ❌ Price changes based on membership
   - ❌ Dynamic discounts
   - ❌ Price = sum(member prices) * discount

4. **Affiliate Fees**: Tracking only, no fee collection
   - ❌ Affiliate fee deduction
   - ✅ Affiliate events for future use

5. **Advanced Features**:
   - ❌ Pool-to-pool nesting
   - ❌ Conditional access rules
   - ❌ Usage metering within pool

## Future Extensions

These can be added in future versions without breaking v1:

- **Additional Pricing Models**: PayPerUsePool, CreditPool, etc.
- **Membership Policies**: Provider self-join, permissionless pools
- **Dynamic Pricing**: Discount-based, membership-based pricing
- **Affiliate Fees**: Full affiliate fee support
- **Nested Pools**: Pools containing other pools
