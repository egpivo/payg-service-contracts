// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PayAsYouGoBase} from "../../core/PayAsYouGoBase.sol";

/**
 * @title ArticleSubscription
 * @dev Subscription-based article service (purchase once, read multiple times)
 * 
 * Pattern: Purchase once, then read multiple times during access period
 * - Writes to accessExpiry storage (cost consideration for high-volume)
 * - Uses withinAccessPeriod modifier for access control
 * 
 * For pay-per-read pattern, see ArticlePayPerRead contract
 */
contract ArticleSubscription is PayAsYouGoBase {
    
    // Article structure
    struct Article {
        uint256 articleId;
        string title;
        bytes32 contentHash;
        uint256 publishDate;
        uint256 accessDuration;
    }
    
    // Mapping from article ID to Article
    mapping(uint256 => Article) public articles;
    
    // Mapping from user address to article IDs they've purchased
    mapping(address => mapping(uint256 => bool)) public hasPurchased;
    
    // Mapping from user address to article IDs they've read
    mapping(address => mapping(uint256 => bool)) public hasRead;
    
    // Mapping from user address to article ID to access expiry timestamp
    // Cost consideration: Each purchase writes to storage (user x article = storage slot)
    // For high-volume scenarios, consider off-chain entitlement tracking via events
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    
    // Events
    event ArticlePublished(uint256 indexed articleId, string title, address indexed publisher);
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    event ArticlePurchased(uint256 indexed articleId, address indexed buyer, uint256 expiry);
    
    // Custom Errors
    error ArticleDoesNotExist(uint256 articleId);
    error ArticleDataNotFound(uint256 articleId);
    error ArticleAlreadyPublished(uint256 articleId);
    error AccessNotGranted(address user, uint256 articleId);
    error AccessExpired(address user, uint256 articleId, uint256 expiry, uint256 currentTime);
    
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
     * @dev Modifier to check if user's access is still valid
     * @param _articleId The ID of the article
     */
    modifier withinAccessPeriod(uint256 _articleId) {
        _withinAccessPeriod(_articleId);
        _;
    }
    
    /**
     * @dev Internal function to check if user's access is still valid
     * @param _articleId The ID of the article
     */
    function _withinAccessPeriod(uint256 _articleId) internal view {
        uint256 expiry = accessExpiry[msg.sender][_articleId];
        if (expiry == 0) {
            revert AccessNotGranted(msg.sender, _articleId);
        }
        if (block.timestamp > expiry) {
            revert AccessExpired(msg.sender, _articleId, expiry, block.timestamp);
        }
    }
    
    /**
     * @dev Register an article as a service
     * @param _articleId Unique identifier for the article
     * @param _price Price to read the article
     * @param _title Title of the article
     * @param _contentHash Hash of the article content (for verification)
     * @param _accessDuration Access duration in seconds (0 = permanent access)
     * @notice Only service providers or contract owner can publish articles
     */
    function publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash,
        uint256 _accessDuration
    ) external {
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
     * @dev Purchase article access (pay once, read multiple times during access period)
     * @param _articleId The ID of the article to purchase
     * @notice Subscription pattern: Purchase once, then read multiple times without paying
     *         Allows renewal: If access not expired, extends from current expiry
     *         If expired, starts from now. Writes to accessExpiry storage (gas cost)
     */
    function purchaseArticle(uint256 _articleId) external payable articleExists(_articleId) {
        // Pay once for access
        useService(_articleId);
        
        // Set access expiry time (storage write - gas cost)
        Article memory article = articles[_articleId];
        uint256 currentExpiry = accessExpiry[msg.sender][_articleId];
        uint256 expiry;
        
        if (article.accessDuration > 0) {
            // Time-limited access
            if (currentExpiry > 0 && currentExpiry > block.timestamp) {
                // Renewal: extend from current expiry
                expiry = currentExpiry + article.accessDuration;
            } else {
                // New purchase or expired: start from now
                expiry = block.timestamp + article.accessDuration;
            }
            accessExpiry[msg.sender][_articleId] = expiry;
        } else {
            // Permanent access (set to max uint256)
            expiry = type(uint256).max;
            accessExpiry[msg.sender][_articleId] = expiry;
        }
        
        // Mark as purchased (not read yet)
        hasPurchased[msg.sender][_articleId] = true;
        
        // Emit purchase event (not read event)
        emit ArticlePurchased(_articleId, msg.sender, expiry);
    }
    
    /**
     * @dev Read article after purchase (no payment required)
     * @param _articleId The ID of the article to read
     * @notice Requires valid access period (purchased and not expired)
     *         This is the "purchase once, read multiple times" pattern
     *         Alternative: Frontend can just call hasValidAccess() without this function
     */
    function readArticle(uint256 _articleId) external articleExists(_articleId) withinAccessPeriod(_articleId) {
        // Mark as read (separate from purchase)
        hasRead[msg.sender][_articleId] = true;
        
        // Emit read event for tracking
        emit ArticleRead(_articleId, msg.sender, block.timestamp);
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
     * @dev Check if user has purchased an article
     * @param _user User address
     * @param _articleId Article ID
     * @return True if user has purchased the article
     */
    function userHasPurchased(address _user, uint256 _articleId) external view returns (bool) {
        return hasPurchased[_user][_articleId];
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

