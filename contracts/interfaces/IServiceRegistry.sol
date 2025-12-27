// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IServiceRegistry
 * @dev Minimal interface for Pool Protocol to access service information
 * 
 * Pool only needs three things:
 * 1. Provider address (who gets paid)
 * 2. Price (for display/validation, not used in pool pricing)
 * 3. Existence check (validation)
 * 
 * Service-specific features (exclusivity, availability, usage tracking) are handled
 * by the service contract itself, not by the pool.
 * 
 * This minimal interface allows Pool to work with any service type (articles, rentals,
 * future services) without coupling to domain-specific details.
 */
interface IServiceRegistry {
    /**
     * @dev Get minimal service information needed by Pool Protocol
     * @param serviceId The ID of the service
     * @return price Service price (for display/validation, pool has its own price)
     * @return provider Service provider address (who receives revenue share)
     * @return exists Whether the service exists
     */
    function getService(uint256 serviceId)
        external
        view
        returns (
            uint256 price,
            address provider,
            bool exists
        );
}

