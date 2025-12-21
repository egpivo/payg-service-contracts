// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {EquipmentPayPerUse} from "../contracts/modules/rentals/equipment/EquipmentPayPerUse.sol";

contract EquipmentPayPerUseTest is Test {
    EquipmentPayPerUse public equipmentPayPerUse;
    address public provider;
    address public user;
    address public user2;

    uint256 public constant RENTAL_ID = 1;
    uint256 public constant PRICE = 0.001 ether;
    string public constant NAME = "Test Equipment";
    string public constant DESCRIPTION = "Test equipment";
    bytes32 public constant ASSET_HASH = keccak256("test asset");
    uint256 public constant USAGE_DURATION = 1 hours;

    event EquipmentUsed(uint256 indexed rentalId, address indexed renter, uint256 timestamp);
    event ServiceUsed(uint256 indexed serviceId, address indexed user, uint256 newUsageCount);

    function setUp() public {
        provider = address(0x1001);
        user = address(0x1002);
        user2 = address(0x1003);

        vm.deal(provider, 10 ether);
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);

        vm.prank(provider);
        equipmentPayPerUse = new EquipmentPayPerUse();
    }

    function test_providerControlledDuration_exclusive() public {
        // List exclusive equipment with time window
        vm.prank(provider);
        equipmentPayPerUse.listEquipment(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, true, USAGE_DURATION);

        uint256 defaultDuration = equipmentPayPerUse.defaultUsageDuration(RENTAL_ID);
        assertEq(defaultDuration, USAGE_DURATION);

        // Use equipment
        uint256 useTime = block.timestamp;
        vm.prank(user);
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);

        // Should have exclusivity
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = equipmentPayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user);
        assertEq(exclusiveUntil, useTime + USAGE_DURATION);

        // Second user should not be able to use
        vm.prank(user2);
        vm.expectRevert();
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);
    }

    function test_providerControlledDuration_nonExclusive() public {
        // List non-exclusive equipment
        vm.prank(provider);
        equipmentPayPerUse.listEquipment(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, false, USAGE_DURATION);

        // Multiple users can use simultaneously
        vm.prank(user);
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);

        vm.prank(user2);
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);

        // Both should be able to use (no exclusivity)
        // Usage count should be 2
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount,,) = equipmentPayPerUse.getRental(RENTAL_ID);
        assertEq(usageCount, 2);
    }

    function test_providerControlledDuration_blockLevel() public {
        // List exclusive equipment with block-level duration
        vm.prank(provider);
        equipmentPayPerUse.listEquipment(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, true, 0);

        uint256 defaultDuration = equipmentPayPerUse.defaultUsageDuration(RENTAL_ID);
        assertEq(defaultDuration, 0);

        // Use equipment
        vm.prank(user);
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);

        // Should have block-level exclusivity
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = equipmentPayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user);
        assertGt(exclusiveUntil, block.timestamp);
        assertLe(exclusiveUntil, block.timestamp + 2);
    }

    function test_providerControlledDuration_exclusivityExpires() public {
        // List exclusive equipment with short duration
        uint256 shortDuration = 1 hours;
        vm.prank(provider);
        equipmentPayPerUse.listEquipment(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, true, shortDuration);

        // First user uses
        vm.prank(user);
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);

        // Fast forward past exclusivity
        vm.warp(block.timestamp + shortDuration + 1);

        // Second user can now use
        vm.prank(user2);
        equipmentPayPerUse.useEquipment{value: PRICE}(RENTAL_ID);

        // Verify second user is now the renter
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = equipmentPayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user2);
    }
}

