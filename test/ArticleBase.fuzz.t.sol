// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {ArticlePayPerRead} from "../contracts/modules/articles/ArticlePayPerRead.sol";
import {ArticleBase} from "../contracts/modules/articles/ArticleBase.sol";
import {PayAsYouGoBase} from "../contracts/core/PayAsYouGoBase.sol";

contract ArticleBaseFuzzTest is Test {
    ArticlePayPerRead public articlePayPerRead;
    address public publisher;
    address public reader;
    
    function setUp() public {
        publisher = address(0x1001);
        reader = address(0x1002);
        
        vm.deal(publisher, 10 ether);
        vm.deal(reader, 10 ether);
        
        articlePayPerRead = new ArticlePayPerRead();
    }
    
    function testFuzz_publishArticle_createsServiceAndArticle(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash
    ) public {
        price = bound(price, 1, type(uint128).max);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price, title, contentHash);
        
        (uint256 id, uint256 svcPrice, address provider, uint256 usageCount, bool exists) = articlePayPerRead.services(articleId);
        assertTrue(exists, "Service should exist");
        assertEq(id, articleId, "Service ID should match");
        assertEq(svcPrice, price, "Service price should match");
        assertEq(provider, publisher, "Provider should match");
        assertEq(usageCount, 0, "Initial usage count should be 0");
        
        uint256 artId;
        string memory artTitle;
        bytes32 artContentHash;
        uint256 publishDate;
        uint256 accessDuration;
        uint256 artPrice;
        address artProvider;
        uint256 readCount;
        (artId, artTitle, artContentHash, publishDate, accessDuration, artPrice, artProvider, readCount) = articlePayPerRead.getArticle(articleId);
        assertEq(artId, articleId, "Article ID should match");
        assertEq(artPrice, price, "Article price should match");
        assertEq(artProvider, publisher, "Article provider should match");
        assertGt(publishDate, 0, "Publish date should be > 0");
        assertEq(accessDuration, 0, "Access duration should be 0 for pay-per-read");
        assertEq(readCount, 0, "Initial read count should be 0");
    }
    
    function testFuzz_publishArticle_duplicateIdReverts(
        uint256 articleId,
        uint256 price1,
        uint256 price2,
        string memory title1,
        string memory title2,
        bytes32 contentHash1,
        bytes32 contentHash2
    ) public {
        price1 = bound(price1, 1, type(uint128).max);
        price2 = bound(price2, 1, type(uint128).max);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price1, title1, contentHash1);
        
        vm.prank(publisher);
        vm.expectRevert(abi.encodeWithSelector(ArticleBase.ArticleAlreadyPublished.selector, articleId));
        articlePayPerRead.publishArticle(articleId, price2, title2, contentHash2);
    }
    
    function testFuzz_publishArticle_priceZeroReverts(
        uint256 articleId,
        string memory title,
        bytes32 contentHash
    ) public {
        vm.prank(publisher);
        vm.expectRevert(PayAsYouGoBase.PriceMustBeGreaterThanZero.selector);
        articlePayPerRead.publishArticle(articleId, 0, title, contentHash);
    }
    
    function testFuzz_readArticle_incrementsUsageCount(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash,
        uint256 payment
    ) public {
        price = bound(price, 1, type(uint128).max);
        payment = bound(payment, price, type(uint128).max);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price, title, contentHash);
        
        vm.deal(reader, payment);
        vm.prank(reader);
        articlePayPerRead.readArticle{value: payment}(articleId);
        
        (,,,,,,, uint256 readCount) = articlePayPerRead.getArticle(articleId);
        assertEq(readCount, 1, "Read count should be 1");
        
        (,,, uint256 usageCount) = articlePayPerRead.getService(articleId);
        assertEq(usageCount, 1, "Usage count should be 1");
    }
    
    function testFuzz_readArticle_insufficientPaymentReverts(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash,
        uint256 payment
    ) public {
        price = bound(price, 1, type(uint128).max);
        payment = bound(payment, 0, price - 1);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price, title, contentHash);
        
        vm.deal(reader, payment);
        vm.prank(reader);
        vm.expectRevert(abi.encodeWithSelector(PayAsYouGoBase.InsufficientPayment.selector, articleId, price, payment));
        articlePayPerRead.readArticle{value: payment}(articleId);
    }
    
    function testFuzz_readArticle_nonexistentArticleReverts(
        uint256 articleId,
        uint256 payment
    ) public {
        payment = bound(payment, 1, type(uint128).max);
        
        vm.deal(reader, payment);
        vm.prank(reader);
        vm.expectRevert(abi.encodeWithSelector(ArticleBase.ArticleDoesNotExist.selector, articleId));
        articlePayPerRead.readArticle{value: payment}(articleId);
    }
    
    function testFuzz_getArticle_returnsCorrectData(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash
    ) public {
        price = bound(price, 1, type(uint128).max);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price, title, contentHash);
        
        uint256 artId;
        string memory artTitle;
        bytes32 artContentHash;
        uint256 publishDate;
        uint256 accessDuration;
        uint256 artPrice;
        address artProvider;
        uint256 readCount;
        (artId, artTitle, artContentHash, publishDate, accessDuration, artPrice, artProvider, readCount) = articlePayPerRead.getArticle(articleId);
        
        assertEq(artId, articleId, "Article ID should match");
        assertEq(keccak256(bytes(artTitle)), keccak256(bytes(title)), "Title should match");
        assertEq(artContentHash, contentHash, "Content hash should match");
        assertGt(publishDate, 0, "Publish date should be > 0");
        assertEq(accessDuration, 0, "Access duration should be 0");
        assertEq(artPrice, price, "Price should match");
        assertEq(artProvider, publisher, "Provider should match");
        assertEq(readCount, 0, "Read count should be 0");
    }
    
    function testFuzz_getArticle_nonexistentArticleReverts(uint256 articleId) public {
        vm.expectRevert(abi.encodeWithSelector(ArticleBase.ArticleDoesNotExist.selector, articleId));
        articlePayPerRead.getArticle(articleId);
    }
    
    function testFuzz_multipleReads_incrementUsageCount(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash,
        uint256 numReads
    ) public {
        price = bound(price, 1, type(uint128).max);
        numReads = bound(numReads, 1, 100);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price, title, contentHash);
        
        for (uint256 i = 0; i < numReads; i++) {
            // casting to 'uint160' is safe because we're only using small values (0x2000 + i)
            // which are well within uint160 range (max 0xffffffffffffffffffffffffffffffffffffffff)
            // forge-lint: disable-next-line(unsafe-typecast)
            address user = address(uint160(0x2000 + i));
            vm.deal(user, price);
            vm.prank(user);
            articlePayPerRead.readArticle{value: price}(articleId);
        }
        
        (,,,,,,, uint256 readCount) = articlePayPerRead.getArticle(articleId);
        assertEq(readCount, numReads, "Read count should match number of reads");
        
        (,,, uint256 usageCount) = articlePayPerRead.getService(articleId);
        assertEq(usageCount, numReads, "Usage count should match number of reads");
    }
    
    function testFuzz_articleServiceConsistency(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash
    ) public {
        price = bound(price, 1, type(uint128).max);
        
        vm.prank(publisher);
        articlePayPerRead.publishArticle(articleId, price, title, contentHash);
        
        (uint256 svcId, uint256 svcPrice, address svcProvider, uint256 svcUsage) = articlePayPerRead.getService(articleId);
        (uint256 artId, , , , , uint256 artPrice, address artProvider, uint256 artReadCount) = articlePayPerRead.getArticle(articleId);
        
        assertEq(svcId, artId, "Service ID should match article ID");
        assertEq(svcPrice, artPrice, "Service price should match article price");
        assertEq(svcProvider, artProvider, "Service provider should match article provider");
        assertEq(svcUsage, artReadCount, "Service usage should match article read count");
    }
}

