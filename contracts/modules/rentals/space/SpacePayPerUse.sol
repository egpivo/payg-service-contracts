// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {RentalBase} from "../RentalBase.sol";

/**
 * @title SpacePayPerUse
 * @dev Pay-per-use space rental service (gas efficient)
 * 
 * Pattern: Pay each time you use the space
 * - No accessExpiry storage writes (saves gas)
 * - Tracking via events for off-chain analytics
 * - Spaces are typically exclusive (one user at a time)
 * 
 * Service-specific layer: Defines concrete behavior for space rentals
 */
contract SpacePayPerUse is RentalBase {
    
    // Events
    event SpaceUsed(uint256 indexed rentalId, address indexed renter, uint256 timestamp);
    
    /**
     * @dev List a space for rental
     * @param _rentalId Unique identifier for the space
     * @param _price Price to use the space
     * @param _name Name of the space
     * @param _description Description of the space
     * @param _assetHash Hash of the space metadata (for verification)
     * @notice Spaces are typically exclusive (one user at a time)
     */
    function listSpace(
        uint256 _rentalId,
        uint256 _price,
        string memory _name,
        string memory _description,
        bytes32 _assetHash
    ) external {
        // Spaces are exclusive by default (one user at a time)
        _listRental(_rentalId, _price, _name, _description, _assetHash, true);
    }
    
    /**
     * @dev Use a space (pay-per-use)
     * @param _rentalId The ID of the space to use
     * @notice Pay-per-use: Pay each time you use the space
     *         No storage writes for access expiry (gas efficient)
     *         For exclusive spaces, marks as in use immediately
     *         Tracking done via event emission for off-chain analytics
     */
    function useSpace(uint256 _rentalId) external payable rentalAvailable(_rentalId) {
        // Use base contract's useService (pay-per-use)
        useService(_rentalId);
        
        // For exclusive spaces, mark as in use (until end of block or custom logic)
        // Note: For pay-per-use, exclusivity is typically per-transaction
        // Service-specific logic can extend this if needed
        Rental memory rental = rentals[_rentalId];
        if (rental.exclusive) {
            // Mark as exclusive for this block (or extend as needed)
            _startExclusiveRental(_rentalId, msg.sender, block.timestamp);
        }
        
        // Emit event with timestamp for off-chain tracking
        emit SpaceUsed(_rentalId, msg.sender, block.timestamp);
    }
}

