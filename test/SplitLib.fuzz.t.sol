// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {SplitLib} from "../contracts/composition/pools/SplitLib.sol";

contract SplitLibFuzzTest is Test {
    
    /**
     * @dev Fuzz test: invariant that sum(payouts) + remainder == netAmount
     */
    function testFuzz_SplitInvariant(
        uint256 netAmount,
        uint8 memberCount,
        uint256[] memory rawShares
    ) public {
        // Bound inputs to reasonable ranges
        netAmount = bound(netAmount, 1, type(uint128).max);
        memberCount = uint8(bound(memberCount, 1, 25));
        
        // Create shares array
        uint256[] memory shares = new uint256[](memberCount);
        uint256 totalShares = 0;
        
        // Generate valid shares (all > 0)
        for (uint256 i = 0; i < memberCount; i++) {
            uint256 share;
            if (rawShares.length > i && rawShares[i] > 0) {
                share = bound(rawShares[i], 1, type(uint128).max);
            } else {
                share = uint256(keccak256(abi.encodePacked(i, rawShares))) % type(uint128).max + 1;
            }
            shares[i] = share;
            totalShares += share;
        }
        
        // Calculate splits
        (uint256[] memory payouts, uint256 remainder) = SplitLib.calculateSplits(
            netAmount,
            shares,
            totalShares
        );
        
        // Invariant: sum(payouts) + remainder == netAmount
        uint256 sumPayouts = 0;
        for (uint256 i = 0; i < payouts.length; i++) {
            sumPayouts += payouts[i];
        }
        
        assertEq(sumPayouts + remainder, netAmount, "Split invariant violated");
    }
    
    /**
     * @dev Fuzz test: remainder is always less than member count
     */
    function testFuzz_RemainderBound(
        uint256 netAmount,
        uint8 memberCount,
        uint256[] memory rawShares
    ) public {
        // Bound inputs
        netAmount = bound(netAmount, 1, type(uint128).max);
        memberCount = uint8(bound(memberCount, 1, 25));
        
        // Create shares array
        uint256[] memory shares = new uint256[](memberCount);
        uint256 totalShares = 0;
        
        for (uint256 i = 0; i < memberCount; i++) {
            uint256 share;
            if (rawShares.length > i && rawShares[i] > 0) {
                share = bound(rawShares[i], 1, type(uint128).max);
            } else {
                share = uint256(keccak256(abi.encodePacked(i, rawShares))) % type(uint128).max + 1;
            }
            shares[i] = share;
            totalShares += share;
        }
        
        (, uint256 remainder) = SplitLib.calculateSplits(
            netAmount,
            shares,
            totalShares
        );
        
        // Remainder should be less than member count (worst case rounding)
        assertLt(remainder, memberCount, "Remainder too large");
    }
    
    /**
     * @dev Fuzz test: individual payouts are proportional to shares
     */
    function testFuzz_PayoutProportionality(
        uint256 netAmount,
        uint8 memberCount,
        uint256[] memory rawShares
    ) public {
        // Bound inputs
        netAmount = bound(netAmount, 1000, type(uint128).max);
        memberCount = uint8(bound(memberCount, 2, 25));
        
        // Create shares array
        uint256[] memory shares = new uint256[](memberCount);
        uint256 totalShares = 0;
        
        for (uint256 i = 0; i < memberCount; i++) {
            uint256 share;
            if (rawShares.length > i && rawShares[i] > 0) {
                share = bound(rawShares[i], 1, type(uint128).max);
            } else {
                share = uint256(keccak256(abi.encodePacked(i, rawShares))) % type(uint128).max + 1;
            }
            shares[i] = share;
            totalShares += share;
        }
        
        (uint256[] memory payouts, ) = SplitLib.calculateSplits(
            netAmount,
            shares,
            totalShares
        );
        
        // Each payout should be approximately (netAmount * share) / totalShares
        // Due to rounding, we check that payout is within 1 wei of expected
        for (uint256 i = 0; i < memberCount; i++) {
            uint256 expectedPayout = (netAmount * shares[i]) / totalShares;
            assertGe(payouts[i], expectedPayout, "Payout too small");
            assertLe(payouts[i], expectedPayout + 1, "Payout too large");
        }
    }
    
    /**
     * @dev Fuzz test: equal shares result in equal payouts (when divisible)
     */
    function testFuzz_EqualSharesEqualPayouts(uint256 netAmount, uint8 memberCount) public {
        // Bound inputs and ensure netAmount is divisible by memberCount
        memberCount = uint8(bound(memberCount, 1, 25));
        netAmount = bound(netAmount, memberCount, type(uint128).max);
        // Make divisible by memberCount
        netAmount = (netAmount / memberCount) * memberCount;
        
        // Create equal shares
        uint256[] memory shares = new uint256[](memberCount);
        uint256 share = 100; // Same share for all
        uint256 totalShares = 0;
        
        for (uint256 i = 0; i < memberCount; i++) {
            shares[i] = share;
            totalShares += share;
        }
        
        (uint256[] memory payouts, uint256 remainder) = SplitLib.calculateSplits(
            netAmount,
            shares,
            totalShares
        );
        
        // All payouts should be equal
        uint256 expectedPayout = netAmount / memberCount;
        for (uint256 i = 0; i < memberCount; i++) {
            assertEq(payouts[i], expectedPayout, "Equal shares should yield equal payouts");
        }
        
        // Remainder should be 0 when divisible
        assertEq(remainder, 0, "Remainder should be 0 when netAmount divisible by memberCount");
    }
}

