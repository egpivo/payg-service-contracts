// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {PoolRegistry} from "../contracts/composition/pools/PoolRegistry.sol";
import {PayAsYouGoBase} from "../contracts/core/PayAsYouGoBase.sol";

contract PoolRegistryTest is Test {
    PoolRegistry public poolRegistry;
    address public provider1;
    address public provider2;
    address public provider3;
    address public buyer;
    address public operator;
    
    uint256 public serviceId1 = 1;
    uint256 public serviceId2 = 2;
    uint256 public serviceId3 = 3;
    uint256 public poolId = 100;
    
    uint256 public price1 = 0.001 ether;
    uint256 public price2 = 0.002 ether;
    uint256 public price3 = 0.0015 ether;
    uint256 public poolPrice = 0.004 ether;
    
    function setUp() public {
        provider1 = address(0x1001);
        provider2 = address(0x1002);
        provider3 = address(0x1003);
        buyer = address(0x2001);
        operator = address(0x3001);
        
        vm.deal(provider1, 10 ether);
        vm.deal(provider2, 10 ether);
        vm.deal(provider3, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(operator, 10 ether);
        
        poolRegistry = new PoolRegistry();
        
        // Register services
        vm.prank(provider1);
        poolRegistry.registerService(serviceId1, price1);
        
        vm.prank(provider2);
        poolRegistry.registerService(serviceId2, price2);
        
        vm.prank(provider3);
        poolRegistry.registerService(serviceId3, price3);
    }
    
    function test_createPool_success() public {
        uint256[] memory serviceIds = new uint256[](3);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        serviceIds[2] = serviceId3;
        
        uint256[] memory shares = new uint256[](3);
        shares[0] = 1;
        shares[1] = 2;
        shares[2] = 1;
        
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, accessDuration, 200, 100); // 2% operator, 1% affiliate
        
        (uint256 id, address poolCreator, address poolOperator, uint256 memberCount, uint256 totalShares, uint256 price, uint16 operatorFeeBps, uint16 affiliateFeeBps, bool paused, uint256 duration, uint256 usageCount) = 
            poolRegistry.getPool(poolId);
        
        assertEq(id, poolId);
        assertEq(poolCreator, operator);
        assertEq(poolOperator, operator);
        assertEq(memberCount, 3);
        assertEq(totalShares, 4); // 1 + 2 + 1
        assertEq(price, poolPrice);
        assertEq(operatorFeeBps, 200);
        assertEq(affiliateFeeBps, 100);
        assertEq(paused, false);
        assertEq(duration, accessDuration);
        assertEq(usageCount, 0);
    }
    
    function test_createPool_duplicateIdReverts() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.PoolIdAlreadyExists.selector, poolId));
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
    }
    
    function test_createPool_nonexistentServiceReverts() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = 999; // Non-existent
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.ServiceDoesNotExistInBase.selector, uint256(999)));
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
    }
    
    function test_createPool_emptyMembersReverts() public {
        uint256[] memory serviceIds = new uint256[](0);
        uint256[] memory shares = new uint256[](0);
        
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.PoolMustContainAtLeastOneMember.selector));
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
    }
    
    function test_purchasePool_splitsCorrectly() public {
        uint256[] memory serviceIds = new uint256[](3);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        serviceIds[2] = serviceId3;
        
        uint256[] memory shares = new uint256[](3);
        shares[0] = 1; // 25% (1/4)
        shares[1] = 2; // 50% (2/4)
        shares[2] = 1; // 25% (1/4)
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0); // No fees for simplicity
        
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // Provider1: 25% of 0.004 ether = 0.001 ether (plus remainder if any)
        // Provider2: 50% of 0.004 ether = 0.002 ether
        // Provider3: 25% of 0.004 ether = 0.001 ether
        // Remainder: 0.004 - 0.001 - 0.002 - 0.001 = 0
        
        assertEq(poolRegistry.earnings(provider1), 0.001 ether);
        assertEq(poolRegistry.earnings(provider2), 0.002 ether);
        assertEq(poolRegistry.earnings(provider3), 0.001 ether);
    }
    
    function test_purchasePool_refundOverpay() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        uint256 overpayAmount = poolPrice + 0.001 ether;
        uint256 buyerBalanceBefore = buyer.balance;
        
        vm.prank(buyer);
        poolRegistry.purchasePool{value: overpayAmount}(poolId, address(0));
        
        uint256 buyerBalanceAfter = buyer.balance;
        // Should have spent exactly poolPrice
        assertEq(buyerBalanceBefore - buyerBalanceAfter, poolPrice);
    }
    
    function test_purchasePool_renewalExtendsExpiry() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, accessDuration, 0, 0);
        
        vm.warp(1000);
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        uint256 firstExpiry = poolRegistry.poolAccessExpiry(buyer, poolId);
        assertEq(firstExpiry, 1000 + accessDuration);
        
        // Renew before expiry (should extend from current expiry)
        vm.warp(1000 + 43200); // Halfway through
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        uint256 secondExpiry = poolRegistry.poolAccessExpiry(buyer, poolId);
        // Should extend from firstExpiry, not from now
        assertEq(secondExpiry, firstExpiry + accessDuration);
    }
    
    function test_purchasePool_expiredExtendsFromNow() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, accessDuration, 0, 0);
        
        vm.warp(1000);
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        uint256 firstExpiry = poolRegistry.poolAccessExpiry(buyer, poolId);
        
        // Renew after expiry (should start from now)
        vm.warp(1000 + accessDuration + 1000); // After expiry
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        uint256 secondExpiry = poolRegistry.poolAccessExpiry(buyer, poolId);
        // Should start from now, not extend from expired
        assertEq(secondExpiry, block.timestamp + accessDuration);
    }
    
    function test_addMember_updatesTotalShares() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 2;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        (,,,, uint256 totalSharesBefore,,,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalSharesBefore, 3);
        
        vm.prank(operator);
        poolRegistry.addMember(poolId, serviceId3, 5);
        
        (,,,, uint256 totalSharesAfter,,,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalSharesAfter, 8); // 3 + 5
    }
    
    function test_removeMember_updatesTotalShares() public {
        uint256[] memory serviceIds = new uint256[](3);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        serviceIds[2] = serviceId3;
        
        uint256[] memory shares = new uint256[](3);
        shares[0] = 1;
        shares[1] = 2;
        shares[2] = 3;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        (,,,, uint256 totalSharesBefore,,,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalSharesBefore, 6);
        
        vm.prank(operator);
        poolRegistry.removeMember(poolId, serviceId2);
        
        (,,,, uint256 totalSharesAfter,,,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalSharesAfter, 4); // 6 - 2
    }
    
    function test_pausedPool_blocksPurchase() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        vm.prank(operator);
        poolRegistry.pausePool(poolId);
        
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.PoolIsPaused.selector, poolId));
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
    }
    
    function test_setShares_updatesTotalShares() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 2;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        (,,,, uint256 totalSharesBefore,,,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalSharesBefore, 3);
        
        vm.prank(operator);
        poolRegistry.setShares(poolId, serviceId1, 5);
        
        (,,,, uint256 totalSharesAfter,,,,,,) = poolRegistry.getPool(poolId);
        assertEq(totalSharesAfter, 7); // 3 - 1 + 5
    }
    
    function test_hasPoolAccess_validAccess() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, accessDuration, 0, 0);
        
        vm.warp(1000);
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // Should have access
        assertTrue(poolRegistry.hasPoolAccess(buyer, poolId));
        
        // After expiry, should not have access
        vm.warp(1000 + accessDuration + 1);
        assertFalse(poolRegistry.hasPoolAccess(buyer, poolId));
    }
    
    function test_onlyOperator_canModifyMembers() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 0, 0);
        
        // Non-operator cannot add member
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.OnlyPoolOperatorCanCall.selector, poolId, buyer));
        vm.prank(buyer);
        poolRegistry.addMember(poolId, serviceId3, 1);
        
        // Non-operator cannot remove member
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.OnlyPoolOperatorCanCall.selector, poolId, buyer));
        vm.prank(buyer);
        poolRegistry.removeMember(poolId, serviceId1);
        
        // Non-operator cannot set shares
        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.OnlyPoolOperatorCanCall.selector, poolId, buyer));
        vm.prank(buyer);
        poolRegistry.setShares(poolId, serviceId1, 5);
    }
    
    function test_purchasePool_withFees() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        address affiliate = address(0x4001);
        vm.deal(affiliate, 10 ether);
        
        // Create pool with 2% operator fee and 1% affiliate fee
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 200, 100);
        
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, affiliate);
        
        // Price: 0.004 ether
        // Operator fee: 2% = 0.00008 ether
        // Affiliate fee: 1% = 0.00004 ether
        // Net: 0.004 - 0.00008 - 0.00004 = 0.00388 ether
        // Each provider gets: 0.00388 / 2 = 0.00194 ether
        
        assertEq(poolRegistry.earnings(operator), 0.00008 ether);
        assertEq(poolRegistry.earnings(affiliate), 0.00004 ether);
        assertEq(poolRegistry.earnings(provider1), 0.00194 ether);
        assertEq(poolRegistry.earnings(provider2), 0.00194 ether);
    }
    
    function test_purchasePool_noAffiliate() public {
        uint256[] memory serviceIds = new uint256[](2);
        serviceIds[0] = serviceId1;
        serviceIds[1] = serviceId2;
        
        uint256[] memory shares = new uint256[](2);
        shares[0] = 1;
        shares[1] = 1;
        
        // Create pool with fees but no affiliate provided
        vm.prank(operator);
        poolRegistry.createPool(poolId, serviceIds, shares, poolPrice, 0, 200, 100);
        
        vm.prank(buyer);
        poolRegistry.purchasePool{value: poolPrice}(poolId, address(0));
        
        // No affiliate fee should be deducted
        // Price: 0.004 ether
        // Operator fee: 2% = 0.00008 ether
        // Net: 0.004 - 0.00008 = 0.00392 ether
        // Each provider gets: 0.00392 / 2 = 0.00196 ether
        
        assertEq(poolRegistry.earnings(operator), 0.00008 ether);
        assertEq(poolRegistry.earnings(provider1), 0.00196 ether);
        assertEq(poolRegistry.earnings(provider2), 0.00196 ether);
    }
}

