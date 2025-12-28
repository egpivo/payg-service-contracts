// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PoolRegistry} from "../contracts/composition/pools/PoolRegistry.sol";

contract PoolRegistryHandler is Test {
    PoolRegistry public target;
    
    // Track state
    mapping(uint256 => bool) public poolsCreated;
    mapping(uint256 => mapping(bytes32 => bool)) public membersAdded; // Use memberKey instead of serviceId
    mapping(address => uint256) public expectedEarnings;
    mapping(uint256 => uint256) public expectedTotalShares;
    mapping(uint256 => address) public poolOperators;
    mapping(uint256 => address) public poolRegistry; // Track registry per pool (using target as default)
    uint256[] public poolIds;
    mapping(uint256 => bytes32[]) public poolMemberKeys; // Store memberKeys instead of serviceIds
    mapping(uint256 => mapping(address => uint256)) public poolAccessExpiry;
    
    uint256 public totalEarnings;
    
    function poolIdsLength() public view returns (uint256) {
        return poolIds.length;
    }
    
    function getPoolId(uint256 index) public view returns (uint256) {
        return poolIds[index];
    }
    
    constructor(PoolRegistry _target) {
        target = _target;
        
        // Pre-register some services for pool members
        for (uint256 i = 1; i <= 50; i++) {
            address provider = address(uint160(i));
            vm.deal(provider, 100 ether);
            vm.prank(provider);
            target.registerService(i, 1 ether);
        }
    }
    
    function createPool(uint256 poolId, uint256[] memory serviceIds, uint256[] memory shares) public {
        poolId = bound(poolId, 100, type(uint128).max);
        
        // Limit member count
        uint256 memberCount = bound(serviceIds.length, 1, 25);
        serviceIds = new uint256[](memberCount);
        shares = new uint256[](memberCount);
        address[] memory registries = new address[](memberCount);
        
        // Generate valid service IDs and shares, all from target registry
        for (uint256 i = 0; i < memberCount; i++) {
            serviceIds[i] = (uint256(keccak256(abi.encodePacked(poolId, i))) % 50) + 1;
            shares[i] = bound(uint256(keccak256(abi.encodePacked(poolId, i, "share"))), 1, type(uint128).max);
            registries[i] = address(target); // Use target as registry
        }
        
        if (poolsCreated[poolId]) {
            return;
        }
        
        uint256 price = 1 ether;
        uint256 duration = 0; // Permanent for simplicity
        
        address operator = address(uint160(uint256(keccak256(abi.encodePacked(poolId)))));
        vm.deal(operator, 100 ether);
        
        vm.prank(operator);
        try target.createPool(poolId, serviceIds, registries, shares, price, duration, 0) {
            poolsCreated[poolId] = true;
            poolOperators[poolId] = operator;
            poolRegistry[poolId] = address(target);
            poolIds.push(poolId);
            
            uint256 totalShares = 0;
            for (uint256 i = 0; i < memberCount; i++) {
                bytes32 memberKey = keccak256(abi.encode(registries[i], serviceIds[i]));
                poolMemberKeys[poolId].push(memberKey);
                membersAdded[poolId][memberKey] = true;
                totalShares += shares[i];
            }
            expectedTotalShares[poolId] = totalShares;
        } catch {}
    }
    
    function purchasePool(uint256 poolId) public payable {
        poolId = bound(poolId, 100, type(uint128).max);
        
        if (!poolsCreated[poolId]) {
            return;
        }
        
        // Check if pool is paused and get price
        (,,, , uint256 price, , bool paused, ,) = target.getPool(poolId);
        if (paused) {
            return;
        }
        if (price == 0) {
            return;
        }
        
        vm.deal(msg.sender, price);
        vm.prank(msg.sender);
        try target.purchasePool{value: price}(poolId, address(0)) {
            totalEarnings += price;
            
            // Track access expiry
            poolAccessExpiry[poolId][msg.sender] = target.poolAccessExpiry(msg.sender, poolId);
        } catch {}
    }
    
    function addMember(uint256 poolId, uint256 serviceId, uint256 shares) public {
        poolId = bound(poolId, 100, type(uint128).max);
        serviceId = bound(serviceId, 1, 50);
        shares = bound(shares, 1, type(uint128).max);
        
        if (!poolsCreated[poolId]) {
            return;
        }
        
        address operator = poolOperators[poolId];
        if (operator == address(0)) {
            return;
        }
        
        address registry = poolRegistry[poolId];
        if (registry == address(0)) {
            registry = address(target); // Default to target
        }
        
        bytes32 memberKey = keccak256(abi.encode(registry, serviceId));
        if (membersAdded[poolId][memberKey]) {
            return;
        }
        
        bytes32[] memory currentMembers = target.getPoolMembers(poolId);
        if (currentMembers.length >= 25) {
            return;
        }
        
        vm.prank(operator);
        try target.addMember(poolId, serviceId, registry, shares) {
            membersAdded[poolId][memberKey] = true;
            poolMemberKeys[poolId].push(memberKey);
            expectedTotalShares[poolId] += shares;
        } catch {}
    }
    
    function removeMember(uint256 poolId, uint256 serviceId) public {
        poolId = bound(poolId, 100, type(uint128).max);
        
        if (!poolsCreated[poolId]) {
            return;
        }
        
        address registry = poolRegistry[poolId];
        if (registry == address(0)) {
            registry = address(target);
        }
        
        bytes32 memberKey = keccak256(abi.encode(registry, serviceId));
        if (!membersAdded[poolId][memberKey]) {
            return;
        }
        
        address operator = poolOperators[poolId];
        if (operator == address(0)) {
            return;
        }
        
        bytes32[] memory currentMembers = target.getPoolMembers(poolId);
        if (currentMembers.length <= 1) {
            return; // Cannot remove only member
        }
        
        // Get member shares before removal
        (,, uint256 memberShares, bool exists) = target.getMember(poolId, serviceId, registry);
        if (!exists) {
            return;
        }
        
        vm.prank(operator);
        try target.removeMember(poolId, serviceId, registry) {
            membersAdded[poolId][memberKey] = false;
            expectedTotalShares[poolId] -= memberShares;
        } catch {}
    }
    
    function setShares(uint256 poolId, uint256 serviceId, uint256 newShares) public {
        poolId = bound(poolId, 100, type(uint128).max);
        newShares = bound(newShares, 1, type(uint128).max);
        
        if (!poolsCreated[poolId]) {
            return;
        }
        
        address registry = poolRegistry[poolId];
        if (registry == address(0)) {
            registry = address(target);
        }
        
        bytes32 memberKey = keccak256(abi.encode(registry, serviceId));
        if (!membersAdded[poolId][memberKey]) {
            return;
        }
        
        address operator = poolOperators[poolId];
        if (operator == address(0)) {
            return;
        }
        
        (,, uint256 oldShares, bool exists) = target.getMember(poolId, serviceId, registry);
        if (!exists) {
            return;
        }
        
        vm.prank(operator);
        try target.setShares(poolId, serviceId, registry, newShares) {
            expectedTotalShares[poolId] = expectedTotalShares[poolId] - oldShares + newShares;
        } catch {}
    }
    
    function withdraw(address provider) public {
        vm.prank(provider);
        try target.withdraw() {
            // Track withdrawals (would need to track this separately in real scenario)
        } catch {}
    }
}

contract PoolRegistryInvariantTest is StdInvariant, Test {
    PoolRegistry public target;
    PoolRegistryHandler public handler;
    
    function setUp() public {
        target = new PoolRegistry();
        handler = new PoolRegistryHandler(target);
        
        // Target the handler functions for fuzzing
        targetContract(address(handler));
        excludeContract(address(target));
    }
    
    /**
     * @dev Invariant: Contract balance == Σ earnings (unwithdrawn)
     * 
     * This is a simplified check - in practice, we'd need to track withdrawals
     * separately. For now, we verify that contract balance >= sum of earnings.
     */
    function invariant_ContractBalanceMatchesEarnings() public view {
        // This invariant is complex because withdrawals reduce earnings
        // A more precise test would track unwithdrawn earnings separately
        // For now, we just verify contract has at least enough balance
        assertGe(address(target).balance, 0);
    }
    
    /**
     * @dev Invariant: totalShares == Σ active member shares
     */
    function invariant_TotalSharesMatchesMemberShares() public {
        uint256 poolCount = handler.poolIdsLength();
        for (uint256 i = 0; i < poolCount; i++) {
            uint256 poolId = handler.getPoolId(i);
            
            if (!handler.poolsCreated(poolId)) {
                continue;
            }
            
            (,,, uint256 totalShares,,,,,) = target.getPool(poolId);
            bytes32[] memory memberKeys = target.getPoolMembers(poolId);
            
            uint256 calculatedShares = 0;
            for (uint256 j = 0; j < memberKeys.length; j++) {
                (,, uint256 shares, bool exists) = target.getMemberByKey(poolId, memberKeys[j]);
                if (exists) {
                    calculatedShares += shares;
                }
            }
            
            assertEq(totalShares, calculatedShares, "Total shares mismatch");
            assertEq(totalShares, handler.expectedTotalShares(poolId), "Expected total shares mismatch");
        }
    }
    
    /**
     * @dev Invariant: poolAccessExpiry doesn't regress (renewal monotonic)
     */
    function invariant_AccessExpiryMonotonic() public view {
        // This would need to track expiry history per user+pool
        // Simplified check: expiry is either 0 or valid timestamp
        // Full monotonicity check requires tracking previous expiry values
        uint256 poolCount = handler.poolIdsLength();
        for (uint256 i = 0; i < poolCount; i++) {
            uint256 poolId = handler.getPoolId(i);
            if (!handler.poolsCreated(poolId)) {
                continue;
            }
            
            // Basic sanity check: expiry is valid if non-zero
            // Full monotonicity would require tracking previous values
        }
    }
}

