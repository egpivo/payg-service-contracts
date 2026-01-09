// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IRentalRegistry
 * @dev Interface for accessing rental information from rental contracts
 * 
 * This interface allows RentalBundle to access rental data without
 * directly depending on specific rental contract implementations.
 * 
 * Note: Uses getRentalService() to avoid conflict with PayAsYouGoBase.services mapping
 */
interface IRentalRegistry {
    /**
     * @dev Get service information for a rental
     * @param _rentalId The ID of the rental
     * @return id Service ID
     * @return price Service price
     * @return provider Service provider address
     * @return usageCount Number of times service was used
     * @return exists Whether the service exists
     */
    function getRentalService(uint256 _rentalId) external view returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount,
        bool exists
    );
}














