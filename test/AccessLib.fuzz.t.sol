// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {AccessLib} from "../contracts/AccessLib.sol";

contract AccessLibFuzzTest is Test {
    function testFuzz_computeExpiry_durationZero_alwaysReturnsMax(uint256 currentExpiry, uint256 nowTs) public pure {
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, 0);
        assertEq(expiry, type(uint256).max);
    }

    function testFuzz_computeExpiry_newPurchase_startsFromNow(uint256 nowTs, uint256 duration) public pure {
        duration = bound(duration, 1, type(uint256).max);
        vm.assume(nowTs <= type(uint256).max - duration);
        
        uint256 expiry = AccessLib.computeExpiry(0, nowTs, duration);
        assertEq(expiry, nowTs + duration);
    }

    function testFuzz_computeExpiry_renewal_extendsFromCurrentExpiry(
        uint256 currentExpiry,
        uint256 nowTs,
        uint256 duration
    ) public pure {
        vm.assume(currentExpiry > nowTs && currentExpiry > 0);
        duration = bound(duration, 1, type(uint256).max);
        vm.assume(currentExpiry <= type(uint256).max - duration);
        
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        assertEq(expiry, currentExpiry + duration);
    }

    function testFuzz_computeExpiry_expired_startsFromNow(
        uint256 currentExpiry,
        uint256 nowTs,
        uint256 duration
    ) public pure {
        vm.assume(nowTs > currentExpiry && currentExpiry > 0);
        duration = bound(duration, 1, type(uint256).max);
        vm.assume(nowTs <= type(uint256).max - duration);
        
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        assertEq(expiry, nowTs + duration);
    }

    function testFuzz_isValid_neverPurchased_alwaysFalse(uint256 nowTs) public pure {
        bool valid = AccessLib.isValid(0, nowTs);
        assertFalse(valid);
    }

    function testFuzz_isValid_permanentAccess_alwaysTrue(uint256 nowTs) public pure {
        bool valid = AccessLib.isValid(type(uint256).max, nowTs);
        assertTrue(valid);
    }

    function testFuzz_isValid_beforeExpiry_returnsTrue(uint256 expiry, uint256 nowTs) public pure {
        vm.assume(expiry > nowTs && expiry != type(uint256).max && expiry > 0);
        
        bool valid = AccessLib.isValid(expiry, nowTs);
        assertTrue(valid);
    }

    function testFuzz_isValid_afterExpiry_returnsFalse(uint256 expiry, uint256 nowTs) public pure {
        vm.assume(nowTs > expiry && expiry != type(uint256).max && expiry > 0);
        
        bool valid = AccessLib.isValid(expiry, nowTs);
        assertFalse(valid);
    }

    function testFuzz_isValid_atExpiry_returnsTrue(uint256 expiry) public pure {
        vm.assume(expiry != type(uint256).max);
        vm.assume(expiry > 0);
        
        bool valid = AccessLib.isValid(expiry, expiry);
        assertTrue(valid);
    }

    function testFuzz_computeExpiry_invariants(
        uint256 currentExpiry,
        uint256 nowTs,
        uint256 duration
    ) public pure {
        duration = bound(duration, 0, type(uint256).max);
        vm.assume(nowTs <= type(uint256).max - duration);
        if (currentExpiry > nowTs) {
            vm.assume(currentExpiry <= type(uint256).max - duration);
        }
        
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        
        if (duration == 0) {
            assertEq(expiry, type(uint256).max);
        } else {
            assertGe(expiry, nowTs);
        }
        
        if (currentExpiry > 0 && currentExpiry > nowTs && duration > 0) {
            assertGe(expiry, currentExpiry);
        }
    }
}

