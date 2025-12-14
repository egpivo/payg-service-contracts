// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {ArticlePayPerRead} from "../contracts/articles/ArticlePayPerRead.sol";

contract ArticleBaseHandler is Test {
    ArticlePayPerRead public target;
    
    mapping(uint256 => uint256) public articleUsageCount;
    mapping(uint256 => address) public articlePublishers;
    mapping(uint256 => uint256) public articlePrices;
    mapping(uint256 => bytes32) public articleContentHashes;
    mapping(uint256 => uint256) public articlePublishDates;
    mapping(uint256 => uint256) public articleAccessDurations;
    mapping(uint256 => string) public articleTitles;
    uint256[] public publishedArticleIds;
    address[] public allPublishers;
    mapping(address => bool) public isPublisher;
    
    constructor(ArticlePayPerRead _target) {
        target = _target;
    }
    
    function publishArticle(
        uint256 articleId,
        uint256 price,
        string memory title,
        bytes32 contentHash
    ) public {
        price = bound(price, 1, type(uint128).max);
        
        (uint256 id, uint256 svcPrice, address provider, uint256 usageCount, bool exists) = target.services(articleId);
        if (exists) {
            return;
        }
        
        address publisher = msg.sender;
        vm.prank(publisher);
        try target.publishArticle(articleId, price, title, contentHash) {
            (,,, uint256 publishDate,,,,) = target.getArticle(articleId);
            
            if (publishDate == 0) {
                return;
            }
            
            articlePublishers[articleId] = publisher;
            articlePrices[articleId] = price;
            articleContentHashes[articleId] = contentHash;
            articlePublishDates[articleId] = publishDate;
            articleAccessDurations[articleId] = 0;
            articleTitles[articleId] = title;
            publishedArticleIds.push(articleId);
            
            if (!isPublisher[publisher]) {
                isPublisher[publisher] = true;
                allPublishers.push(publisher);
            }
        } catch {
            return;
        }
    }
    
    function readArticle(uint256 articleId, uint256 payment) public {
        (uint256 id, uint256 svcPrice, address provider, uint256 usageCount, bool exists) = target.services(articleId);
        if (!exists) {
            return;
        }
        
        uint256 price = articlePrices[articleId];
        payment = bound(payment, price, type(uint128).max);
        
        address user = msg.sender;
        vm.deal(user, payment);
        
        vm.prank(user);
        target.readArticle{value: payment}(articleId);
        
        articleUsageCount[articleId]++;
    }
    
    function getPublishedArticleCount() public view returns (uint256) {
        return publishedArticleIds.length;
    }
    
    function getPublisherCount() public view returns (uint256) {
        return allPublishers.length;
    }
}

contract ArticleBaseInvariantTest is Test {
    ArticlePayPerRead public target;
    ArticleBaseHandler public handler;
    
    address[] public publishers;
    address[] public readers;
    
    function setUp() public {
        target = new ArticlePayPerRead();
        handler = new ArticleBaseHandler(target);
        
        for (uint256 i = 0; i < 5; i++) {
            publishers.push(address(uint160(0x1000 + i)));
            readers.push(address(uint160(0x2000 + i)));
        }
        
        targetContract(address(handler));
    }
    
    function invariant_articleServiceConsistency() public view {
        uint256 articleCount = target.getServiceCount();
        
        for (uint256 i = 0; i < articleCount; i++) {
            uint256 articleId = target.serviceIds(i);
            (uint256 id, uint256 price, address provider, uint256 usageCount, bool exists) = target.services(articleId);
            
            if (exists) {
                (uint256 artId, string memory title, bytes32 contentHash, uint256 publishDate, uint256 accessDuration, uint256 artPrice, address artProvider, uint256 readCount) = target.getArticle(articleId);
                
                assertEq(artId, articleId, "Article ID mismatch");
                assertEq(artPrice, price, "Price mismatch");
                assertEq(artProvider, provider, "Provider mismatch");
                assertEq(readCount, usageCount, "Usage count mismatch");
                assertGt(publishDate, 0, "Publish date should be > 0");
            }
        }
    }
    
    function invariant_articlePropertiesNeverChange() public view {
        uint256 articleCount = handler.getPublishedArticleCount();
        
        for (uint256 i = 0; i < articleCount; i++) {
            uint256 articleId = handler.publishedArticleIds(i);
            
            (uint256 artId, string memory title, bytes32 contentHash, uint256 publishDate, uint256 accessDuration, uint256 price, address provider, uint256 readCount) = target.getArticle(articleId);
            
            address expectedPublisher = handler.articlePublishers(articleId);
            uint256 expectedPrice = handler.articlePrices(articleId);
            bytes32 expectedContentHash = handler.articleContentHashes(articleId);
            uint256 expectedPublishDate = handler.articlePublishDates(articleId);
            uint256 expectedAccessDuration = handler.articleAccessDurations(articleId);
            
            assertEq(provider, expectedPublisher, "Publisher mismatch");
            assertEq(price, expectedPrice, "Price mismatch");
            assertEq(contentHash, expectedContentHash, "Content hash mismatch");
            assertEq(publishDate, expectedPublishDate, "Publish date mismatch");
            assertEq(accessDuration, expectedAccessDuration, "Access duration mismatch");
        }
    }
    
    function invariant_articleUsageCountMatches() public view {
        uint256 articleCount = handler.getPublishedArticleCount();
        
        for (uint256 i = 0; i < articleCount; i++) {
            uint256 articleId = handler.publishedArticleIds(i);
            (,,,,,,, uint256 readCount) = target.getArticle(articleId);
            uint256 expectedUsageCount = handler.articleUsageCount(articleId);
            
            assertEq(readCount, expectedUsageCount, "Usage count mismatch");
        }
    }
    
    function invariant_publishedArticlesHaveNonZeroPublishDate() public view {
        uint256 articleCount = handler.getPublishedArticleCount();
        
        for (uint256 i = 0; i < articleCount; i++) {
            uint256 articleId = handler.publishedArticleIds(i);
            (,,,, uint256 publishDate,,,) = target.getArticle(articleId);
            assertGt(publishDate, 0, "Published article must have publishDate > 0");
        }
    }
    
    function invariant_articleServiceIdConsistency() public view {
        uint256 articleCount = handler.getPublishedArticleCount();
        
        for (uint256 i = 0; i < articleCount; i++) {
            uint256 articleId = handler.publishedArticleIds(i);
            (uint256 id, uint256 svcPrice, address provider, uint256 usageCount, bool exists) = target.services(articleId);
            
            assertTrue(exists, "Published article must exist as service");
            assertEq(id, articleId, "Service ID must match article ID");
        }
    }
    
    function invariant_articleCountMatches() public view {
        uint256 actualCount = target.getServiceCount();
        uint256 expectedCount = handler.getPublishedArticleCount();
        assertEq(actualCount, expectedCount, "Article count mismatch");
    }
    
    function invariant_accessDurationIsZeroForPayPerRead() public view {
        uint256 articleCount = handler.getPublishedArticleCount();
        
        for (uint256 i = 0; i < articleCount; i++) {
            uint256 articleId = handler.publishedArticleIds(i);
            (,,,, uint256 accessDuration,,,) = target.getArticle(articleId);
            
            assertEq(accessDuration, 0, "Pay-per-read articles must have accessDuration = 0");
        }
    }
}

