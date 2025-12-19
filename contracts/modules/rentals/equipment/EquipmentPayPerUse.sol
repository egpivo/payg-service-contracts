// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {RentalBase} from "../RentalBase.sol";

/**
 * @title EquipmentPayPerUse
 * @dev Pay-per-use equipment rental service (gas efficient)
 * 
 * Pattern: Pay each time you use the equipment
 * - No accessExpiry storage writes (saves gas)
 * - Tracking via events for off-chain analytics
 * - Equipment can be non-exclusive (multiple users can use simultaneously)
 * 
 * Service-specific layer: Defines concrete behavior for equipment rentals
 */
contract EquipmentPayPerUse is RentalBase {
    
    // Events
    event EquipmentUsed(uint256 indexed rentalId, address indexed renter, uint256 timestamp);
    
    /**
     * @dev List equipment for rental
     * @param _rentalId Unique identifier for the equipment
     * @param _price Price to use the equipment
     * @param _name Name of the equipment
     * @param _description Description of the equipment
     * @param _assetHash Hash of the equipment metadata (for verification)
     * @param _exclusive Whether equipment is exclusive (false for digital/shared equipment)
     * @notice Equipment can be exclusive (physical) or non-exclusive (digital/shared)
     */
    function listEquipment(
        uint256 _rentalId,
        uint256 _price,
        string memory _name,
        string memory _description,
        bytes32 _assetHash,
        bool _exclusive
    ) external {
        _listRental(_rentalId, _price, _name, _description, _assetHash, _exclusive);
    }
    
    /**
     * @dev Use equipment (pay-per-use)
     * @param _rentalId The ID of the equipment to use
     * @notice Pay-per-use: Pay each time you use the equipment
     *         No storage writes for access expiry (gas efficient)
     *         For exclusive equipment, marks as in use immediately
     *         For non-exclusive equipment, multiple users can use simultaneously
     *         Tracking done via event emission for off-chain analytics
     */
    function useEquipment(uint256 _rentalId) external payable rentalAvailable(_rentalId) {
        // Use base contract's useService (pay-per-use)
        useService(_rentalId);
        
        // For exclusive equipment, mark as in use (until end of block or custom logic)
        Rental memory rental = rentals[_rentalId];
        if (rental.exclusive) {
            // Mark as exclusive for this block (or extend as needed)
            _startExclusiveRental(_rentalId, msg.sender, block.timestamp);
        }
        // For non-exclusive equipment, no exclusivity tracking needed
        
        // Emit event with timestamp for off-chain tracking
        emit EquipmentUsed(_rentalId, msg.sender, block.timestamp);
    }
}

