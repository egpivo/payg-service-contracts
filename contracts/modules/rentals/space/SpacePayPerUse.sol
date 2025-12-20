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
     * @param _usageDuration Duration in seconds for exclusive usage (0 = block-level only)
     * @notice Pay-per-use: Pay each time you use the space
     *         No storage writes for access expiry (gas efficient)
     *         For exclusive spaces, marks as in use immediately
     *         If _usageDuration == 0: Block-level exclusivity (prevents same-block concurrent txns)
     *         If _usageDuration > 0: Real time window exclusivity (prevents usage for duration)
     *         Tracking done via event emission for off-chain analytics
     */
    function useSpace(uint256 _rentalId, uint256 _usageDuration) external payable rentalAvailable(_rentalId) {
        Rental memory rental = rentals[_rentalId];
        
        // For exclusive spaces, mark as in use BEFORE payment to prevent concurrent transactions
        // This ensures exclusivity is enforced even for pay-per-use
        if (rental.exclusive) {
            uint256 exclusiveUntil;
            if (_usageDuration == 0) {
                // Block-level only: prevents concurrent transactions in same block
                exclusiveUntil = block.timestamp + 1;
            } else {
                // Real time window: prevents usage for specified duration
                exclusiveUntil = block.timestamp + _usageDuration;
            }
            _startExclusiveRental(_rentalId, msg.sender, exclusiveUntil);
        }
        
        // Use base contract's useService (pay-per-use)
        useService(_rentalId);
        
        // Emit event with timestamp for off-chain tracking
        emit SpaceUsed(_rentalId, msg.sender, block.timestamp);
    }
}

