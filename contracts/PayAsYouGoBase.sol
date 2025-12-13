// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title PayAsYouGoBase
 * @dev Base contract for pay-as-you-go services
 */
contract PayAsYouGoBase {
    
    struct Service {
        uint256 id;
        uint256 price;
        address provider;
        uint256 usageCount;
        bool exists;
    }
    
    mapping(uint256 => Service) public services;
    mapping(address => uint256) public earnings;
    uint256[] public serviceIds;
    
    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, uint256 price);
    event ServiceUsed(uint256 indexed serviceId, address indexed user, uint256 newUsageCount);
    event Withdrawn(address indexed provider, uint256 amount);
    
    modifier serviceExists(uint256 _serviceId) {
        require(services[_serviceId].exists, "Service does not exist");
        _;
    }
    
    modifier onlyProvider(uint256 _serviceId) {
        require(services[_serviceId].provider == msg.sender, "Only provider can call this");
        _;
    }
    
    modifier validPrice(uint256 _price) {
        require(_price > 0, "Price must be greater than 0");
        _;
    }
    
    function registerService(uint256 _serviceId, uint256 _price) public virtual validPrice(_price) {
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
    
    function useService(uint256 _serviceId) public virtual payable serviceExists(_serviceId) {
        Service storage service = services[_serviceId];
        require(msg.value >= service.price, "Insufficient payment");
        
        service.usageCount += 1;
        uint256 actualPayment = service.price;
        earnings[service.provider] += actualPayment;
        
        if (msg.value > service.price) {
            payable(msg.sender).transfer(msg.value - service.price);
        }
        
        emit ServiceUsed(_serviceId, msg.sender, service.usageCount);
    }
    
    function withdraw() public virtual {
        uint256 amount = earnings[msg.sender];
        require(amount > 0, "No earnings to withdraw");
        
        earnings[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
    
    function getServiceCount() public view returns (uint256) {
        return serviceIds.length;
    }
    
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
