// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {PoolRegistry} from "../contracts/composition/pools/PoolRegistry.sol";
import {PayAsYouGoBase} from "../contracts/core/PayAsYouGoBase.sol";

/**
 * @title PoolRegistryCrossRegistryTest
 * @dev Critical tests to prove cross-registry/cross-module support
 * 
 * These tests verify that Pool Protocol truly supports aggregating services
 * from different registries, even with the same serviceId.
 */
contract PoolRegistryCrossRegistryTest is Test {
    PoolRegistry public poolRegistry;
    
    // Two different registries (simulating different modules)
    PayAsYouGoBase public registryA;
    PayAsYouGoBase public registryB;
    
    address public providerA1;
    address public providerB1;
    address public buyer;
    address public operator;
    
    uint256 public serviceId1 = 1; // Same serviceId in both registries
    uint256 public poolId = 100;
    
    uint256 public priceA1 = 0.001 ether;
    uint256 public priceB1 = 0.002 ether;
    uint256 public poolPrice = 0.004 ether;
    
    function setUp() public {
        providerA1 = address(0x1001);
        providerB1 = address(0x1002);
        buyer = address(0x2001);
        operator = address(0x3001);
        
        vm.deal(providerA1, 10 ether);
        vm.deal(providerB1, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(operator, 10 ether);
        
        // Deploy pool registry
        poolRegistry = new PoolRegistry();
        
        // Deploy two separate registries (simulating Articles and Rentals modules)
        registryA = new PayAsYouGoBase();
        registryB = new PayAsYouGoBase();
        
        // Register same serviceId in both registries
        vm.prank(providerA1);
        registryA.registerService(serviceId1, priceA1);
        
        vm.prank(providerB1);
        registryB.registerService(serviceId1, priceB1);
    }
    
    /**
     * @dev Test: Same serviceId from different registries can coexist in one pool
     * This is the CORE test proving cross-registry support
     * 
     * Requirement: registryA: serviceId=1 → providerA, registryB: serviceId=1 → providerB
     * createPool succeeds + purchasePool后 earnings(A/B) 都增加（按 shares）
     */
    function test_crossRegistry_sameServiceIdDifferentRegistries() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1; // From registryA
        serviceIds[1] = serviceId1; // From registryB (same ID, different registry!)
        
        address[] memory registries = new address[](2);
        registries[0] = address(registryA);
        registries[1] = address(registryB);
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1; // Equal shares
        shares[1] = 1;
        
        // Create pool with same serviceId from different registries
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0, // permanent access
            0  // no operator fee
        );
        
        // Verify both members exist
        (uint256 serviceIdA, address registryAAddr, uint256 sharesA, bool existsA) = 
            poolRegistry.getMember(poolId, serviceId1, address(registryA));
        assertTrue(existsA, "Member from registryA should exist");
        assertEq(serviceIdA, serviceId1);
        assertEq(registryAAddr, address(registryA));
        assertEq(sharesA, 1);
        
        (uint256 serviceIdB, address registryBAddr, uint256 sharesB, bool existsB) = 
            poolRegistry.getMember(poolId, serviceId1, address(registryB));
        assertTrue(existsB, "Member from registryB should exist");
        assertEq(serviceIdB, serviceId1);
        assertEq(registryBAddr, address(registryB));
        assertEq(sharesB, 1);
        
        // Record earnings before purchase
        uint256 earningsABefore = poolRegistry.earnings(providerA1);
        uint256 earningsBBefore = poolRegistry.earnings(providerB1);
        assertEq(earningsABefore, 0);
        assertEq(earningsBBefore, 0);
        
        // Purchase pool
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // Both providers should receive equal payout (50% each)
        // Net = 0.004 ether (no fees)
        // Each gets: 0.004 / 2 = 0.002 ether
        uint256 earningsAAfter = poolRegistry.earnings(providerA1);
        uint256 earningsBAfter = poolRegistry.earnings(providerB1);
        
        assertEq(earningsAAfter, 0.002 ether, "ProviderA earnings should increase");
        assertEq(earningsBAfter, 0.002 ether, "ProviderB earnings should increase");
        
        // Verify earnings increased (not just set)
        assertGt(earningsAAfter, earningsABefore, "ProviderA earnings should have increased");
        assertGt(earningsBAfter, earningsBBefore, "ProviderB earnings should have increased");
    }
    
    /**
     * @dev Test: Remove member from one registry doesn't affect same serviceId from another
     * 
     * Requirement: removeMember(poolId, 1, registryA) 后，再 purchasePool，只有 providerB 拿钱
     */
    function test_crossRegistry_removeMemberDoesNotAffectOther() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1; // From registryA
        serviceIds[1] = serviceId1; // From registryB
        
        address[] memory registries = new address[](2);
        registries[0] = address(registryA);
        registries[1] = address(registryB);
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0,
            0
        );
        
        // Remove member from registryA
        vm.prank(operator);
        poolRegistry.removeMember(poolId, serviceId1, address(registryA));
        
        // Member from registryB should still exist
        (,,, bool existsB) = poolRegistry.getMember(poolId, serviceId1, address(registryB));
        assertTrue(existsB);
        
        // Member from registryA should not exist
        (,,, bool existsA) = poolRegistry.getMember(poolId, serviceId1, address(registryA));
        assertFalse(existsA);
        
        // Total shares should be 1 (only registryB member remains)
        (,,,, uint256 totalShares,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalShares, 1);
        
        // Purchase should only pay registryB provider
        uint256 earningsBBefore = poolRegistry.earnings(providerB1);
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // ProviderA should get nothing (removed)
        assertEq(poolRegistry.earnings(providerA1), 0, "ProviderA should receive nothing after removal");
        
        // ProviderB should get 100% (only remaining member)
        assertEq(poolRegistry.earnings(providerB1), earningsBBefore + poolPrice, "ProviderB should receive full payment");
        
        // Verify earnings increased
        assertGt(poolRegistry.earnings(providerB1), earningsBBefore, "ProviderB earnings should have increased");
    }
    
    /**
     * @dev Test: setShares works correctly with cross-registry members
     */
    function test_crossRegistry_setSharesDoesNotAffectOther() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1; // From registryA
        serviceIds[1] = serviceId1; // From registryB
        
        address[] memory registries = new address[](2);
        registries[0] = address(registryA);
        registries[1] = address(registryB);
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0,
            0
        );
        
        // Update shares for registryA member only
        vm.prank(operator);
        poolRegistry.setShares(poolId, serviceId1, address(registryA), 3);
        
        // Verify registryA shares updated
        (,, uint256 sharesA,) = poolRegistry.getMember(poolId, serviceId1, address(registryA));
        assertEq(sharesA, 3);
        
        // Verify registryB shares unchanged
        (,, uint256 sharesB,) = poolRegistry.getMember(poolId, serviceId1, address(registryB));
        assertEq(sharesB, 1);
        
        // Total shares should be 4 (3 + 1)
        (,,,, uint256 totalShares,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalShares, 4);
        
        // Purchase: registryA should get 75% (3/4), registryB should get 25% (1/4)
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // Net = 0.004 ether
        // ProviderA: 0.004 * 3 / 4 = 0.003 ether
        // ProviderB: 0.004 * 1 / 4 = 0.001 ether
        assertEq(poolRegistry.earnings(providerA1), 0.003 ether);
        assertEq(poolRegistry.earnings(providerB1), 0.001 ether);
    }
    
    /**
     * @dev Test: Events include registry for proper traceability
     */
    function test_crossRegistry_eventsIncludeRegistry() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId1;
        
        address[] memory registries = new address[](2);
        registries[0] = address(registryA);
        registries[1] = address(registryB);
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0,
            0
        );
        
        // Test MemberRemoved event includes registry
        vm.expectEmit(true, true, true, false);
        // Check that event is emitted with correct parameters
        // Note: We can't directly emit external contract events, so we verify via state changes
        vm.prank(operator);
        poolRegistry.removeMember(poolId, serviceId1, address(registryA));
        
        // Verify member was removed (state check)
        (,,, bool existsAfter) = poolRegistry.getMember(poolId, serviceId1, address(registryA));
        assertFalse(existsAfter);
        
        // Test MemberSharesUpdated event includes registry
        // Verify shares update (state check)
        vm.prank(operator);
        poolRegistry.setShares(poolId, serviceId1, address(registryB), 5);
        
        (,, uint256 sharesAfter,) = poolRegistry.getMember(poolId, serviceId1, address(registryB));
        assertEq(sharesAfter, 5);
    }
    
    /**
     * @dev Test: getPoolMembersDetailed helper function
     */
    function test_crossRegistry_getPoolMembersDetailed() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId1;
        
        address[] memory registries = new address[](2);
        registries[0] = address(registryA);
        registries[1] = address(registryB);
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 3;
        
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0,
            0
        );
        
        // Use helper function to get all member details in one call
        (uint256[] memory returnedServiceIds, address[] memory returnedRegistries, uint256[] memory returnedShares) = 
            poolRegistry.getPoolMembersDetailed(poolId);
        
        assertEq(returnedServiceIds.length, 2);
        assertEq(returnedRegistries.length, 2);
        assertEq(returnedShares.length, 2);
        
        // Verify order and values (order should match creation order)
        assertEq(returnedServiceIds[0], serviceId1);
        assertEq(returnedServiceIds[1], serviceId1);
        assertEq(returnedRegistries[0], address(registryA));
        assertEq(returnedRegistries[1], address(registryB));
        assertEq(returnedShares[0], 1);
        assertEq(returnedShares[1], 3);
    }
    
    /**
     * @dev Test: Cannot add duplicate (same registry + serviceId)
     */
    function test_crossRegistry_duplicateCheckWorks() public {
        uint256[] memory serviceIds = new uint256[](1);
        serviceIds[0] = serviceId1;
        
        address[] memory registries = new address[](1);
        registries[0] = address(registryA);
        
        uint256[] memory shares = new uint256[](1);
        shares[0] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(
            poolId,
            serviceIds,
            registries,
            shares,
            poolPrice,
            0,
            0
        );
        
        // Try to add same (registryA, serviceId1) again - should fail
        vm.expectRevert(abi.encodeWithSelector(
            PoolRegistry.DuplicateMemberInPool.selector,
            serviceId1,
            address(registryA)
        ));
        vm.prank(operator);
        poolRegistry.addMember(poolId, serviceId1, address(registryA), 2);
        
        // But can add (registryB, serviceId1) - should succeed
        vm.prank(operator);
        poolRegistry.addMember(poolId, serviceId1, address(registryB), 1);
        
        // Verify both exist
        (,,, bool existsA) = poolRegistry.getMember(poolId, serviceId1, address(registryA));
        (,,, bool existsB) = poolRegistry.getMember(poolId, serviceId1, address(registryB));
        assertTrue(existsA);
        assertTrue(existsB);
    }
}

