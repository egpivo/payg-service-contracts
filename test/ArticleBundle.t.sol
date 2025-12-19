// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {ArticlePayPerRead} from "../contracts/modules/articles/ArticlePayPerRead.sol";
import {ArticleBundle} from "../contracts/modules/articles/ArticleBundle.sol";
import {IArticleRegistry} from "../contracts/modules/articles/IArticleRegistry.sol";

contract ArticleBundleTest is Test {
    IArticleRegistry public articleRegistry;
    ArticleBundle public articleBundle;
    address public publisher1;
    address public publisher2;
    address public publisher3;
    address public buyer;
    address public bundleCreator;
    
    uint256 public articleId1 = 1;
    uint256 public articleId2 = 2;
    uint256 public articleId3 = 3;
    uint256 public bundleId = 100;
    
    uint256 public price1 = 0.001 ether;
    uint256 public price2 = 0.002 ether;
    uint256 public price3 = 0.0015 ether;
    uint256 public bundlePrice = 0.004 ether;
    
    function setUp() public {
        publisher1 = address(0x1001);
        publisher2 = address(0x1002);
        publisher3 = address(0x1003);
        buyer = address(0x2001);
        bundleCreator = address(0x3001);
        
        vm.deal(publisher1, 10 ether);
        vm.deal(publisher2, 10 ether);
        vm.deal(publisher3, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(bundleCreator, 10 ether);
        
        // Deploy ArticlePayPerRead (cast to IArticleRegistry for dependency inversion)
        ArticlePayPerRead articlePayPerReadImpl = new ArticlePayPerRead();
        articleRegistry = IArticleRegistry(address(articlePayPerReadImpl));
        
        // Deploy ArticleBundle with interface
        articleBundle = new ArticleBundle(articleRegistry);
        
        // Publish articles (need to use concrete type for publishArticle)
        vm.prank(publisher1);
        articlePayPerReadImpl.publishArticle(articleId1, price1, "Article 1", keccak256("content1"));
        
        vm.prank(publisher2);
        articlePayPerReadImpl.publishArticle(articleId2, price2, "Article 2", keccak256("content2"));
        
        vm.prank(publisher3);
        articlePayPerReadImpl.publishArticle(articleId3, price3, "Article 3", keccak256("content3"));
    }
    
    function test_createBundle_success() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        articleIds[2] = articleId3;
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, accessDuration);
        
        (uint256 id, uint256[] memory bundleArticleIds, uint256 price, address creator, uint256 duration, uint256 usageCount) = 
            articleBundle.getBundle(bundleId);
        
        assertEq(id, bundleId);
        assertEq(bundleArticleIds.length, 3);
        assertEq(price, bundlePrice);
        assertEq(creator, bundleCreator);
        assertEq(duration, accessDuration);
        assertEq(usageCount, 0);
    }
    
    function test_createBundle_duplicateIdReverts() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.BundleIdAlreadyExists.selector, bundleId));
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
    
    function test_createBundle_nonexistentArticleReverts() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = 999; // Non-existent
        
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.ArticleDoesNotExistInRegistry.selector, uint256(999)));
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
    
    function test_createBundle_emptyArrayReverts() public {
        uint256[] memory articleIds = new uint256[](0);
        
        vm.expectRevert(ArticleBundle.BundleMustContainAtLeastOneArticle.selector);
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
    
    function test_purchaseBundle_success() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        articleIds[2] = articleId3;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 86400);
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        bool hasAccess = articleBundle.hasBundleAccess(buyer, bundleId);
        assertTrue(hasAccess);
        
        uint256 expiry = articleBundle.getBundleAccessExpiry(buyer, bundleId);
        assertGt(expiry, 0);
    }
    
    function test_purchaseBundle_distributesRevenueEqually() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        articleIds[2] = articleId3;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        uint256 revenuePerArticle = bundlePrice / 3;
        uint256 remainder = bundlePrice % 3;
        
        uint256 earnings1 = articleBundle.earnings(publisher1);
        uint256 earnings2 = articleBundle.earnings(publisher2);
        uint256 earnings3 = articleBundle.earnings(publisher3);
        
        assertEq(earnings1, revenuePerArticle + remainder); // First gets remainder
        assertEq(earnings2, revenuePerArticle);
        assertEq(earnings3, revenuePerArticle);
    }
    
    function test_purchaseBundle_refundsExcess() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        uint256 excessPayment = bundlePrice + 0.001 ether;
        uint256 buyerBalanceBefore = buyer.balance;
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: excessPayment}(bundleId);
        
        uint256 buyerBalanceAfter = buyer.balance;
        uint256 expectedBalance = buyerBalanceBefore - bundlePrice;
        
        // Allow small difference for gas
        assertGe(buyerBalanceAfter, expectedBalance - 0.0001 ether);
        assertLe(buyerBalanceAfter, expectedBalance);
    }
    
    function test_purchaseBundle_insufficientPaymentReverts() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.InsufficientPaymentForBundle.selector, bundleId, bundlePrice, bundlePrice - 1));
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice - 1}(bundleId);
    }
    
    function test_purchaseBundle_renewal() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, accessDuration);
        
        // First purchase
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        uint256 expiry1 = articleBundle.getBundleAccessExpiry(buyer, bundleId);
        
        // Move time forward (but not past expiry)
        vm.warp(block.timestamp + 3600); // 1 hour
        
        // Renewal purchase
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        uint256 expiry2 = articleBundle.getBundleAccessExpiry(buyer, bundleId);
        
        // Should extend from previous expiry
        assertEq(expiry2, expiry1 + accessDuration);
    }
    
    function test_purchaseBundle_expiredStartsFromNow() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        uint256 accessDuration = 86400; // 1 day
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, accessDuration);
        
        // First purchase
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        // Move time past expiry (explicitly based on recorded expiry)
        uint256 expiry1 = articleBundle.getBundleAccessExpiry(buyer, bundleId);
        vm.warp(expiry1 + 1); // Ensure current time is strictly greater than previous expiry
        
        // Capture timestamp before purchase to ensure accurate comparison
        uint256 purchaseTime = block.timestamp;
        
        // Purchase again
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        uint256 expiry = articleBundle.getBundleAccessExpiry(buyer, bundleId);
        
        // Should start from now (when purchase was made)
        assertEq(expiry, purchaseTime + accessDuration);
    }
    
    function test_purchaseBundle_permanentAccess() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0); // Permanent
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        uint256 expiry = articleBundle.getBundleAccessExpiry(buyer, bundleId);
        assertEq(expiry, type(uint256).max);
        
        bool hasAccess = articleBundle.hasBundleAccess(buyer, bundleId);
        assertTrue(hasAccess);
    }
    
    function test_hasBundleAccess_neverPurchased() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        bool hasAccess = articleBundle.hasBundleAccess(buyer, bundleId);
        assertFalse(hasAccess);
    }
    
    function test_hasBundleAccess_expired() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        uint256 accessDuration = 86400;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, accessDuration);
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        // Move time past expiry
        vm.warp(block.timestamp + 86401);
        
        bool hasAccess = articleBundle.hasBundleAccess(buyer, bundleId);
        assertFalse(hasAccess);
    }
    
    function test_withdraw_providerCanWithdraw() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        articleIds[2] = articleId3;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        uint256 revenuePerArticle = bundlePrice / 3;
        uint256 remainder = bundlePrice % 3;
        uint256 expectedEarnings = revenuePerArticle + remainder;
        
        uint256 earnings = articleBundle.earnings(publisher1);
        assertEq(earnings, expectedEarnings);
        
        uint256 balanceBefore = publisher1.balance;
        vm.prank(publisher1);
        articleBundle.withdraw();
        uint256 balanceAfter = publisher1.balance;
        
        assertEq(balanceAfter - balanceBefore, expectedEarnings);
        assertEq(articleBundle.earnings(publisher1), 0);
    }
    
    function test_bundleCreator_notRegisteredAsProvider() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        // Check that bundle creator is NOT registered as service provider
        (, uint256 price, address provider, , bool exists) = 
            articleBundle.services(bundleId);
        
        assertTrue(exists);
        assertEq(provider, address(0)); // Bundle creator is not a provider
        assertEq(price, bundlePrice);
        
        // Bundle creator should have zero earnings
        uint256 creatorEarnings = articleBundle.earnings(bundleCreator);
        assertEq(creatorEarnings, 0);
    }
    
    function test_bundleCreator_noEarningsAfterPurchase() public {
        uint256[] memory articleIds = new uint256[](2);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
        
        vm.prank(buyer);
        articleBundle.purchaseBundle{value: bundlePrice}(bundleId);
        
        // Bundle creator should still have zero earnings
        uint256 creatorEarnings = articleBundle.earnings(bundleCreator);
        assertEq(creatorEarnings, 0);
        
        // All revenue should go to article providers
        uint256 revenuePerArticle = bundlePrice / 2;
        uint256 remainder = bundlePrice % 2;
        
        assertEq(articleBundle.earnings(publisher1), revenuePerArticle + remainder);
        assertEq(articleBundle.earnings(publisher2), revenuePerArticle);
    }
}

