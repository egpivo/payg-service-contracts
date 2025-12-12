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
    }
    
    // Mapping from article ID to Article
    mapping(uint256 => Article) public articles;
    
    // Mapping from user address to article IDs they've read
    mapping(address => mapping(uint256 => bool)) public hasRead;
    
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
     * @dev Register an article as a service
     * @param _articleId Unique identifier for the article
     * @param _price Price to read the article
     * @param _title Title of the article
     * @param _contentHash Hash of the article content (for verification)
     */
    function publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash
    ) external {
        // Use base contract's registerService
        registerService(_articleId, _price);
        
        // Store article-specific data
        articles[_articleId] = Article({
            articleId: _articleId,
            title: _title,
            contentHash: _contentHash,
            publishDate: block.timestamp
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
        
        emit ArticleRead(_articleId, msg.sender);
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
     * @return price Price to read
     * @return provider Article publisher address
     * @return readCount Number of times article was read
     */
    function getArticle(uint256 _articleId) external view articleExists(_articleId) returns (
        uint256 articleId,
        string memory title,
        bytes32 contentHash,
        uint256 publishDate,
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
            servicePrice,
            serviceProvider,
            usage
        );
    }
}

