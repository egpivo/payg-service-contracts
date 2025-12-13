// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccessLib.sol";

contract AccessLibTest {
    function testComputeExpiry(
        uint256 currentExpiry,
        uint256 nowTs,
        uint256 duration
    ) external pure returns (uint256) {
        return AccessLib.computeExpiry(currentExpiry, nowTs, duration);
    }

    function testIsValid(
        uint256 expiry,
        uint256 nowTs
    ) external pure returns (bool) {
        return AccessLib.isValid(expiry, nowTs);
    }
}

