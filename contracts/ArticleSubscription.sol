// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PayAsYouGoBase.sol";

/**
 * @title ArticleSubscription
 * @dev Article subscription service using PayAsYouGoBase
 * 
 * This contract extends PayAsYouGoBase with article-specific features:
 * - Articles have titles and content hashes
 * - Users can subscribe to read articles
 * - Tracks which users have read which articles
 */
contract ArticleSubscription is PayAsYouGoBase {
    
    // Article structure
    struct Article {
        uint256 articleId;
        string title;
        bytes32 contentHash;
        uint256 publishDate;
        uint256 accessDuration; // Access duration in seconds (0 = permanent)
    }
    
    // Mapping from article ID to Article
    mapping(uint256 => Article) public articles;
    
    // Mapping from user address to article IDs they've read
    mapping(address => mapping(uint256 => bool)) public hasRead;
    
    // Mapping from user address to article ID to access expiry timestamp
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    
    // Events
    event ArticlePublished(uint256 indexed articleId, string title, address indexed publisher);
    event ArticleRead(uint256 indexed articleId, address indexed reader);
    
    // Modifiers
    /**
     * @dev Modifier to check if article exists
     * @param _articleId The ID of the article to check
     */
    modifier articleExists(uint256 _articleId) {
        require(services[_articleId].exists, "Article does not exist");
        _;
    }
    
    /**
     * @dev Modifier to check if caller is the publisher of an article
     * @param _articleId The ID of the article
     */
    modifier onlyPublisher(uint256 _articleId) {
        require(services[_articleId].provider == msg.sender, "Only publisher can call this");
        _;
    }
    
    /**
     * @dev Modifier to check if user's access is still valid
     * @param _articleId The ID of the article
     */
    modifier withinAccessPeriod(uint256 _articleId) {
        uint256 expiry = accessExpiry[msg.sender][_articleId];
        require(expiry > 0, "Access not granted");
        require(block.timestamp <= expiry, "Access expired");
        _;
    }
    
    /**
     * @dev Register an article as a service
     * @param _articleId Unique identifier for the article
     * @param _price Price to read the article
     * @param _title Title of the article
     * @param _contentHash Hash of the article content (for verification)
     * @param _accessDuration Access duration in seconds (0 = permanent access)
     */
    function publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash,
        uint256 _accessDuration
    ) external {
        // Use base contract's registerService
        registerService(_articleId, _price);
        
        // Store article-specific data
        articles[_articleId] = Article({
            articleId: _articleId,
            title: _title,
            contentHash: _contentHash,
            publishDate: block.timestamp,
            accessDuration: _accessDuration
        });
        
        emit ArticlePublished(_articleId, _title, msg.sender);
    }
    
    /**
     * @dev Read an article (pay-per-use)
     * @param _articleId The ID of the article to read
     */
    function readArticle(uint256 _articleId) external payable articleExists(_articleId) {
        // Use base contract's useService
        useService(_articleId);
        
        // Mark article as read by this user
        hasRead[msg.sender][_articleId] = true;
        
        // Set access expiry time
        Article memory article = articles[_articleId];
        if (article.accessDuration > 0) {
            // Time-limited access
            accessExpiry[msg.sender][_articleId] = block.timestamp + article.accessDuration;
        } else {
            // Permanent access (set to max uint256)
            accessExpiry[msg.sender][_articleId] = type(uint256).max;
        }
        
        emit ArticleRead(_articleId, msg.sender);
    }
    
    /**
     * @dev Check if user has valid access to an article
     * @param _user User address
     * @param _articleId Article ID
     * @return True if user has valid access
     */
    function hasValidAccess(address _user, uint256 _articleId) external view returns (bool) {
        uint256 expiry = accessExpiry[_user][_articleId];
        if (expiry == 0) return false; // Never purchased
        if (expiry == type(uint256).max) return true; // Permanent access
        return block.timestamp <= expiry; // Check if not expired
    }
    
    /**
     * @dev Get access expiry time for a user and article
     * @param _user User address
     * @param _articleId Article ID
     * @return Expiry timestamp (0 if never purchased, max uint256 if permanent)
     */
    function getAccessExpiry(address _user, uint256 _articleId) external view returns (uint256) {
        return accessExpiry[_user][_articleId];
    }
    
    /**
     * @dev Check if user has read an article
     * @param _user User address
     * @param _articleId Article ID
     * @return True if user has read the article
     */
    function userHasRead(address _user, uint256 _articleId) external view returns (bool) {
        return hasRead[_user][_articleId];
    }
    
    /**
     * @dev Get article details
     * @param _articleId The ID of the article
     * @return articleId Article ID
     * @return title Article title
     * @return contentHash Content hash
     * @return publishDate Publish timestamp
     * @return accessDuration Access duration in seconds (0 = permanent)
     * @return price Price to read
     * @return provider Article publisher address
     * @return readCount Number of times article was read
     */
    function getArticle(uint256 _articleId) external view articleExists(_articleId) returns (
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

