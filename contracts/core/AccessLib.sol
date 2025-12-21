// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AccessLib
 * @dev Library for managing access expiry and validation
 */
library AccessLib {
    /**
     * @dev Compute access expiry time
     * @notice If currentExpiry > 0 and not expired, extends from current expiry.
     *         Otherwise, starts from now. If duration is 0, returns max uint256 (permanent).
     */
    function computeExpiry(
        uint256 currentExpiry,
        uint256 nowTs,
        uint256 duration
    ) internal pure returns (uint256 expiry) {
        if (duration == 0) {
            return type(uint256).max;
        }
        
        if (currentExpiry > 0 && currentExpiry > nowTs) {
            return currentExpiry + duration;
        } else {
            return nowTs + duration;
        }
    }
    
    /**
     * @dev Check if access is valid
     * @notice Returns false if expiry is 0 (never purchased).
     *         Returns true if expiry is max uint256 (permanent access).
     */
    function isValid(uint256 expiry, uint256 nowTs) internal pure returns (bool) {
        if (expiry == 0) {
            return false;
        }
        if (expiry == type(uint256).max) {
            return true;
        }
        return nowTs <= expiry;
    }
}
