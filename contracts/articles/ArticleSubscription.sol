// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ArticleBase.sol";
import "../AccessLib.sol";

/**
 * @title ArticleSubscription
 * @dev Subscription-based article service (purchase once, read multiple times)
 */
contract ArticleSubscription is ArticleBase {
    
    mapping(address => mapping(uint256 => bool)) public hasPurchased;
    mapping(address => mapping(uint256 => bool)) public hasRead;
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    event ArticlePurchased(uint256 indexed articleId, address indexed buyer, uint256 expiry);
    
    modifier withinAccessPeriod(uint256 _articleId) {
        uint256 expiry = accessExpiry[msg.sender][_articleId];
        require(expiry > 0, "Access not granted");
        require(block.timestamp <= expiry, "Access expired");
        _;
    }
    
    function publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash,
        uint256 _accessDuration
    ) external {
        _publishArticle(_articleId, _price, _title, _contentHash, _accessDuration);
    }
    
    /**
     * @notice Allows renewal: extends from current expiry if not expired, otherwise starts from now
     */
    function purchaseArticle(uint256 _articleId) external payable articleExists(_articleId) {
        useService(_articleId);
        
        Article memory article = articles[_articleId];
        uint256 currentExpiry = accessExpiry[msg.sender][_articleId];
        uint256 expiry = AccessLib.computeExpiry(
            currentExpiry,
            block.timestamp,
            article.accessDuration
        );
        accessExpiry[msg.sender][_articleId] = expiry;
        hasPurchased[msg.sender][_articleId] = true;
        
        emit ArticlePurchased(_articleId, msg.sender, expiry);
    }
    
    function readArticle(uint256 _articleId) external articleExists(_articleId) withinAccessPeriod(_articleId) {
        hasRead[msg.sender][_articleId] = true;
        emit ArticleRead(_articleId, msg.sender, block.timestamp);
    }
    
    function hasValidAccess(address _user, uint256 _articleId) external view returns (bool) {
        uint256 expiry = accessExpiry[_user][_articleId];
        return AccessLib.isValid(expiry, block.timestamp);
    }
    
    function getAccessExpiry(address _user, uint256 _articleId) external view returns (uint256) {
        return accessExpiry[_user][_articleId];
    }
    
    function userHasPurchased(address _user, uint256 _articleId) external view returns (bool) {
        return hasPurchased[_user][_articleId];
    }
    
    function userHasRead(address _user, uint256 _articleId) external view returns (bool) {
        return hasRead[_user][_articleId];
    }
    
    function getArticle(uint256 _articleId) external view override articleExists(_articleId) returns (
        uint256 articleId,
        string memory title,
        bytes32 contentHash,
        uint256 publishDate,
        uint256 accessDuration,
        uint256 price,
        address provider,
        uint256 readCount
    ) {
        Article memory article = articles[_articleId];
        (, uint256 servicePrice, address serviceProvider, uint256 usage) = getService(_articleId);
        
        return (
            article.articleId,
            article.title,
            article.contentHash,
            article.publishDate,
            article.accessDuration,
            servicePrice,
            serviceProvider,
            usage
        );
    }
}

