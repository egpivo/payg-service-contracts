# Concrete Example: Private Gallery Access

This document describes the concrete example used in the Web UI demo, demonstrating a real-world use case for cross-registry service composition.

## The Private Gallery Story

**Real World:**
- A premium but accessible space (luxury hotel spaces in cities, private viewing rooms) — prestigious but not unaffordable
- Features rare/precious content (exclusive art collections, historical artifacts, valuable collectibles)
- Requires infrastructure: premium venue space (hotel spaces rented by service providers), security services
- Users pay once for complete access package
- Revenue splits across art collection provider and infrastructure providers (hotel space provider, security service provider)

**On-Chain:**
- Art Collection/Content = Service (ArticleRegistry) - e.g., rare art collections, precious items
- Infrastructure = Services (RentalRegistry: hotel spaces in cities, security services)
- Gallery Package = Pool (bundles all services)
- Package Purchase = Pool purchase
- Providers = Revenue recipients (art collection owners, hotel space providers, security service providers)

## Example: Private Gallery Access (Cross-Registry Composition)

**Scenario:** Rare art collections accessed in premium hotel spaces — service providers help rent luxury hotel spaces in cities, combined with premium security services for displaying precious items

```solidity
Pool ID: 42
Price: 1 ETH
Duration: 7 days (604800 seconds)
Operator Fee: 2% (200 basis points)

Members:
- Article #101 (Rare Art Collection, ArticleRegistry): 3 shares
- Rental #201 (Luxury Hotel Space, RentalRegistry): 2 shares  
- Rental #202 (Premium Security Service, RentalRegistry): 1 share
```

**Why This Makes Sense:**
- Rare art collections and precious items require premium spaces to be properly displayed and appreciated
- Luxury hotel spaces in cities can be rented by service providers, offering prestigious but accessible venues
- Service providers help connect art collection owners with hotel space owners, creating a marketplace
- Premium security services are essential for protecting valuable collections
- Demonstrates cross-registry composition: art collections (ArticleRegistry) + hotel spaces (RentalRegistry) + security (RentalRegistry)
- Shows how different service types compose together seamlessly in a real-world scenario

**Settlement Breakdown:**
- Total price: 1 ETH
- Operator fee (2%): 0.02 ETH
- Net revenue: 0.98 ETH
- Total shares: 6 (3 + 2 + 1)

**Distribution:**
- Art Collection Provider: ~0.49 ETH (3/6 of net = 50%)
- Hotel Space Provider: ~0.327 ETH (2/6 of net ≈ 33.3%)
- Security Service Provider: ~0.163 ETH (1/6 of net ≈ 16.7%)
- Remainder: Goes to Art Collection Provider (first member)

**Revenue Split Visualization:**
```
Total: 1.0 ETH
  ├─ Operator (2%): 0.02 ETH
  └─ Net: 0.98 ETH
      ├─ Art Collection Provider (50%): 0.49 ETH
      ├─ Hotel Space Provider (33.3%): 0.327 ETH
      └─ Security Service Provider (16.7%): 0.163 ETH
```

## Story Flow

1. **Define Product** (CreatePool)
   - "Private Gallery Access" scenario demonstrates cross-registry composition
   - Shows how precious content (ArticleRegistry) needs infrastructure (RentalRegistry: venue, security)
   - Demonstrates revenue split configuration across different service types

2. **Buy Product** (PurchasePool)
   - User pays once (1 ETH) for complete access package
   - See price breakdown: Total → Operator Fee → Net Revenue
   - Understand that settlement happens atomically across all providers

3. **Observe System** (InspectPool)
   - See revenue split visualization
   - Understand which provider gets which share (content provider vs infrastructure providers)
   - View access status (7 days)
   - See protocol invariants (total shares = sum of member shares)

## Educational Value

This concrete example makes the protocol relatable and demonstrates real-world value:

- **Realistic scenario:** Premium content needs a suitable space — private galleries are prestigious but accessible (not unaffordable like museums)
- **Cross-registry composition:** Content (ArticleRegistry) + Infrastructure (RentalRegistry: venue, security)
- **Clear separation:** Content (precious/unique) vs Infrastructure (reusable services)
- **Demonstrates composition:** Multiple service types → one checkout
- **Revenue sharing:** Different providers receive shares based on their contribution

## Using the Example in UI

### Private Gallery Access Demo
- Pre-fills Pool ID: 42
- Price: 1 ETH
- Duration: 7 days (604800 seconds)
- Operator Fee: 2% (200 bps)
- Members: 
  - Rare Art Collection (ArticleRegistry): 3 shares
  - Luxury Hotel Space (RentalRegistry): 2 shares
  - Premium Security Service (RentalRegistry): 1 share

## Testing the Example

After loading the example:

1. **Verify Pool Creation:**
   - Pool ID should be 42
   - Price should be 1 ETH
   - Duration should be 7 days
   - 3 members with shares [3, 2, 1] from 2 different registries

2. **Purchase Pool:**
   - Pay 1 ETH
   - See breakdown: 0.02 ETH operator fee, 0.98 ETH net revenue
   - Settlement happens atomically across all providers

3. **Inspect Pool:**
   - See revenue split: Art Collection Provider (50%), Hotel Space Provider (33.3%), Security Service Provider (16.7%)
   - Verify total shares = 6 (3 + 2 + 1)
   - Check access expiry (should be ~7 days from purchase)
   - Understand cross-registry composition

## Future Enhancements

Potential additions based on the story:

1. **Dynamic Membership:**
   - Show how infrastructure providers can join/leave over time
   - Demonstrate `addMember` and `removeMember` operations

2. **Usage Gating:**
   - Show how modules check `hasPoolAccess` before allowing usage
   - Demonstrate the separation: Pool (access) vs Module (usage logic)

3. **Renewal Behavior:**
   - Show renewal extending from current expiry (no time lost)
   - Compare with expired access renewal (fresh start)

4. **Multiple Artifacts:**
   - Show how multiple artifacts can share the same infrastructure
   - Demonstrate cost efficiency of pooling infrastructure
