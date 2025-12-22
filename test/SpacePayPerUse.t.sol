// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {SpacePayPerUse} from "../contracts/modules/rentals/space/SpacePayPerUse.sol";

contract SpacePayPerUseTest is Test {
    SpacePayPerUse public spacePayPerUse;
    address public provider;
    address public user;
    address public user2;

    uint256 public constant RENTAL_ID = 1;
    uint256 public constant PRICE = 0.001 ether;
    string public constant NAME = "Test Space";
    string public constant DESCRIPTION = "A test space";
    bytes32 public constant ASSET_HASH = keccak256("test asset");
    uint256 public constant USAGE_DURATION = 1 hours;

    event SpaceUsed(uint256 indexed rentalId, address indexed renter, uint256 timestamp);
    event ServiceUsed(uint256 indexed serviceId, address indexed user, uint256 newUsageCount);
    event ExclusiveRentalStarted(uint256 indexed rentalId, address indexed renter, uint256 until);
    event ExclusiveRentalEnded(uint256 indexed rentalId, address indexed renter);

    function setUp() public {
        provider = address(0x1001);
        user = address(0x1002);
        user2 = address(0x1003);

        vm.deal(provider, 10 ether);
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);

        vm.prank(provider);
        spacePayPerUse = new SpacePayPerUse();
    }

    function test_providerControlledDuration_blockLevel() public {
        // List space with block-level duration (0)
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, 0);

        uint256 defaultDuration = spacePayPerUse.defaultUsageDuration(RENTAL_ID);
        assertEq(defaultDuration, 0);

        // Use space
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Should have block-level exclusivity (exclusiveUntil should be block.timestamp + 1)
        // Note: We can't easily test exact timestamp, but we can verify exclusivity is set
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = spacePayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user);
        assertGt(exclusiveUntil, block.timestamp);
        assertLe(exclusiveUntil, block.timestamp + 2); // Should be ~block.timestamp + 1
    }

    function test_providerControlledDuration_timeWindow() public {
        // List space with time window duration
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, USAGE_DURATION);

        uint256 defaultDuration = spacePayPerUse.defaultUsageDuration(RENTAL_ID);
        assertEq(defaultDuration, USAGE_DURATION);

        // Use space
        uint256 useTime = block.timestamp;
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Should have time window exclusivity
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = spacePayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user);
        assertEq(exclusiveUntil, useTime + USAGE_DURATION);
    }

    function test_providerControlledDuration_exclusivityEnforced() public {
        // List space with time window
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, USAGE_DURATION);

        // First user uses space
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Second user should not be able to use (exclusive)
        vm.prank(user2);
        vm.expectRevert();
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);
    }

    function test_providerControlledDuration_exclusivityExpires() public {
        // List space with short duration for testing
        uint256 shortDuration = 1 hours;
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, shortDuration);

        // First user uses space
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Fast forward past exclusivity period
        vm.warp(block.timestamp + shortDuration + 1);

        // Second user should now be able to use (exclusivity expired)
        vm.prank(user2);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Verify second user is now the renter
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = spacePayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user2);
    }

    function test_providerControlledDuration_autoClearsExpired() public {
        // List space with short duration
        uint256 shortDuration = 1 hours;
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, shortDuration);

        // First user uses space
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Fast forward past exclusivity
        vm.warp(block.timestamp + shortDuration + 1);

        // Second user uses space (should auto-clear expired exclusivity)
        vm.expectEmit(true, true, false, false);
        emit ExclusiveRentalEnded(RENTAL_ID, user);
        
        vm.prank(user2);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);
    }

    function test_providerControlledDuration_sameUserCanReuseAfterExpiry() public {
        // List space with short duration
        uint256 shortDuration = 1 hours;
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, shortDuration);

        // User uses space
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Fast forward past exclusivity
        vm.warp(block.timestamp + shortDuration + 1);

        // Same user can use again
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Verify user is still the renter
        (,,,,,,, uint256 price, address providerAddr, uint256 usageCount, address currentRenter, uint256 exclusiveUntil) = spacePayPerUse.getRental(RENTAL_ID);
        assertEq(currentRenter, user);
    }

    function test_providerControlledDuration_multipleUses() public {
        // List space with shorter duration for testing
        uint256 shortDuration = 1 hours;
        vm.prank(provider);
        spacePayPerUse.listSpace(RENTAL_ID, PRICE, NAME, DESCRIPTION, ASSET_HASH, shortDuration);

        // First use
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);
        
        // Verify exclusivity is set
        (,,,,,,, uint256 _price1, address _provider1, uint256 usageCount1, address currentRenter1, uint256 exclusiveUntil1) = spacePayPerUse.getRental(RENTAL_ID);
        _price1; _provider1; // Silence unused variable warnings
        assertEq(currentRenter1, user);
        assertEq(usageCount1, 1);
        // Verify exclusivity duration: exclusiveUntil1 should be approximately block.timestamp + shortDuration
        uint256 duration1 = exclusiveUntil1 > block.timestamp ? exclusiveUntil1 - block.timestamp : 0;
        assertGe(duration1, shortDuration);
        assertLe(duration1, shortDuration + 1);

        // Fast forward past exclusivity
        vm.warp(exclusiveUntil1 + 1);
        
        // Second use by different user
        // Capture the expected exclusiveUntil value before the call
        // exclusiveUntil2 should be block.timestamp + shortDuration when useSpace is called
        uint256 expectedExclusiveUntil2 = block.timestamp + shortDuration;
        vm.prank(user2);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);
        
        // Verify exclusivity is set for user2
        (,,,,,,, uint256 _price2, address _provider2, uint256 usageCount2, address currentRenter2, uint256 exclusiveUntil2) = spacePayPerUse.getRental(RENTAL_ID);
        _price2; _provider2; // Silence unused variable warnings
        assertEq(currentRenter2, user2);
        assertEq(usageCount2, 2);
        
        // Verify exclusivity duration: exclusiveUntil2 should be exactly block.timestamp + shortDuration
        // (within 1 second tolerance for block-level variations)
        // We check against the expected value we calculated before the call
        assertGe(exclusiveUntil2, expectedExclusiveUntil2, "exclusiveUntil2 should be at least expected value");
        assertLe(exclusiveUntil2, expectedExclusiveUntil2 + 1, "exclusiveUntil2 should not exceed expected value by more than 1 second");

        // Fast forward past exclusivity again
        vm.warp(exclusiveUntil2 + 1);
        
        // Third use by first user
        vm.prank(user);
        spacePayPerUse.useSpace{value: PRICE}(RENTAL_ID);

        // Usage count should be 3
        (,,,,,,, uint256 _price3, address _provider3, uint256 usageCount3,,) = spacePayPerUse.getRental(RENTAL_ID);
        _price3; _provider3; // Silence unused variable warnings
        assertEq(usageCount3, 3);
    }
}

