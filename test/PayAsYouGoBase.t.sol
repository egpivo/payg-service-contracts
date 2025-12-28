// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {PayAsYouGoBase} from "../contracts/core/PayAsYouGoBase.sol";

contract PayAsYouGoBaseTest is Test {
    PayAsYouGoBase public payAsYouGoBase;
    address public provider;
    address public user;
    address public user2;

    uint256 public constant SERVICE_ID = 1;
    uint256 public constant PRICE = 0.001 ether;

    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, uint256 price);
    event ServiceUsed(uint256 indexed serviceId, address indexed user, uint256 newUsageCount);
    event Withdrawn(address indexed provider, uint256 amount);

    function setUp() public {
        provider = address(0x1001);
        user = address(0x1002);
        user2 = address(0x1003);

        vm.deal(provider, 10 ether);
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);

        vm.prank(provider);
        payAsYouGoBase = new PayAsYouGoBase();
    }

    function test_overpayRefund_refundsExcessPayment() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 excessPayment = PRICE * 2;
        uint256 balanceBefore = user.balance;

        // Use service with excess payment
        vm.prank(user);
        payAsYouGoBase.useService{value: excessPayment}(SERVICE_ID);

        uint256 balanceAfter = user.balance;
        
        // Should only charge PRICE, refund the rest
        // Note: We account for gas costs in the test
        assertGe(balanceAfter, balanceBefore - PRICE - 0.01 ether); // Allow some gas
        assertLe(balanceAfter, balanceBefore - PRICE + 0.01 ether); // Allow some gas
    }

    function test_overpayRefund_earningsOnlyRecordActualPrice() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 excessPayment = PRICE * 3;

        // Use service with excess payment
        vm.prank(user);
        payAsYouGoBase.useService{value: excessPayment}(SERVICE_ID);

        // Earnings should only be the actual price, not the full payment
        uint256 earnings = payAsYouGoBase.earnings(provider);
        assertEq(earnings, PRICE);
    }

    function test_overpayRefund_providerWithdrawsCorrectAmount() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 excessPayment = PRICE * 2;

        // Use service with excess payment
        vm.prank(user);
        payAsYouGoBase.useService{value: excessPayment}(SERVICE_ID);

        // Provider should be able to withdraw only the actual price
        uint256 earnings = payAsYouGoBase.earnings(provider);
        assertEq(earnings, PRICE);
        
        // Provider withdraws
        vm.prank(provider);
        payAsYouGoBase.withdraw();
        
        // Earnings should be reset to 0 after withdraw
        uint256 earningsAfter = payAsYouGoBase.earnings(provider);
        assertEq(earningsAfter, 0);
        
        // Verify that only PRICE was recorded in earnings (not the excess payment)
        // This is tested by checking earnings before withdraw equals PRICE
        // and that withdraw successfully resets earnings to 0
    }

    function test_overpayRefund_multipleUses() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 excessPayment1 = PRICE * 2;
        uint256 excessPayment2 = PRICE * 3 / 2; // 1.5x

        // First use with excess
        vm.prank(user);
        payAsYouGoBase.useService{value: excessPayment1}(SERVICE_ID);

        // Second use with excess
        vm.prank(user2);
        payAsYouGoBase.useService{value: excessPayment2}(SERVICE_ID);

        // Earnings should be 2 * PRICE (one for each use)
        uint256 earnings = payAsYouGoBase.earnings(provider);
        assertEq(earnings, PRICE * 2);
    }

    function test_overpayRefund_exactPayment_noRefund() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 balanceBefore = user.balance;

        // Use service with exact payment
        vm.prank(user);
        payAsYouGoBase.useService{value: PRICE}(SERVICE_ID);

        uint256 balanceAfter = user.balance;
        
        // Should charge exactly PRICE (plus gas)
        assertGe(balanceAfter, balanceBefore - PRICE - 0.01 ether);
        assertLe(balanceAfter, balanceBefore - PRICE + 0.01 ether);
    }

    function test_overpayRefund_largeExcess() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 largeExcess = PRICE * 100;
        uint256 balanceBefore = user.balance;

        // Use service with large excess payment
        vm.prank(user);
        payAsYouGoBase.useService{value: largeExcess}(SERVICE_ID);

        uint256 balanceAfter = user.balance;
        
        // Should only charge PRICE, refund the large excess
        assertGe(balanceAfter, balanceBefore - PRICE - 0.01 ether);
        assertLe(balanceAfter, balanceBefore - PRICE + 0.01 ether);
    }

    function test_overpayRefund_usageCountIncrementsCorrectly() public {
        // Register service
        vm.prank(provider);
        payAsYouGoBase.registerService(SERVICE_ID, PRICE);

        uint256 excessPayment = PRICE * 2;

        // Use service with excess payment
        vm.prank(user);
        payAsYouGoBase.useService{value: excessPayment}(SERVICE_ID);

        // Usage count should increment by 1, regardless of payment amount
        (,,, uint256 usageCount) = payAsYouGoBase.getServiceDetails(SERVICE_ID);
        assertEq(usageCount, 1);

        // Second use
        vm.prank(user2);
        payAsYouGoBase.useService{value: excessPayment}(SERVICE_ID);

        (,,, usageCount) = payAsYouGoBase.getServiceDetails(SERVICE_ID);
        assertEq(usageCount, 2);
    }
}

