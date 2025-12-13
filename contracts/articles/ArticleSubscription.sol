// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ArticleBase.sol";
import "../AccessLib.sol";

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
contract ArticleSubscription is ArticleBase {
    
    // Mapping from user address to article IDs they've purchased
    mapping(address => mapping(uint256 => bool)) public hasPurchased;
    
    // Mapping from user address to article IDs they've read
    mapping(address => mapping(uint256 => bool)) public hasRead;
    
    // Mapping from user address to article ID to access expiry timestamp
    // Cost consideration: Each purchase writes to storage (user x article = storage slot)
    // For high-volume scenarios, consider off-chain entitlement tracking via events
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    
    // Events
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    event ArticlePurchased(uint256 indexed articleId, address indexed buyer, uint256 expiry);
    
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
        // Call internal publishArticle from ArticleBase
        _publishArticle(_articleId, _price, _title, _contentHash, _accessDuration);
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
        uint256 expiry = AccessLib.computeExpiry(
            currentExpiry,
            block.timestamp,
            article.accessDuration
        );
        accessExpiry[msg.sender][_articleId] = expiry;
        
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
        return AccessLib.isValid(expiry, block.timestamp);
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

