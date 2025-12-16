// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {PayAsYouGoBase} from "../contracts/PayAsYouGoBase.sol";

contract PayAsYouGoBaseHandler is Test {
    PayAsYouGoBase public target;
    
    uint256 public totalEarnings;
    mapping(uint256 => uint256) public serviceUsageCount;
    mapping(uint256 => address) public serviceProviders;
    mapping(uint256 => uint256) public servicePrices;
    mapping(address => uint256) public expectedEarnings;
    uint256[] public registeredServiceIds;
    address[] public allProviders;
    mapping(address => bool) public isProvider;
    
    constructor(PayAsYouGoBase _target) {
        target = _target;
    }
    
    function registerService(uint256 serviceId, uint256 price) public {
        price = bound(price, 1, type(uint128).max);
        
        (uint256 id, uint256 svcPrice, address provider, uint256 usageCount, bool exists) = target.services(serviceId);
        if (exists) {
            return;
        }
        
        address newProvider = msg.sender;
        vm.prank(newProvider);
        target.registerService(serviceId, price);
        
        serviceProviders[serviceId] = newProvider;
        servicePrices[serviceId] = price;
        registeredServiceIds.push(serviceId);
        
        if (!isProvider[newProvider]) {
            isProvider[newProvider] = true;
            allProviders.push(newProvider);
        }
    }
    
    function useService(uint256 serviceId, uint256 payment) public {
        (uint256 id, uint256 svcPrice, address provider, uint256 usageCount, bool exists) = target.services(serviceId);
        if (!exists) {
            return;
        }
        
        uint256 price = servicePrices[serviceId];
        payment = bound(payment, price, type(uint128).max);
        
        address user = msg.sender;
        vm.deal(user, payment);
        
        vm.prank(user);
        target.useService{value: payment}(serviceId);
        
        serviceUsageCount[serviceId]++;
        address svcProvider = serviceProviders[serviceId];
        expectedEarnings[svcProvider] += price;
        totalEarnings += price;
    }
    
    function withdraw(address provider) public {
        uint256 expectedAmount = expectedEarnings[provider];
        if (expectedAmount == 0) {
            return;
        }
        
        uint256 actualEarnings = target.earnings(provider);
        if (actualEarnings == 0) {
            return;
        }
        
        uint256 providerBalanceBefore = provider.balance;
        
        vm.prank(provider);
        target.withdraw();
        
        uint256 providerBalanceAfter = provider.balance;
        uint256 withdrawn = providerBalanceAfter - providerBalanceBefore;
        
        totalEarnings -= withdrawn;
        expectedEarnings[provider] = 0;
    }
    
    function getRegisteredServiceCount() public view returns (uint256) {
        return registeredServiceIds.length;
    }
    
    function getProviderCount() public view returns (uint256) {
        return allProviders.length;
    }
}

contract PayAsYouGoBaseInvariantTest is Test {
    PayAsYouGoBase public target;
    PayAsYouGoBaseHandler public handler;
    
    address[] public providers;
    address[] public users;
    
    function setUp() public {
        target = new PayAsYouGoBase();
        handler = new PayAsYouGoBaseHandler(target);
        
        for (uint256 i = 0; i < 5; i++) {
            // casting to 'uint160' is safe because we're only using small values (0x1000-0x1004, 0x2000-0x2004)
            // which are well within uint160 range (max 0xffffffffffffffffffffffffffffffffffffffff)
            // forge-lint: disable-next-line(unsafe-typecast)
            providers.push(address(uint160(0x1000 + i)));
            // casting to 'uint160' is safe because we're only using small values (0x1000-0x1004, 0x2000-0x2004)
            // which are well within uint160 range (max 0xffffffffffffffffffffffffffffffffffffffff)
            // forge-lint: disable-next-line(unsafe-typecast)
            users.push(address(uint160(0x2000 + i)));
        }
        
        targetContract(address(handler));
    }
    
    function invariant_totalEarningsMatchesSum() public view {
        uint256 actualTotalEarnings = 0;
        uint256 providerCount = handler.getProviderCount();
        
        for (uint256 i = 0; i < providerCount; i++) {
            address provider = handler.allProviders(i);
            actualTotalEarnings += target.earnings(provider);
        }
        
        uint256 handlerTotal = handler.totalEarnings();
        assertEq(actualTotalEarnings, handlerTotal, "Total earnings mismatch");
    }
    
    function invariant_serviceUsageCountMatches() public view {
        uint256 serviceCount = target.getServiceCount();
        
        for (uint256 i = 0; i < serviceCount; i++) {
            uint256 serviceId = target.serviceIds(i);
            (uint256 id, uint256 price, address provider, uint256 usageCount, bool exists) = target.services(serviceId);
            if (exists) {
                uint256 expectedUsageCount = handler.serviceUsageCount(serviceId);
                assertEq(usageCount, expectedUsageCount);
            }
        }
    }
    
    function invariant_providerEarningsMatch() public view {
        for (uint256 i = 0; i < providers.length; i++) {
            address provider = providers[i];
            uint256 actualEarnings = target.earnings(provider);
            uint256 expectedEarnings = handler.expectedEarnings(provider);
            assertEq(actualEarnings, expectedEarnings);
        }
    }
    
    function invariant_servicePropertiesNeverChange() public view {
        uint256 serviceCount = target.getServiceCount();
        
        for (uint256 i = 0; i < serviceCount; i++) {
            uint256 serviceId = target.serviceIds(i);
            (uint256 id, uint256 price, address provider, uint256 usageCount, bool exists) = target.services(serviceId);
            if (exists) {
                address expectedProvider = handler.serviceProviders(serviceId);
                uint256 expectedPrice = handler.servicePrices(serviceId);
                
                assertEq(provider, expectedProvider);
                assertEq(price, expectedPrice);
            }
        }
    }
    
    function invariant_contractBalanceMatchesUnwithdrawnEarnings() public view {
        uint256 contractBalance = address(target).balance;
        uint256 unwithdrawnEarnings = handler.totalEarnings();
        
        assertEq(contractBalance, unwithdrawnEarnings);
    }
    
    function invariant_serviceCountMatches() public view {
        uint256 actualCount = target.getServiceCount();
        uint256 expectedCount = handler.getRegisteredServiceCount();
        assertEq(actualCount, expectedCount);
    }
}

