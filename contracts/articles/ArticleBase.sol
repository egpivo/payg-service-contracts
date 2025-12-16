// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PayAsYouGoBase} from "../PayAsYouGoBase.sol";
import {IArticleRegistry} from "./IArticleRegistry.sol";

/**
 * @title ArticleBase
 * @dev Abstract base contract for article services
 * 
 * Provides common functionality for article publishing and management:
 * - Article struct and storage
 * - Article publishing logic
 * - Article existence checks
 * 
 * Child contracts should implement their own payment and reading patterns.
 */
abstract contract ArticleBase is PayAsYouGoBase, IArticleRegistry {
    
    /**
     * @dev Implementation of IArticleRegistry interface
     * @notice Wraps the services mapping to match the interface signature
     *         Can be overridden by child contracts to use external registry
     */
    function getArticleService(uint256 _articleId) external view virtual override returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount,
        bool exists
    ) {
        Service memory service = services[_articleId];
        return (
            service.id,
            service.price,
            service.provider,
            service.usageCount,
            service.exists
        );
    }
    
    // Article structure
    struct Article {
        uint256 articleId;
        string title;
        bytes32 contentHash;
        uint256 publishDate;
        uint256 accessDuration; // 0 = not applicable (for pay-per-read), > 0 = duration in seconds
    }
    
    // Mapping from article ID to Article
    mapping(uint256 => Article) public articles;
    
    // Events
    event ArticlePublished(uint256 indexed articleId, string title, address indexed publisher);
    
    // Custom Errors
    error ArticleDoesNotExist(uint256 articleId);
    error ArticleDataNotFound(uint256 articleId);
    error ArticleAlreadyPublished(uint256 articleId);
    
    // Modifiers
    /**
     * @dev Modifier to check if article exists
     * @param _articleId The ID of the article to check
     * @notice Checks both service registration and article data to ensure consistency
     *         publishDate != 0 is a reliable check (block.timestamp is never 0)
     */
    modifier articleExists(uint256 _articleId) {
        _articleExists(_articleId);
        _;
    }
    
    /**
     * @dev Internal function to check if article exists
     * @param _articleId The ID of the article to check
     */
    function _articleExists(uint256 _articleId) internal view {
        if (!services[_articleId].exists) {
            revert ArticleDoesNotExist(_articleId);
        }
        if (articles[_articleId].publishDate == 0) {
            revert ArticleDataNotFound(_articleId);
        }
    }
    
    /**
     * @dev Internal function to publish an article
     * @param _articleId Unique identifier for the article
     * @param _price Price to read the article
     * @param _title Title of the article
     * @param _contentHash Hash of the article content (for verification)
     * @param _accessDuration Access duration in seconds (0 = not applicable)
     * @notice This is an internal function that child contracts should call from their public publishArticle
     */
    /**
     * @dev Internal function to publish an article
     * @param _articleId Unique identifier for the article
     * @param _price Price to read the article
     * @param _title Title of the article
     * @param _contentHash Hash of the article content (for verification)
     * @param _accessDuration Access duration in seconds (0 = not applicable)
     * @notice This is an internal function that child contracts should call from their public publishArticle
     *         Only service providers or contract owner can publish articles
     */
    function _publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash,
        uint256 _accessDuration
    ) internal {
        // Prevent duplicate publishing (even though registerService will also check)
        if (articles[_articleId].publishDate != 0) {
            revert ArticleAlreadyPublished(_articleId);
        }
        
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
     * @dev Get article details (base implementation)
     * @param _articleId The ID of the article
     * @return articleId Article ID
     * @return title Article title
     * @return contentHash Content hash
     * @return publishDate Publish timestamp
     * @return accessDuration Access duration (0 if not applicable)
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

