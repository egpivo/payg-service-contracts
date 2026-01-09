# Pool Protocol - Executable Specification (Foundry Tests)

This document serves as a **living specification** for the Pool Protocol. All specifications are encoded as Foundry tests, making them executable and always up-to-date.

## Philosophy: Tests as Executable Specs

- **Tests = Documentation**: Every test documents expected behavior
- **Tests = Contracts**: Tests enforce protocol guarantees
- **Tests = Examples**: Tests show how to use the protocol correctly

## Test Structure

### 1. Unit Tests (`PoolRegistry.t.sol`)
Core functionality and edge cases.

#### Pool Creation
- ✅ `test_createPool_success` - Basic pool creation with multiple members
- ✅ `test_createPool_duplicateIdReverts` - Idempotency guarantee
- ✅ `test_createPool_nonexistentServiceReverts` - Service validation
- ✅ `test_createPool_emptyMembersReverts` - Minimum member requirement

#### Pool Purchase
- ✅ `test_purchasePool_splitsCorrectly` - Revenue split accuracy
- ✅ `test_purchasePool_refundOverpay` - Overpayment handling
- ✅ `test_purchasePool_renewalExtendsExpiry` - Access renewal (non-expired)
- ✅ `test_purchasePool_expiredExtendsFromNow` - Access renewal (expired)
- ✅ `test_purchasePool_withFees` - Operator fee handling
- ✅ `test_purchasePool_noAffiliate` - No affiliate fee in v1
- ✅ `test_purchasePool_defensiveGuardEmptyPool` - Defensive guard

#### Member Management
- ✅ `test_addMember_updatesTotalShares` - Share tracking
- ✅ `test_removeMember_updatesTotalShares` - Share tracking
- ✅ `test_setShares_updatesTotalShares` - Share updates
- ✅ `test_onlyOperator_canModifyMembers` - Access control

#### Access Control
- ✅ `test_pausedPool_blocksPurchase` - Pause functionality
- ✅ `test_hasPoolAccess_validAccess` - Access verification

#### Events
- ✅ `test_eventsIncludeMemberKey` - Event structure verification

### 2. Cross-Registry Tests (`PoolRegistry.crossRegistry.t.sol`)
Proves universal composition layer capability.

#### Core Cross-Module Support
- ✅ `test_crossRegistry_sameServiceIdDifferentRegistries` - Same serviceId from different registries
- ✅ `test_crossRegistry_removeMemberDoesNotAffectOther` - Isolation guarantee
- ✅ `test_crossRegistry_setSharesDoesNotAffectOther` - Isolation guarantee
- ✅ `test_crossRegistry_duplicateCheckWorks` - Member uniqueness by (registry, serviceId)
- ✅ `test_crossRegistry_getPoolMembersDetailed` - Helper function
- ✅ `test_crossRegistry_eventsIncludeMemberKeyAndRegistry` - Event traceability

### 3. Split Invariant Tests (`PoolRegistry.split.invariant.t.sol`)
Revenue distribution correctness.

#### Core Invariants
- ✅ `testFuzz_SplitLibInvariant` - `sum(payouts) + remainder == netAmount`
- ✅ `testFuzz_TotalEarningsConservation` - `sum(earningsDelta) == required`
- ✅ `test_SplitExtremeShares` - Overflow protection with Math.mulDiv
- ✅ `test_SplitRemainderHandling` - Deterministic remainder allocation

### 4. SplitLib Fuzz Tests (`SplitLib.fuzz.t.sol`)
Library-level correctness.

- ✅ `testFuzz_SplitInvariant` - Core invariant across all inputs
- ✅ `testFuzz_RemainderBound` - Remainder bounds check
- ✅ `testFuzz_PayoutProportionality` - Share proportionality
- ✅ `testFuzz_EqualSharesEqualPayouts` - Equal share handling

### 5. Invariant Tests (`PoolRegistry.invariant.t.sol`)
Protocol-level invariants.

#### Invariants
- ✅ `invariant_ContractBalanceMatchesEarnings` - Balance consistency
- ✅ `invariant_TotalSharesMatchesMemberShares` - Share tracking consistency
- ✅ `invariant_AccessExpiryMonotonic` - Access expiry monotonicity

## Core Protocol Guarantees (Enforced by Tests)

### 1. Conservation: Total Credited Earnings == Net Revenue
```
sum(all earnings increases) == purchase price - fees
```
**Test**: `testFuzz_TotalEarningsConservation`

### 2. Deterministic Split: Same Inputs → Same Outputs
```
Given (netAmount, shares[], totalShares) → deterministic (payouts[], remainder)
```
**Test**: `testFuzz_SplitLibInvariant`

### 3. No Overpayment Leakage: Excess is Refunded
```
overpay → refund = msg.value - required
```
**Test**: `test_purchasePool_refundOverpay`

### 4. Access Monotonicity: Renew Extends from max(now, currentExpiry)
```
newExpiry = max(block.timestamp, currentExpiry) + duration
```
**Tests**: `test_purchasePool_renewalExtendsExpiry`, `test_purchasePool_expiredExtendsFromNow`

### 5. Cross-Module Isolation: Same serviceId from Different Registries
```
poolId can contain (registryA, serviceId=1) AND (registryB, serviceId=1)
These are distinct members with independent shares
```
**Test**: `test_crossRegistry_sameServiceIdDifferentRegistries`

### 6. Member Uniqueness: (registry, serviceId) is Unique Key
```
No two members with same (registry, serviceId) in same pool
memberKey = keccak256(abi.encode(registry, serviceId))
```
**Test**: `test_crossRegistry_duplicateCheckWorks`

### 7. Share Consistency: totalShares == sum(all member shares)
```
pool.totalShares always equals sum of all active member shares
```
**Test**: `invariant_TotalSharesMatchesMemberShares`

### 8. Defensive Guards: Pool Must Have Members
```
purchasePool reverts if pool has 0 members (edge case protection)
```
**Test**: `test_purchasePool_defensiveGuardEmptyPool`

## Running Tests

```bash
# All Pool Protocol tests
forge test --match-path "test/PoolRegistry*.t.sol"

# Specific test suite
forge test --match-path "test/PoolRegistry.t.sol"
forge test --match-path "test/PoolRegistry.crossRegistry.t.sol"
forge test --match-path "test/PoolRegistry.split.invariant.t.sol"

# Invariant tests (longer run)
forge test --match-path "test/PoolRegistry.invariant.t.sol" --invariant
```

## Test Coverage Summary

- **Unit Tests**: 17 tests covering all core functions
- **Cross-Registry Tests**: 6 tests proving universal composition
- **Split Invariant Tests**: 4 tests ensuring revenue correctness
- **SplitLib Fuzz Tests**: 4 tests covering library edge cases
- **Invariant Tests**: 3 protocol-level invariants

**Total**: ~34 executable specifications

## Reading Tests as Documentation

Each test function name describes the guarantee it enforces:

- `test_purchasePool_splitsCorrectly` → "Purchase pool splits revenue correctly"
- `test_crossRegistry_sameServiceIdDifferentRegistries` → "Pool supports same serviceId from different registries"
- `invariant_TotalSharesMatchesMemberShares` → "Total shares always equals sum of member shares"

Read the tests to understand:
1. **What** the protocol does (function names)
2. **How** it works (test implementation)
3. **Why** it's correct (assertions and invariants)








