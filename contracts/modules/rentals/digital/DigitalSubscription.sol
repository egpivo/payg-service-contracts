// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {RentalBase} from "../RentalBase.sol";
import {AccessLib} from "../../../core/AccessLib.sol";

/**
 * @title DigitalSubscription
 * @dev Subscription-based digital service rental (credit-based or time-based)
 * 
 * Pattern: Purchase credits or time-based access, then use without per-use payment
 * - Credit-based: Buy credits, consume on use
 * - Time-based: Buy access period, unlimited use during period
 * - Digital services are non-exclusive (multiple users simultaneously)
 * 
 * Service-specific layer: Defines concrete behavior for digital subscription rentals
 * Examples: Monthly GPU quota, API credit packages, tool access subscriptions
 */
contract DigitalSubscription is RentalBase {
    
    // Mapping from rental ID to subscription type
    enum SubscriptionType {
        CreditBased,  // User buys credits, consumes on use
        TimeBased     // User buys time period, unlimited use during period
    }
    
    // Mapping from rental ID to subscription type
    mapping(uint256 => SubscriptionType) public subscriptionType;
    
    // Mapping from rental ID to price per credit (for credit-based)
    mapping(uint256 => uint256) public pricePerCredit;
    
    // Mapping from rental ID to access duration (for time-based, 0 = permanent)
    mapping(uint256 => uint256) public accessDuration;
    
    // For credit-based subscriptions: user => rentalId => credits remaining
    mapping(address => mapping(uint256 => uint256)) public creditsRemaining;
    
    // For time-based subscriptions: user => rentalId => access expiry
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    
    // Events
    event DigitalServiceSubscribed(
        uint256 indexed rentalId,
        address indexed subscriber,
        SubscriptionType subType,
        uint256 creditsOrExpiry,
        uint256 timestamp
    );
    event DigitalServiceUsed(
        uint256 indexed rentalId,
        address indexed user,
        uint256 quantity,
        uint256 creditsConsumed,
        uint256 timestamp
    );
    event CreditsPurchased(
        uint256 indexed rentalId,
        address indexed buyer,
        uint256 credits,
        uint256 totalCost
    );
    
    // Custom Errors
    error InvalidSubscriptionType(uint256 rentalId);
    error InsufficientCredits(address user, uint256 rentalId, uint256 required, uint256 available);
    error AccessNotGranted(address user, uint256 rentalId);
    error AccessExpired(address user, uint256 rentalId, uint256 expiry, uint256 currentTime);
    error QuantityMustBeGreaterThanZero();
    
    /**
     * @dev Modifier to check if user has valid access (time-based)
     * @param _rentalId The ID of the rental
     */
    modifier withinAccessPeriod(uint256 _rentalId) {
        _withinAccessPeriod(_rentalId);
        _;
    }
    
    /**
     * @dev Internal function to check if user's access is still valid (time-based)
     * @param _rentalId The ID of the rental
     */
    function _withinAccessPeriod(uint256 _rentalId) internal view {
        if (subscriptionType[_rentalId] != SubscriptionType.TimeBased) {
            return; // Credit-based doesn't use this check
        }
        
        uint256 expiry = accessExpiry[msg.sender][_rentalId];
        if (expiry == 0) {
            revert AccessNotGranted(msg.sender, _rentalId);
        }
        if (block.timestamp > expiry) {
            revert AccessExpired(msg.sender, _rentalId, expiry, block.timestamp);
        }
    }
    
    /**
     * @dev List a digital service for subscription
     * @param _rentalId Unique identifier for the service
     * @param _price Price for subscription (per credit pack or per time period)
     * @param _name Name of the digital service
     * @param _description Description of the service
     * @param _assetHash Hash of the service metadata (for verification)
     * @param _subType Subscription type (CreditBased or TimeBased)
     * @param _pricePerCredit Price per credit (for credit-based, 0 if time-based)
     * @param _accessDuration Access duration in seconds (for time-based, 0 = permanent, ignored if credit-based)
     * @notice Digital services are non-exclusive (multiple users can use simultaneously)
     */
    function listDigitalService(
        uint256 _rentalId,
        uint256 _price,
        string memory _name,
        string memory _description,
        bytes32 _assetHash,
        SubscriptionType _subType,
        uint256 _pricePerCredit,
        uint256 _accessDuration
    ) external {
        // Digital services are non-exclusive by default
        _listRental(_rentalId, _price, _name, _description, _assetHash, false);
        
        subscriptionType[_rentalId] = _subType;
        
        if (_subType == SubscriptionType.CreditBased) {
            pricePerCredit[_rentalId] = _pricePerCredit;
        } else {
            accessDuration[_rentalId] = _accessDuration;
        }
    }
    
    /**
     * @dev Subscribe to a digital service (credit-based or time-based)
     * @param _rentalId The ID of the service to subscribe to
     * @param _creditsOrDuration For credit-based: number of credits to purchase. For time-based: ignored (uses listing duration)
     * @notice Credit-based: Purchases credits that can be consumed on use
     *         Time-based: Purchases access period, unlimited use during period
     */
    function subscribeToService(uint256 _rentalId, uint256 _creditsOrDuration) 
        external 
        payable 
        rentalAvailable(_rentalId) 
    {
        SubscriptionType subType = subscriptionType[_rentalId];
        
        if (subType == SubscriptionType.CreditBased) {
            if (_creditsOrDuration == 0) {
                revert QuantityMustBeGreaterThanZero();
            }
            
            uint256 unitPrice = pricePerCredit[_rentalId];
            uint256 totalCost = unitPrice * _creditsOrDuration;
            
            if (msg.value < totalCost) {
                revert InsufficientPayment(_rentalId, totalCost, msg.value);
            }
            
            // Add credits to user's balance
            creditsRemaining[msg.sender][_rentalId] += _creditsOrDuration;
            
            // Increment usage count and add to earnings
            services[_rentalId].usageCount += 1;
            earnings[services[_rentalId].provider] += totalCost;
            
            // Refund excess
            if (msg.value > totalCost) {
                uint256 refundAmount = msg.value - totalCost;
                (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
                if (!success) {
                    revert TransferFailed(msg.sender, refundAmount);
                }
            }
            
            emit ServiceUsed(_rentalId, msg.sender, services[_rentalId].usageCount);
            emit CreditsPurchased(_rentalId, msg.sender, _creditsOrDuration, totalCost);
            emit DigitalServiceSubscribed(_rentalId, msg.sender, subType, creditsRemaining[msg.sender][_rentalId], block.timestamp);
            
        } else { // TimeBased
            uint256 duration = accessDuration[_rentalId];
            uint256 currentExpiry = accessExpiry[msg.sender][_rentalId];
            uint256 expiry = AccessLib.computeExpiry(currentExpiry, block.timestamp, duration);
            
            // Pay for subscription
            useService(_rentalId);
            
            // Set access expiry
            accessExpiry[msg.sender][_rentalId] = expiry;
            
            // Refund excess
            uint256 price = services[_rentalId].price;
            if (msg.value > price) {
                uint256 refundAmount = msg.value - price;
                (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
                if (!success) {
                    revert TransferFailed(msg.sender, refundAmount);
                }
            }
            
            emit DigitalServiceSubscribed(_rentalId, msg.sender, subType, expiry, block.timestamp);
        }
    }
    
    /**
     * @dev Use digital service after subscription (consume credits or check time access)
     * @param _rentalId The ID of the service to use
     * @param _quantity Quantity of units to use (e.g., 10 GPU hours, 100 API credits)
     * @notice Credit-based: Consumes credits from user's balance
     *         Time-based: Checks if within access period (no credit consumption)
     */
    function useDigitalService(uint256 _rentalId, uint256 _quantity) 
        external 
        rentalExists(_rentalId) 
    {
        if (_quantity == 0) {
            revert QuantityMustBeGreaterThanZero();
        }
        
        SubscriptionType subType = subscriptionType[_rentalId];
        
        if (subType == SubscriptionType.CreditBased) {
            // Check and consume credits
            uint256 credits = creditsRemaining[msg.sender][_rentalId];
            if (credits < _quantity) {
                revert InsufficientCredits(msg.sender, _rentalId, _quantity, credits);
            }
            
            creditsRemaining[msg.sender][_rentalId] = credits - _quantity;
            
            emit DigitalServiceUsed(_rentalId, msg.sender, _quantity, _quantity, block.timestamp);
            
        } else { // TimeBased
            // Check access period
            _withinAccessPeriod(_rentalId);
            
            // No credit consumption for time-based
            emit DigitalServiceUsed(_rentalId, msg.sender, _quantity, 0, block.timestamp);
        }
    }
    
    /**
     * @dev Check if user has valid access
     * @param _user User address
     * @param _rentalId Service ID
     * @return True if user has valid access (credits available or within time period)
     */
    function hasValidAccess(address _user, uint256 _rentalId) external view returns (bool) {
        SubscriptionType subType = subscriptionType[_rentalId];
        
        if (subType == SubscriptionType.CreditBased) {
            return creditsRemaining[_user][_rentalId] > 0;
        } else {
            return AccessLib.isValid(accessExpiry[_user][_rentalId], block.timestamp);
        }
    }
    
    /**
     * @dev Get user's remaining credits (credit-based) or access expiry (time-based)
     * @param _user User address
     * @param _rentalId Service ID
     * @return For credit-based: remaining credits. For time-based: access expiry timestamp
     */
    function getUserAccess(address _user, uint256 _rentalId) external view returns (uint256) {
        SubscriptionType subType = subscriptionType[_rentalId];
        
        if (subType == SubscriptionType.CreditBased) {
            return creditsRemaining[_user][_rentalId];
        } else {
            return accessExpiry[_user][_rentalId];
        }
    }
}

