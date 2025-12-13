// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AccessLib
 * @dev Library for managing access expiry and validation
 * 
 * Provides reusable functions for computing expiry times and validating access,
 * handling edge cases like permanent access (max uint256) and never purchased (0).
 * 
 * This library is designed to be used by any service that needs time-based access control,
 * not just article services.
 */
library AccessLib {
    /**
     * @dev Compute access expiry time
     * @param currentExpiry Current expiry timestamp (0 if never purchased)
     * @param nowTs Current block timestamp
     * @param duration Access duration in seconds (0 = permanent access)
     * @return expiry Computed expiry timestamp
     * @notice If currentExpiry > 0 and not expired, extends from current expiry
     *         Otherwise, starts from now. If duration is 0, returns max uint256 (permanent)
     */
    function computeExpiry(
        uint256 currentExpiry,
        uint256 nowTs,
        uint256 duration
    ) internal pure returns (uint256 expiry) {
        if (duration == 0) {
            // Permanent access
            return type(uint256).max;
        }
        
        if (currentExpiry > 0 && currentExpiry > nowTs) {
            // Renewal: extend from current expiry
            return currentExpiry + duration;
        } else {
            // New purchase or expired: start from now
            return nowTs + duration;
        }
    }
    
    /**
     * @dev Check if access is valid
     * @param expiry Expiry timestamp (0 = never purchased, max uint256 = permanent)
     * @param nowTs Current block timestamp
     * @return True if access is valid
     * @notice Returns false if expiry is 0 (never purchased)
     *         Returns true if expiry is max uint256 (permanent access)
     *         Otherwise checks if current time is before expiry
     */
    function isValid(uint256 expiry, uint256 nowTs) internal pure returns (bool) {
        if (expiry == 0) {
            // Never purchased
            return false;
        }
        if (expiry == type(uint256).max) {
            // Permanent access
            return true;
        }
        // Time-limited access: check if not expired
        return nowTs <= expiry;
    }
}

