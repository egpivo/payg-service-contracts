// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IServiceRegistry
 * @dev Generic interface for accessing service information
 * 
 * This interface allows PoolRegistry to work with any service type (articles, rentals, etc.)
 * without being coupled to specific implementations.
 * 
 * Pool only needs to know:
 * - price(serviceId) - for pricing
 * - provider(serviceId) - for revenue distribution
 * - exists(serviceId) - for validation
 * 
 * Service-specific features (like exclusivity, availability) are handled by the service
 * contract itself, not by the pool.
 */
interface IServiceRegistry {
    /**
     * @dev Get service information
     * @param _serviceId The ID of the service
     * @return id Service ID
     * @return price Service price
     * @return provider Service provider address
     * @return usageCount Number of times service was used
     * @return exists Whether the service exists
     */
    function getServiceInfo(uint256 _serviceId) external view returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount,
        bool exists
    );
}

