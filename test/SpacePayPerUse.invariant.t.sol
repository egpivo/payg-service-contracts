// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {SpacePayPerUse} from "../contracts/modules/rentals/space/SpacePayPerUse.sol";

/**
 * @dev Invariant-driven stress test for exclusivity.
 *
 * We don't try to model "realistic" user journeys. Instead, we let Foundry
 * generate arbitrary interleavings of:
 * - useSpace()
 * - warp time
 * - provider withdraw
 *
 * Invariant (protocol-level): two different renters must never successfully
 * overlap inside the same exclusive window.
 */
contract SpacePayPerUseHandler is Test {
    SpacePayPerUse public target;

    address public provider;
    address public userA;
    address public userB;

    uint256 public constant RENTAL_ID = 1;
    uint256 public constant PRICE = 0.001 ether;

    // Tracks last successful renter + window end (used to detect overlap)
    address public lastRenter;
    uint256 public lastExclusiveUntil;

    constructor(SpacePayPerUse _target, address _provider, address _userA, address _userB) {
        target = _target;
        provider = _provider;
        userA = _userA;
        userB = _userB;
    }

    function action_warp(uint32 secondsForward) external {
        uint256 dt = bound(uint256(secondsForward), 0, 2 days);
        vm.warp(block.timestamp + dt);
    }

    function action_useSpace(uint8 who) external {
        address renter = (who % 2 == 0) ? userA : userB;

        vm.prank(renter);
        try target.useSpace{value: PRICE}(RENTAL_ID) {
            // useSpace succeeded. If this is a different renter, it must not be
            // inside the previous exclusive window.
            if (lastRenter != address(0) && renter != lastRenter) {
                if (block.timestamp <= lastExclusiveUntil) {
                    revert("exclusivity overlap");
                }
            }

            // Record the new exclusive window end.
            // getRental returns: (rentalId, name, description, assetHash, listDate, exclusive, available, price, provider, usageCount, currentRenterAddr, exclusiveUntilTs)
            (,,,,,,, , , , address current, uint256 until) = target.getRental(RENTAL_ID);
            lastRenter = current;
            lastExclusiveUntil = until;
        } catch {
            // Reverts are expected (e.g., exclusivity active). Ignore.
        }
    }

    function action_withdrawProvider() external {
        vm.prank(provider);
        try target.withdraw() {
            // ok
        } catch {
            // ok (may have 0 earnings or escrow constraints in other contracts)
        }
    }
}

contract SpacePayPerUseInvariantTest is Test {
    SpacePayPerUse public target;
    SpacePayPerUseHandler public handler;

    address public provider = address(0xBEEF);
    address public userA = address(0xA11CE);
    address public userB = address(0xB0B);

    uint256 public constant RENTAL_ID = 1;
    uint256 public constant PRICE = 0.001 ether;
    uint256 public constant USAGE_DURATION = 1 hours;

    function setUp() public {
        vm.deal(provider, 100 ether);
        vm.deal(userA, 100 ether);
        vm.deal(userB, 100 ether);

        vm.prank(provider);
        target = new SpacePayPerUse();

        // List an exclusive space with a time window.
        vm.prank(provider);
        target.listSpace(RENTAL_ID, PRICE, "Space", "desc", keccak256("asset"), USAGE_DURATION);

        handler = new SpacePayPerUseHandler(target, provider, userA, userB);
        targetContract(address(handler));
    }

    /// @dev State consistency: exclusivity fields must be paired.
    function invariant_exclusiveFieldsPaired() public view {
        address renter = target.currentRenter(RENTAL_ID);
        uint256 until = target.exclusiveUntil(RENTAL_ID);
        assertEq(renter == address(0), until == 0);
    }
}





