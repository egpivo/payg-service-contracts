// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PayAsYouGoBase
 * @dev Base contract for pay-as-you-go services
 * 
 * This contract provides the core functionality that can be inherited by
 * specific service implementations (e.g., ArticleSubscription, VideoStreaming, etc.)
 * 
 * Features:
 * 1. Provider registers service with id and price
 * 2. User pays once (pay-per-use) → usageCount +1
 * 3. Provider withdraws earnings
 */
contract PayAsYouGoBase is Ownable, ReentrancyGuard {
    
    // Custom Errors
    error ServiceDoesNotExist(uint256 serviceId);
    error OnlyProviderCanCall(address caller, address provider);
    error PriceMustBeGreaterThanZero();
    error ServiceIdAlreadyExists(uint256 serviceId);
    error InsufficientPayment(uint256 serviceId, uint256 required, uint256 sent);
    error NoEarningsToWithdraw(address provider);
    error TransferFailed(address recipient, uint256 amount);
    
    // Service structure
    struct Service {
        uint256 id;
        uint256 price;
        address provider;
        uint256 usageCount;
        bool exists;
    }
    
    // Mapping from service ID to Service
    mapping(uint256 => Service) public services;
    
    // Mapping from provider address to their total earnings
    mapping(address => uint256) public earnings;
    
    // Array to track all service IDs
    uint256[] public serviceIds;
    
    // Events
    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, uint256 price);
    event ServiceUsed(uint256 indexed serviceId, address indexed user, uint256 newUsageCount);
    event Withdrawn(address indexed provider, uint256 amount);
    
    /**
     * @dev Constructor that sets the deployer as the initial owner
     */
    constructor() Ownable(msg.sender) {}
    
    // Modifiers
    /**
     * @dev Modifier to check if service exists
     * @param _serviceId The ID of the service to check
     */
    modifier serviceExists(uint256 _serviceId) {
        if (!services[_serviceId].exists) {
            revert ServiceDoesNotExist(_serviceId);
        }
        _;
    }
    
    /**
     * @dev Modifier to check if caller is the provider of a service
     * @param _serviceId The ID of the service
     */
    modifier onlyProvider(uint256 _serviceId) {
        address provider = services[_serviceId].provider;
        if (provider != msg.sender) {
            revert OnlyProviderCanCall(msg.sender, provider);
        }
        _;
    }
    
    /**
     * @dev Modifier to check if price is valid (greater than 0)
     * @param _price The price to validate
     */
    modifier validPrice(uint256 _price) {
        _validPrice(_price);
        _;
    }
    
    /**
     * @dev Internal function to validate price
     * @param _price The price to validate
     */
    function _validPrice(uint256 _price) internal pure {
        if (_price == 0) {
            revert PriceMustBeGreaterThanZero();
        }
    }
    
    /**
     * @dev Register a new service
     * @param _serviceId Unique identifier for the service
     * @param _price Price per use in wei
     * @notice Only service providers or contract owner can register services
     */
    function registerService(uint256 _serviceId, uint256 _price) public virtual validPrice(_price) {
        if (services[_serviceId].exists) {
            revert ServiceIdAlreadyExists(_serviceId);
        }
        
        services[_serviceId] = Service({
            id: _serviceId,
            price: _price,
            provider: msg.sender,
            usageCount: 0,
            exists: true
        });
        
        serviceIds.push(_serviceId);
        
        emit ServiceRegistered(_serviceId, msg.sender, _price);
    }
    
    /**
     * @dev Pay for and use a service (pay-per-use)
     * @param _serviceId The ID of the service to use
     */
    function useService(uint256 _serviceId) public virtual payable serviceExists(_serviceId) {
        Service storage service = services[_serviceId];
        
        if (msg.value < service.price) {
            revert InsufficientPayment(_serviceId, service.price, msg.value);
        }
        
        // Increment usage count
        service.usageCount += 1;
        
        // Calculate actual payment (only charge the service price)
        uint256 actualPayment = service.price;
        
        // Add actual payment to provider's earnings
        earnings[service.provider] += actualPayment;
        
        // Refund excess payment if any
        if (msg.value > service.price) {
            uint256 refundAmount = msg.value - service.price;
            (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
            if (!success) {
                revert TransferFailed(msg.sender, refundAmount);
            }
        }
        
        emit ServiceUsed(_serviceId, msg.sender, service.usageCount);
    }
    
    /**
     * @dev Withdraw earnings for a provider
     * @notice Follows Checks-Effects-Interactions (CEI) pattern to prevent reentrancy
     *         Checks: Verify balance > 0
     *         Effects: Reset earnings to 0
     *         Interactions: Transfer funds
     */
    function withdraw() public virtual nonReentrant {
        // Checks: Verify balance
        uint256 amount = earnings[msg.sender];
        if (amount == 0) {
            revert NoEarningsToWithdraw(msg.sender);
        }
        
        // Effects: Reset earnings before transfer to prevent reentrancy
        earnings[msg.sender] = 0;
        
        // Interactions: Transfer earnings to provider
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed(msg.sender, amount);
        }
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Get total number of registered services
     * @return Total number of services
     */
    function getServiceCount() public view returns (uint256) {
        return serviceIds.length;
    }
    
    /**
     * @dev Get service details
     * @param _serviceId The ID of the service
     * @return id Service ID
     * @return price Service price
     * @return provider Service provider address
     * @return usageCount Number of times service was used
     */
    function getService(uint256 _serviceId) public view serviceExists(_serviceId) returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount
    ) {
        Service memory service = services[_serviceId];
        return (service.id, service.price, service.provider, service.usageCount);
    }
}
