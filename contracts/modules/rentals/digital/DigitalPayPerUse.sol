// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {RentalBase} from "../RentalBase.sol";

/**
 * @title DigitalPayPerUse
 * @dev Pay-per-use digital service rental (SaaS-like)
 * 
 * Pattern: Pay per unit of usage (GPU hours, API credits, tool usage)
 * - Quantity-based billing (not just per-transaction)
 * - No accessExpiry storage writes (saves gas)
 * - Tracking via events for off-chain analytics
 * - Digital services are typically non-exclusive (multiple users simultaneously)
 * 
 * Service-specific layer: Defines concrete behavior for digital service rentals
 * Examples: GPU hours, API credits, cloud compute, tool usage
 */
contract DigitalPayPerUse is RentalBase {
    
    // Mapping from rental ID to price per unit (e.g., price per GPU hour, per API call)
    mapping(uint256 => uint256) public pricePerUnit;
    
    // Mapping from rental ID to unit name (e.g., "GPU hour", "API credit", "compute unit")
    mapping(uint256 => string) public unitName;
    
    // Events
    event DigitalServiceUsed(
        uint256 indexed rentalId, 
        address indexed user, 
        uint256 quantity,
        uint256 totalCost,
        uint256 timestamp
    );
    
    // Custom Errors
    error QuantityMustBeGreaterThanZero();
    error InvalidQuantity(uint256 rentalId, uint256 quantity);
    
    /**
     * @dev List a digital service for rental
     * @param _rentalId Unique identifier for the service
     * @param _pricePerUnit Price per unit of usage (e.g., per GPU hour, per API credit)
     * @param _name Name of the digital service
     * @param _description Description of the service
     * @param _assetHash Hash of the service metadata (for verification)
     * @param _unitName Name of the billing unit (e.g., "GPU hour", "API credit")
     * @notice Digital services are typically non-exclusive (multiple users can use simultaneously)
     */
    function listDigitalService(
        uint256 _rentalId,
        uint256 _pricePerUnit,
        string memory _name,
        string memory _description,
        bytes32 _assetHash,
        string memory _unitName
    ) external {
        // Digital services are non-exclusive by default (multiple users simultaneously)
        _listRental(_rentalId, _pricePerUnit, _name, _description, _assetHash, false);
        
        // Store service-specific pricing data
        pricePerUnit[_rentalId] = _pricePerUnit;
        unitName[_rentalId] = _unitName;
    }
    
    /**
     * @dev Use a digital service (pay-per-unit)
     * @param _rentalId The ID of the service to use
     * @param _quantity Quantity of units to use (e.g., 10 GPU hours, 100 API credits)
     * @notice Pay-per-unit: Pay for the quantity used
     *         Total cost = pricePerUnit * quantity
     *         No storage writes for access expiry (gas efficient)
     *         Digital services are non-exclusive (multiple users can use simultaneously)
     *         Tracking done via event emission for off-chain analytics
     */
    function useDigitalService(uint256 _rentalId, uint256 _quantity) 
        external 
        payable 
        rentalAvailable(_rentalId) 
    {
        if (_quantity == 0) {
            revert QuantityMustBeGreaterThanZero();
        }
        
        uint256 unitPrice = pricePerUnit[_rentalId];
        if (unitPrice == 0) {
            revert RentalDoesNotExist(_rentalId);
        }
        
        // Calculate total cost
        uint256 totalCost = unitPrice * _quantity;
        
        if (msg.value < totalCost) {
            revert InsufficientPayment(_rentalId, totalCost, msg.value);
        }
        
        // Use base contract's registerService pattern but with quantity
        // Increment usage count (represents number of transactions, not units)
        services[_rentalId].usageCount += 1;
        
        // Add payment to provider's earnings
        earnings[services[_rentalId].provider] += totalCost;
        
        // Refund excess payment if any
        if (msg.value > totalCost) {
            uint256 refundAmount = msg.value - totalCost;
            (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
            if (!success) {
                revert TransferFailed(msg.sender, refundAmount);
            }
        }
        
        // Emit service used event
        emit ServiceUsed(_rentalId, msg.sender, services[_rentalId].usageCount);
        
        // Emit detailed digital service event with quantity
        emit DigitalServiceUsed(_rentalId, msg.sender, _quantity, totalCost, block.timestamp);
    }
    
    /**
     * @dev Get service pricing information
     * @param _rentalId The ID of the service
     * @return unitPrice Price per unit
     * @return billingUnitName Name of the billing unit
     */
    function getServicePricing(uint256 _rentalId) 
        external 
        view 
        rentalExists(_rentalId) 
        returns (uint256 unitPrice, string memory billingUnitName) 
    {
        return (pricePerUnit[_rentalId], unitName[_rentalId]);
    }
}

