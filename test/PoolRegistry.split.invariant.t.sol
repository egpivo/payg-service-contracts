// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {PoolRegistry} from "../contracts/composition/pools/PoolRegistry.sol";
import {PayAsYouGoBase} from "../contracts/core/PayAsYouGoBase.sol";
import {SplitLib} from "../contracts/composition/pools/SplitLib.sol";

/**
 * @title PoolRegistrySplitInvariantTest
 * @dev Invariant tests for revenue split calculations
 * 
 * Tests critical invariants:
 * 1. sum(payouts) + remainder == netAmount (SplitLib invariant)
 * 2. sum(earningsDelta) == required (total payment conservation)
 */
contract PoolRegistrySplitInvariantTest is Test {
    PoolRegistry public poolRegistry;
    
    address public provider1;
    address public provider2;
    address public provider3;
    address public buyer;
    address public operator;
    
    uint256 public poolId = 100;
    
    function setUp() public {
        provider1 = address(0x1001);
        provider2 = address(0x1002);
        provider3 = address(0x1003);
        buyer = address(0x2001);
        operator = address(0x3001);
        
        vm.deal(provider1, 10 ether);
        vm.deal(provider2, 10 ether);
        vm.deal(provider3, 10 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(operator, 10 ether);
        
        poolRegistry = new PoolRegistry();
    }
    
    /**
     * @dev Fuzz test: SplitLib invariant - sum(payouts) + remainder == netAmount
     */
    function testFuzz_SplitLibInvariant(
        uint256 netAmount,
        uint256 share1,
        uint256 share2,
        uint256 share3
    ) public {
        // Bound inputs to reasonable ranges
        netAmount = bound(netAmount, 1, 1000 ether);
        share1 = bound(share1, 1, 1000000);
        share2 = bound(share2, 1, 1000000);
        share3 = bound(share3, 1, 1000000);
        
        uint256 totalShares = share1 + share2 + share3;
        
        uint256[] memory memberShares = new uint256[](3);
        memberShares[0] = share1;
        memberShares[1] = share2;
        memberShares[2] = share3;
        
        (uint256[] memory payouts, uint256 remainder) = SplitLib.calculateSplits(
            netAmount,
            memberShares,
            totalShares
        );
        
        // Invariant: sum(payouts) + remainder == netAmount
        uint256 sumPayouts = payouts[0] + payouts[1] + payouts[2];
        assertEq(sumPayouts + remainder, netAmount, "SplitLib invariant violated: sum(payouts) + remainder != netAmount");
    }
    
    /**
     * @dev Fuzz test: Total earnings conservation - sum(earningsDelta) == required
     */
    function testFuzz_TotalEarningsConservation(
        uint256 poolPrice,
        uint16 operatorFeeBps,
        uint256 share1,
        uint256 share2,
        uint256 share3
    ) public {
        // Bound inputs
        poolPrice = bound(poolPrice, 0.001 ether, 100 ether);
        operatorFeeBps = uint16(bound(uint256(operatorFeeBps), 0, 10000)); // 0-100%
        share1 = bound(share1, 1, 1000000);
        share2 = bound(share2, 1, 1000000);
        share3 = bound(share3, 1, 1000000);
        
        // Create services
        vm.prank(provider1);
        poolRegistry.registerService(1, 0.001 ether);
        
        vm.prank(provider2);
        poolRegistry.registerService(2, 0.001 ether);
        
        vm.prank(provider3);
        poolRegistry.registerService(3, 0.001 ether);
        
        // Create pool
        uint256[] memory serviceIds = new uint256[](3);
        serviceIds[0] = 1;
        serviceIds[1] = 2;
        serviceIds[2] = 3;
        
        address[] memory registries = new address[](3);
        registries[0] = address(poolRegistry);
        registries[1] = address(poolRegistry);
        registries[2] = address(poolRegistry);
        
        uint256[] memory shares = new uint256[](3);
        shares[0] = share1;
        shares[1] = share2;
        shares[2] = share3;
        
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0, // permanent access
            operatorFeeBps
        );
        
        // Record earnings before purchase
        uint256 earnings1Before = poolRegistry.earnings(provider1);
        uint256 earnings2Before = poolRegistry.earnings(provider2);
        uint256 earnings3Before = poolRegistry.earnings(provider3);
        uint256 operatorEarningsBefore = poolRegistry.earnings(operator);
        
        // Purchase pool
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // Calculate earnings deltas
        uint256 earnings1Delta = poolRegistry.earnings(provider1) - earnings1Before;
        uint256 earnings2Delta = poolRegistry.earnings(provider2) - earnings2Before;
        uint256 earnings3Delta = poolRegistry.earnings(provider3) - earnings3Before;
        uint256 operatorEarningsDelta = poolRegistry.earnings(operator) - operatorEarningsBefore;
        
        // Invariant: sum(earningsDelta) == required (poolPrice)
        uint256 totalEarningsDelta = earnings1Delta + earnings2Delta + earnings3Delta + operatorEarningsDelta;
        assertEq(totalEarningsDelta, poolPrice, "Total earnings conservation violated: sum(earningsDelta) != required");
    }
    
    /**
     * @dev Test: Split with extreme values (very large shares)
     */
    function test_SplitExtremeShares() public {
        uint256 netAmount = 1000 ether;
        uint256[] memory memberShares = new uint256[](2);
        memberShares[0] = 1e30; // Very large share
        memberShares[1] = 1e30;
        
        uint256 totalShares = memberShares[0] + memberShares[1];
        
        // Should not overflow with Math.mulDiv
        (uint256[] memory payouts, uint256 remainder) = SplitLib.calculateSplits(
            netAmount,
            memberShares,
            totalShares
        );
        
        // Invariant should still hold
        uint256 sumPayouts = payouts[0] + payouts[1];
        assertEq(sumPayouts + remainder, netAmount);
        
        // Each should get ~50%
        assertApproxEqAbs(payouts[0], netAmount / 2, 1 wei);
        assertApproxEqAbs(payouts[1], netAmount / 2, 1 wei);
    }
    
    /**
     * @dev Test: Split with remainder handling
     */
    function test_SplitRemainderHandling() public {
        // Use values that guarantee remainder
        uint256 netAmount = 1001; // Odd number
        uint256[] memory memberShares = new uint256[](3);
        memberShares[0] = 1;
        memberShares[1] = 1;
        memberShares[2] = 1;
        
        uint256 totalShares = 3;
        
        (uint256[] memory payouts, uint256 remainder) = SplitLib.calculateSplits(
            netAmount,
            memberShares,
            totalShares
        );
        
        // Each gets 333, remainder is 2
        assertEq(payouts[0], 333);
        assertEq(payouts[1], 333);
        assertEq(payouts[2], 333);
        assertEq(remainder, 2);
        
        // Invariant holds
        assertEq(payouts[0] + payouts[1] + payouts[2] + remainder, netAmount);
    }
}

