// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PayAsYouGoBase} from "../../core/PayAsYouGoBase.sol";
import {IRentalRegistry} from "./IRentalRegistry.sol";

/**
 * @title RentalBase
 * @dev Abstract base contract for rental services (Domain Layer)
 * 
 * Provides domain-specific semantics for rentals:
 * - Asset metadata and identification
 * - Availability management
 * - Exclusivity tracking (can multiple users use simultaneously?)
 * 
 * This layer introduces business meaning but does not define payment patterns.
 * Service-specific contracts (space/, equipment/) implement concrete payment and access logic.
 * 
 * Design Philosophy:
 * - Domain layer focuses on "what is being rented" and "who can use it"
 * - Core layer handles "how payment works"
 * - Service layer defines "when and how access is granted"
 */
abstract contract RentalBase is PayAsYouGoBase, IRentalRegistry {
    
    /**
     * @dev Implementation of IRentalRegistry interface
     * @notice Wraps the services mapping to match the interface signature
     *         Can be overridden by child contracts to use external registry
     */
    function getRentalService(uint256 _rentalId) external view virtual override returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount,
        bool exists
    ) {
        Service memory service = services[_rentalId];
        return (
            service.id,
            service.price,
            service.provider,
            service.usageCount,
            service.exists
        );
    }
    
    /**
     * @dev Rental structure - domain semantics
     * @notice This defines what a rental is, not how it's paid for or accessed
     */
    struct Rental {
        uint256 rentalId;
        string name;
        string description;
        bytes32 assetHash; // Hash of asset metadata (for verification)
        uint256 listDate;
        bool available; // Whether the rental is currently available for listing
        bool exclusive; // If true, only one user can use at a time (e.g., physical space)
                        // If false, multiple users can use simultaneously (e.g., digital equipment)
    }
    
    // Mapping from rental ID to Rental
    mapping(uint256 => Rental) public rentals;
    
    // For exclusive rentals: track current user and expiry
    // For non-exclusive rentals: this is not used (multiple users can access)
    mapping(uint256 => address) public currentRenter; // rentalId => current renter (exclusive only)
    mapping(uint256 => uint256) public exclusiveUntil; // rentalId => timestamp when exclusivity ends
    
    // Events
    event RentalListed(uint256 indexed rentalId, string name, address indexed owner, bool exclusive);
    event RentalAvailabilityChanged(uint256 indexed rentalId, bool available);
    event ExclusiveRentalStarted(uint256 indexed rentalId, address indexed renter, uint256 until);
    event ExclusiveRentalEnded(uint256 indexed rentalId, address indexed renter);
    
    // Custom Errors
    error RentalDoesNotExist(uint256 rentalId);
    error RentalDataNotFound(uint256 rentalId);
    error RentalAlreadyListed(uint256 rentalId);
    error RentalNotAvailable(uint256 rentalId);
    error RentalCurrentlyExclusive(uint256 rentalId, address currentRenter, uint256 until);
    
    // Modifiers
    /**
     * @dev Modifier to check if rental exists
     * @param _rentalId The ID of the rental to check
     * @notice Checks both service registration and rental data to ensure consistency
     */
    modifier rentalExists(uint256 _rentalId) {
        _rentalExists(_rentalId);
        _;
    }
    
    /**
     * @dev Internal function to check if rental exists
     * @param _rentalId The ID of the rental to check
     */
    function _rentalExists(uint256 _rentalId) internal view {
        if (!services[_rentalId].exists) {
            revert RentalDoesNotExist(_rentalId);
        }
        if (rentals[_rentalId].listDate == 0) {
            revert RentalDataNotFound(_rentalId);
        }
    }
    
    /**
     * @dev Modifier to check if rental is available
     * @param _rentalId The ID of the rental to check
     * @notice For exclusive rentals, also checks if currently in use
     */
    modifier rentalAvailable(uint256 _rentalId) {
        _rentalAvailable(_rentalId);
        _;
    }
    
    /**
     * @dev Internal function to check if rental is available
     * @param _rentalId The ID of the rental to check
     * @notice For exclusive rentals, checks if currently rented by someone else
     *         For pay-per-use: checks currentRenter (must be address(0) or msg.sender)
     *         For subscription: checks exclusiveUntil timestamp
     *         Automatically clears expired exclusivity and emits ExclusiveRentalEnded event
     */
    function _rentalAvailable(uint256 _rentalId) internal {
        _rentalExists(_rentalId);
        
        Rental memory rental = rentals[_rentalId];
        if (!rental.available) {
            revert RentalNotAvailable(_rentalId);
        }
        
        // For exclusive rentals, check if currently in use
        if (rental.exclusive) {
            address renter = currentRenter[_rentalId];
            uint256 until = exclusiveUntil[_rentalId];
            
            // Clear expired exclusivity (prevents stale state and emits end event)
            if (renter != address(0) && until > 0 && until <= block.timestamp) {
                _endExclusiveRental(_rentalId);
                // Re-read after clearing
                renter = currentRenter[_rentalId];
                until = exclusiveUntil[_rentalId];
            }
            
            // Block if there's an active renter (not the current caller) and exclusivity hasn't expired
            if (renter != address(0) && renter != msg.sender && until > block.timestamp) {
                revert RentalCurrentlyExclusive(_rentalId, renter, until);
            }
        }
    }
    
    /**
     * @dev Internal function to list a rental (domain semantics only)
     * @param _rentalId Unique identifier for the rental
     * @param _price Price to rent the asset (passed to core layer)
     * @param _name Name of the rental asset
     * @param _description Description of the rental asset
     * @param _assetHash Hash of the asset metadata (for verification)
     * @param _exclusive Whether rental is exclusive (only one user at a time)
     * @notice This is an internal function that child contracts should call from their public listRental
     *         Only service providers or contract owner can list rentals
     *         Payment patterns and access duration are handled by service-specific contracts
     */
    function _listRental(
        uint256 _rentalId,
        uint256 _price,
        string memory _name,
        string memory _description,
        bytes32 _assetHash,
        bool _exclusive
    ) internal {
        // Prevent duplicate listing
        if (rentals[_rentalId].listDate != 0) {
            revert RentalAlreadyListed(_rentalId);
        }
        
        // Use base contract's registerService (core layer handles payment registration)
        registerService(_rentalId, _price);
        
        // Store rental-specific data (domain layer semantics)
        rentals[_rentalId] = Rental({
            rentalId: _rentalId,
            name: _name,
            description: _description,
            assetHash: _assetHash,
            listDate: block.timestamp,
            available: true,
            exclusive: _exclusive
        });
        
        emit RentalListed(_rentalId, _name, msg.sender, _exclusive);
    }
    
    /**
     * @dev Update rental availability
     * @param _rentalId The ID of the rental
     * @param _available Whether the rental is available for new rentals
     * @notice Only the rental owner can update availability
     *         Does not affect currently active rentals
     */
    function setRentalAvailability(uint256 _rentalId, bool _available) 
        external 
        rentalExists(_rentalId) 
        onlyProvider(_rentalId) 
    {
        rentals[_rentalId].available = _available;
        emit RentalAvailabilityChanged(_rentalId, _available);
    }
    
    /**
     * @dev Mark exclusive rental as in use
     * @param _rentalId The ID of the rental
     * @param _renter The address of the renter
     * @param _until Timestamp when exclusivity ends
     * @notice Internal function for service-specific contracts to mark exclusive rentals
     */
    function _startExclusiveRental(uint256 _rentalId, address _renter, uint256 _until) internal {
        require(rentals[_rentalId].exclusive, "Rental is not exclusive");
        currentRenter[_rentalId] = _renter;
        exclusiveUntil[_rentalId] = _until;
        emit ExclusiveRentalStarted(_rentalId, _renter, _until);
    }
    
    /**
     * @dev End exclusive rental (when access expires or is returned early)
     * @param _rentalId The ID of the rental
     * @notice Internal function for service-specific contracts to end exclusive rentals
     */
    function _endExclusiveRental(uint256 _rentalId) internal {
        address renter = currentRenter[_rentalId];
        if (renter != address(0)) {
            currentRenter[_rentalId] = address(0);
            exclusiveUntil[_rentalId] = 0;
            emit ExclusiveRentalEnded(_rentalId, renter);
        }
    }
    
    /**
     * @dev Get rental details (domain layer view)
     * @param _rentalId The ID of the rental
     * @return rentalId Rental ID
     * @return name Rental name
     * @return description Rental description
     * @return assetHash Asset hash
     * @return listDate List timestamp
     * @return exclusive Whether rental is exclusive
     * @return available Whether rental is available
     * @return price Price to rent (from core layer)
     * @return provider Rental owner address
     * @return usageCount Number of times rental was used (from core layer)
     * @return currentRenterAddr Current renter if exclusive (address(0) if none)
     * @return exclusiveUntilTs Timestamp when exclusivity ends (0 if not exclusive or not in use)
     */
    function getRental(uint256 _rentalId) external view rentalExists(_rentalId) returns (
        uint256 rentalId,
        string memory name,
        string memory description,
        bytes32 assetHash,
        uint256 listDate,
        bool exclusive,
        bool available,
        uint256 price,
        address provider,
        uint256 usageCount,
        address currentRenterAddr,
        uint256 exclusiveUntilTs
    ) {
        Rental memory rental = rentals[_rentalId];
        (, uint256 servicePrice, address serviceProvider, uint256 usage) = getService(_rentalId);
        
        return (
            rental.rentalId,
            rental.name,
            rental.description,
            rental.assetHash,
            rental.listDate,
            rental.exclusive,
            rental.available,
            servicePrice,
            serviceProvider,
            usage,
            currentRenter[_rentalId],
            exclusiveUntil[_rentalId]
        );
    }
}

