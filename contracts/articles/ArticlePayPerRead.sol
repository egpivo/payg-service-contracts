// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../PayAsYouGoBase.sol";

/**
 * @title ArticlePayPerRead
 * @dev Pay-per-read article service (gas efficient)
 * 
 * Pattern: Pay each time you read
 * - No accessExpiry storage writes (saves gas)
 * - Tracking via events for off-chain analytics
 */
contract ArticlePayPerRead is PayAsYouGoBase {
    
    // Article structure
    struct Article {
        uint256 articleId;
        string title;
        bytes32 contentHash;
        uint256 publishDate;
    }
    
    // Mapping from article ID to Article
    mapping(uint256 => Article) public articles;
    
    // Events
    event ArticlePublished(uint256 indexed articleId, string title, address indexed publisher);
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    
    // Modifiers
    /**
     * @dev Modifier to check if article exists
     * @param _articleId The ID of the article to check
     * @notice Checks both service registration and article data to ensure consistency
     */
    modifier articleExists(uint256 _articleId) {
        require(services[_articleId].exists, "Article does not exist");
        require(articles[_articleId].publishDate != 0, "Article data not found");
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
     * @notice Pay-per-read: Pay each time you read
     *         No storage writes (gas efficient)
     *         Tracking done via event emission for off-chain analytics
     */
    function readArticle(uint256 _articleId) external payable articleExists(_articleId) {
        // Use base contract's useService (pay-per-read)
        useService(_articleId);
        
        // Emit event with timestamp for off-chain tracking (no storage write)
        emit ArticleRead(_articleId, msg.sender, block.timestamp);
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

