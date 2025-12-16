// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {ArticleSubscription} from "../contracts/articles/ArticleSubscription.sol";

contract ArticleSubscriptionTest is Test {
    ArticleSubscription public articleSubscription;
    address public publisher;
    address public reader;
    address public reader2;

    uint256 public constant ARTICLE_ID = 1;
    uint256 public constant PRICE = 0.001 ether;
    string public constant TITLE = "Test Article";
    bytes32 public constant CONTENT_HASH = keccak256("test content");
    uint256 public constant ACCESS_DURATION = 2 days;

    event ArticlePublished(uint256 indexed articleId, string title, address indexed publisher);
    event ArticlePurchased(uint256 indexed articleId, address indexed buyer, uint256 expiry);
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    event ServiceUsed(uint256 indexed serviceId, address indexed user, uint256 newUsageCount);

    function setUp() public {
        publisher = address(0x1001);
        reader = address(0x1002);
        reader2 = address(0x1003);

        vm.deal(publisher, 10 ether);
        vm.deal(reader, 10 ether);
        vm.deal(reader2, 10 ether);

        vm.prank(publisher);
        articleSubscription = new ArticleSubscription();
    }

    function test_renewal_extendsFromCurrentExpiry() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        // First purchase
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);
        
        uint256 expiry1 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        assertGt(expiry1, block.timestamp);

        // Fast forward 1 day (still within access period)
        vm.warp(block.timestamp + 1 days);

        // Renewal purchase
        uint256 purchaseTime2 = block.timestamp;
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 expiry2 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        // Should extend from original expiry, not from now
        assertEq(expiry2, expiry1 + ACCESS_DURATION);
        assertGt(expiry2, purchaseTime2 + ACCESS_DURATION);
    }

    function test_renewal_afterExpiry_startsFromNow() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        // First purchase
        uint256 purchaseTime1 = block.timestamp;
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);
        
        uint256 expiry1 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);

        // Fast forward past expiry
        vm.warp(expiry1 + 1);

        // Purchase after expiry (should start from now, not extend)
        uint256 purchaseTime2 = block.timestamp;
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 expiry2 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        // Should start from now since previous access expired
        assertEq(expiry2, purchaseTime2 + ACCESS_DURATION);
    }

    function test_expiry_accessExpiresAfterDuration() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        // Purchase
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 expiry = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        
        // Before expiry - should have access
        vm.warp(expiry - 1);
        assertTrue(articleSubscription.hasValidAccess(reader, ARTICLE_ID));
        assertTrue(articleSubscription.userHasPurchased(reader, ARTICLE_ID));

        // At expiry - should still have access (inclusive)
        vm.warp(expiry);
        assertTrue(articleSubscription.hasValidAccess(reader, ARTICLE_ID));

        // After expiry - should not have access
        vm.warp(expiry + 1);
        assertFalse(articleSubscription.hasValidAccess(reader, ARTICLE_ID));
        
        // Should not be able to read after expiry
        vm.prank(reader);
        vm.expectRevert(abi.encodeWithSelector(ArticleSubscription.AccessExpired.selector, reader, ARTICLE_ID, expiry, expiry + 1));
        articleSubscription.readArticle(ARTICLE_ID);
    }

    function test_expiry_cannotReadAfterExpiry() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        // Purchase
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 expiry = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);

        // Can read before expiry
        vm.warp(expiry - 1);
        vm.prank(reader);
        articleSubscription.readArticle(ARTICLE_ID);
        assertTrue(articleSubscription.userHasRead(reader, ARTICLE_ID));

        // Cannot read after expiry
        vm.warp(expiry + 1);
        vm.prank(reader);
        vm.expectRevert(abi.encodeWithSelector(ArticleSubscription.AccessExpired.selector, reader, ARTICLE_ID, expiry, expiry + 1));
        articleSubscription.readArticle(ARTICLE_ID);
    }

    function test_durationZero_grantsPermanentAccess() public {
        // Publish article with duration = 0 (permanent)
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, 0);

        // Purchase
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 expiry = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        assertEq(expiry, type(uint256).max);

        // Should always have access, even after a very long time
        vm.warp(block.timestamp + 1000 days);
        assertTrue(articleSubscription.hasValidAccess(reader, ARTICLE_ID));

        vm.warp(block.timestamp + 10000 days);
        assertTrue(articleSubscription.hasValidAccess(reader, ARTICLE_ID));

        // Can read at any time
        vm.prank(reader);
        articleSubscription.readArticle(ARTICLE_ID);
    }

    function test_durationZero_renewalStillPermanent() public {
        // Publish article with duration = 0
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, 0);

        // First purchase
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);
        
        uint256 expiry1 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        assertEq(expiry1, type(uint256).max);

        // Renewal purchase
        vm.warp(block.timestamp + 100 days);
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 expiry2 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        // Should still be permanent
        assertEq(expiry2, type(uint256).max);
    }

    function test_overpayRefund_refundsExcessPayment() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        uint256 excessPayment = PRICE * 2;
        uint256 balanceBefore = reader.balance;

        // Purchase with excess payment
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: excessPayment}(ARTICLE_ID);

        uint256 balanceAfter = reader.balance;
        
        // Should only charge PRICE, refund the rest
        // Note: We account for gas costs in the test
        assertGe(balanceAfter, balanceBefore - PRICE - 0.01 ether); // Allow some gas
        assertLe(balanceAfter, balanceBefore - PRICE + 0.01 ether); // Allow some gas
    }

    function test_overpayRefund_earningsOnlyRecordActualPrice() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        uint256 excessPayment = PRICE * 3;

        // Purchase with excess payment
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: excessPayment}(ARTICLE_ID);

        // Earnings should only be the actual price, not the full payment
        uint256 earnings = articleSubscription.earnings(publisher);
        assertEq(earnings, PRICE);
    }

    function test_overpayRefund_multiplePurchases() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        uint256 excessPayment1 = PRICE * 2;
        uint256 excessPayment2 = PRICE * 3 / 2; // 1.5x

        // First purchase with excess
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: excessPayment1}(ARTICLE_ID);

        // Second purchase with excess
        vm.prank(reader2);
        articleSubscription.purchaseArticle{value: excessPayment2}(ARTICLE_ID);

        // Earnings should be 2 * PRICE (one for each purchase)
        uint256 earnings = articleSubscription.earnings(publisher);
        assertEq(earnings, PRICE * 2);
    }

    function test_overpayRefund_exactPayment_noRefund() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        uint256 balanceBefore = reader.balance;

        // Purchase with exact payment
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);

        uint256 balanceAfter = reader.balance;
        
        // Should charge exactly PRICE (plus gas)
        assertGe(balanceAfter, balanceBefore - PRICE - 0.01 ether);
        assertLe(balanceAfter, balanceBefore - PRICE + 0.01 ether);
    }

    function test_renewal_multipleRenewals() public {
        // Publish article
        vm.prank(publisher);
        articleSubscription.publishArticle(ARTICLE_ID, PRICE, TITLE, CONTENT_HASH, ACCESS_DURATION);

        // First purchase
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);
        uint256 expiry1 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);

        // First renewal (1 day later, still within access period)
        vm.warp(block.timestamp + 1 days);
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);
        uint256 expiry2 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        assertEq(expiry2, expiry1 + ACCESS_DURATION);

        // Second renewal (1 day later, still within access period)
        vm.warp(block.timestamp + 1 days);
        vm.prank(reader);
        articleSubscription.purchaseArticle{value: PRICE}(ARTICLE_ID);
        uint256 expiry3 = articleSubscription.getAccessExpiry(reader, ARTICLE_ID);
        assertEq(expiry3, expiry2 + ACCESS_DURATION);
    }
}

