// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {ArticlePayPerRead} from "../contracts/modules/articles/ArticlePayPerRead.sol";
import {ArticleBundle} from "../contracts/modules/articles/ArticleBundle.sol";
import {IArticleRegistry} from "../contracts/modules/articles/IArticleRegistry.sol";

contract ArticleBundleDuplicateTest is Test {
    ArticlePayPerRead public articlePayPerRead;
    ArticleBundle public articleBundle;
    address public publisher1;
    address public publisher2;
    address public bundleCreator;
    
    uint256 public articleId1 = 1;
    uint256 public articleId2 = 2;
    uint256 public bundleId = 100;
    uint256 public price1 = 0.001 ether;
    uint256 public price2 = 0.002 ether;
    uint256 public bundlePrice = 0.003 ether;
    
    function setUp() public {
        publisher1 = address(0x1001);
        publisher2 = address(0x1002);
        bundleCreator = address(0x3001);
        
        vm.deal(publisher1, 10 ether);
        vm.deal(publisher2, 10 ether);
        vm.deal(bundleCreator, 10 ether);
        
        ArticlePayPerRead articlePayPerReadImpl = new ArticlePayPerRead();
        IArticleRegistry articleReg = IArticleRegistry(address(articlePayPerReadImpl));
        articleBundle = new ArticleBundle(articleReg);
        
        vm.prank(publisher1);
        articlePayPerReadImpl.publishArticle(articleId1, price1, "Article 1", keccak256("content1"));
        
        vm.prank(publisher2);
        articlePayPerReadImpl.publishArticle(articleId2, price2, "Article 2", keccak256("content2"));
    }
    
    function test_createBundle_duplicateArticleIdsReverts() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        articleIds[2] = articleId1; // Duplicate
        
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.DuplicateArticleInBundle.selector, articleId1));
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
    
    function test_createBundle_duplicateArticleIdsAtStartReverts() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId1; // Duplicate
        articleIds[2] = articleId2;
        
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.DuplicateArticleInBundle.selector, articleId1));
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
    
    function test_createBundle_duplicateArticleIdsAllSameReverts() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId1; // Duplicate
        articleIds[2] = articleId1; // Duplicate
        
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.DuplicateArticleInBundle.selector, articleId1));
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
    
    function test_createBundle_uniqueArticleIdsSucceeds() public {
        uint256[] memory articleIds = new uint256[](3);
        articleIds[0] = articleId1;
        articleIds[1] = articleId2;
        articleIds[2] = 999; // Non-existent, but unique
        
        // Should revert on "Article does not exist", not "Duplicate article"
        vm.expectRevert(abi.encodeWithSelector(ArticleBundle.ArticleDoesNotExistInRegistry.selector, uint256(999)));
        vm.prank(bundleCreator);
        articleBundle.createBundle(bundleId, articleIds, bundlePrice, 0);
    }
}

