// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
contract PayAsYouGoBase {
    
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
     * @dev Register a new service
     * @param _serviceId Unique identifier for the service
     * @param _price Price per use in wei
     */
    function registerService(uint256 _serviceId, uint256 _price) public virtual {
        require(_price > 0, "Price must be greater than 0");
        require(!services[_serviceId].exists, "Service ID already exists");
        
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
    function useService(uint256 _serviceId) public virtual payable {
        Service storage service = services[_serviceId];
        
        require(service.exists, "Service does not exist");
        require(msg.value >= service.price, "Insufficient payment");
        
        // Increment usage count
        service.usageCount += 1;
        
        // Add payment to provider's earnings
        earnings[service.provider] += msg.value;
        
        // Refund excess payment if any
        if (msg.value > service.price) {
            payable(msg.sender).transfer(msg.value - service.price);
        }
        
        emit ServiceUsed(_serviceId, msg.sender, service.usageCount);
    }
    
    /**
     * @dev Withdraw earnings for a provider
     */
    function withdraw() public virtual {
        uint256 amount = earnings[msg.sender];
        require(amount > 0, "No earnings to withdraw");
        
        // Reset earnings before transfer to prevent reentrancy
        earnings[msg.sender] = 0;
        
        // Transfer earnings to provider
        payable(msg.sender).transfer(amount);
        
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
    function getService(uint256 _serviceId) public view returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount
    ) {
        Service memory service = services[_serviceId];
        require(service.exists, "Service does not exist");
        
        return (service.id, service.price, service.provider, service.usageCount);
    }
}
