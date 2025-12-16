// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {AccessLib} from "../contracts/AccessLib.sol";

contract AccessLibTest is Test {
    using AccessLib for uint256;

    function test_computeExpiry_durationZero_returnsMaxUint256() public {
        uint256 currentExpiry = 0;
        uint256 nowTs = 1000;
        uint256 duration = 0;

        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        assertEq(expiry, type(uint256).max);
    }

    function test_computeExpiry_newPurchase_startsFromNow() public {
        uint256 currentExpiry = 0;
        uint256 nowTs = 1000;
        uint256 duration = 86400; // 1 day

        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        assertEq(expiry, nowTs + duration);
    }

    function test_computeExpiry_renewal_extendsFromCurrentExpiry() public {
        uint256 currentExpiry = 2000; // Already has access until 2000
        uint256 nowTs = 1500; // Current time is 1500 (before expiry)
        uint256 duration = 86400; // 1 day

        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        assertEq(expiry, currentExpiry + duration); // Should extend from 2000
    }

    function test_computeExpiry_expired_startsFromNow() public {
        uint256 currentExpiry = 1000; // Expired at 1000
        uint256 nowTs = 2000; // Current time is 2000 (after expiry)
        uint256 duration = 86400; // 1 day

        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        assertEq(expiry, nowTs + duration); // Should start from now, not extend
    }

    function test_computeExpiry_renewalAtExpiryBoundary() public {
        uint256 currentExpiry = 2000;
        uint256 nowTs = 2000; // Exactly at expiry
        uint256 duration = 86400;

        uint256 expiry = AccessLib.computeExpiry(currentExpiry, nowTs, duration);
        // Since currentExpiry is not > nowTs, it should start from now
        assertEq(expiry, nowTs + duration);
    }

    function test_isValid_neverPurchased_returnsFalse() public {
        uint256 expiry = 0;
        uint256 nowTs = 1000;

        bool valid = AccessLib.isValid(expiry, nowTs);
        assertFalse(valid);
    }

    function test_isValid_permanentAccess_returnsTrue() public {
        uint256 expiry = type(uint256).max;
        uint256 nowTs = 1000;

        bool valid = AccessLib.isValid(expiry, nowTs);
        assertTrue(valid);
    }

    function test_isValid_beforeExpiry_returnsTrue() public {
        uint256 expiry = 2000;
        uint256 nowTs = 1500;

        bool valid = AccessLib.isValid(expiry, nowTs);
        assertTrue(valid);
    }

    function test_isValid_atExpiry_returnsTrue() public {
        uint256 expiry = 2000;
        uint256 nowTs = 2000;

        bool valid = AccessLib.isValid(expiry, nowTs);
        assertTrue(valid);
    }

    function test_isValid_afterExpiry_returnsFalse() public {
        uint256 expiry = 2000;
        uint256 nowTs = 2001;

        bool valid = AccessLib.isValid(expiry, nowTs);
        assertFalse(valid);
    }
}

