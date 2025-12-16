// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AccessLib} from "../AccessLib.sol";
import "../PayAsYouGoBase.sol";
import "./IArticleRegistry.sol";

/**
 * @title ArticleBundle
 * @dev Bundle deal: purchase multiple articles with one payment
 * 
 * Features:
 * - Create bundle with multiple article IDs
 * - One payment grants access to all articles in bundle
 * - Revenue sharing: equal split or simple bps per article
 */
contract ArticleBundle is PayAsYouGoBase {
    
    // Simple reentrancy guard (avoid pulling OZ for this learning repo)
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    // Keep bundle sizes bounded to avoid gas griefing
    uint256 public constant MAX_ARTICLES_PER_BUNDLE = 25;

    // Bundle structure
    struct Bundle {
        uint256 bundleId;
        uint256[] articleIds;
        address creator;
        bool exists;
    }
    
    // Reference to article registry contract (implements IArticleRegistry)
    IArticleRegistry public articleRegistry;
    
    // Mapping from bundle ID to Bundle
    mapping(uint256 => Bundle) public bundles;
    
    // Mapping from user address to bundle ID to access expiry
    mapping(address => mapping(uint256 => uint256)) public bundleAccessExpiry;
    
    // Mapping from bundle ID to access duration (0 = permanent)
    mapping(uint256 => uint256) public bundleAccessDuration;
    
    // Events
    event BundleCreated(uint256 indexed bundleId, uint256 articleCount, uint256 price, address indexed creator);
    event BundlePurchased(uint256 indexed bundleId, address indexed buyer, uint256 expiry);
    
    /**
     * @dev Constructor
     * @param _articleRegistry Address of article registry contract (e.g., ArticlePayPerRead)
     */
    constructor(IArticleRegistry _articleRegistry) {
        articleRegistry = _articleRegistry;
    }
    
    /**
     * @dev Create a bundle with multiple articles
     * @param _bundleId Unique identifier for the bundle
     * @param _articleIds Array of article IDs to include in bundle
     * @param _price Price to purchase the bundle
     * @param _accessDuration Access duration in seconds (0 = permanent)
     * @notice All articles must exist in the article contract
     */
    function createBundle(
        uint256 _bundleId,
        uint256[] memory _articleIds,
        uint256 _price,
        uint256 _accessDuration
    ) external validPrice(_price) {
        require(!bundles[_bundleId].exists, "Bundle ID already exists");
        require(_articleIds.length > 0, "Bundle must contain at least one article");
        require(_articleIds.length <= MAX_ARTICLES_PER_BUNDLE, "Too many articles");
        
        // Verify all articles exist
        for (uint256 i = 0; i < _articleIds.length; i++) {
            (, , , , bool exists) = articleRegistry.getArticleService(_articleIds[i]);
            require(exists, "Article does not exist");
        }
        
        // Manually create service record (don't register bundle creator as provider)
        // Bundle creator is just a curator, not a service provider
        require(!services[_bundleId].exists, "Service ID already exists");
        services[_bundleId] = Service({
            id: _bundleId,
            price: _price,
            provider: address(0), // Bundle creator is not a provider
            usageCount: 0,
            exists: true
        });
        serviceIds.push(_bundleId);
        emit ServiceRegistered(_bundleId, address(0), _price);
        
        // Store bundle data
        bundles[_bundleId] = Bundle({
            bundleId: _bundleId,
            articleIds: _articleIds,
            creator: msg.sender,
            exists: true
        });
        
        bundleAccessDuration[_bundleId] = _accessDuration;
        
        emit BundleCreated(_bundleId, _articleIds.length, _price, msg.sender);
    }
    
    /**
     * @dev Purchase a bundle (one payment grants access to all articles)
     * @param _bundleId The ID of the bundle to purchase
     * @notice Revenue is split equally among article providers
     */
    function purchaseBundle(uint256 _bundleId) external payable serviceExists(_bundleId) nonReentrant {
        Bundle storage bundle = bundles[_bundleId];
        require(bundle.exists, "Bundle does not exist");
        
        uint256 price = services[_bundleId].price;
        require(msg.value >= price, "Insufficient payment");
        
        // Calculate revenue per article (equal split)
        uint256 articleCount = bundle.articleIds.length;
        uint256 revenuePerArticle = price / articleCount;
        uint256 remainder = price % articleCount; // Handle rounding
        
        // Distribute revenue to each article's provider
        // Note: Providers can withdraw bundle earnings from this contract
        for (uint256 i = 0; i < articleCount; i++) {
            (, , address provider, , ) = articleRegistry.getArticleService(bundle.articleIds[i]);
            earnings[provider] += revenuePerArticle;
        }
        
        // Give remainder to first article's provider
        if (remainder > 0) {
            (, , address firstProvider, , ) = articleRegistry.getArticleService(bundle.articleIds[0]);
            earnings[firstProvider] += remainder;
        }
        
        uint256 currentExpiry = bundleAccessExpiry[msg.sender][_bundleId];
        uint256 duration = bundleAccessDuration[_bundleId];
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, block.timestamp, duration);
        bundleAccessExpiry[msg.sender][_bundleId] = expiry;
        
        uint256 refund = msg.value - price;
        
        // Increment usage count
        services[_bundleId].usageCount += 1;
        
        emit BundlePurchased(_bundleId, msg.sender, expiry);
        emit ServiceUsed(_bundleId, msg.sender, services[_bundleId].usageCount);
        
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "Refund failed");
        }
    }
    
    /**
     * @dev Check if user has valid access to a bundle
     * @param _user User address
     * @param _bundleId Bundle ID
     * @return True if user has valid access
     */
    function hasBundleAccess(address _user, uint256 _bundleId) external view returns (bool) {
        return AccessLib.isValid(bundleAccessExpiry[_user][_bundleId], block.timestamp);
    }
    
    /**
     * @dev Get bundle details
     * @param _bundleId The ID of the bundle
     * @return bundleId Bundle ID
     * @return articleIds Array of article IDs
     * @return price Bundle price
     * @return creator Bundle creator address
     * @return accessDuration Access duration (0 = permanent)
     * @return usageCount Number of times bundle was purchased
     */
    function getBundle(uint256 _bundleId) external view serviceExists(_bundleId) returns (
        uint256 bundleId,
        uint256[] memory articleIds,
        uint256 price,
        address creator,
        uint256 accessDuration,
        uint256 usageCount
    ) {
        Bundle memory bundle = bundles[_bundleId];
        require(bundle.exists, "Bundle does not exist");
        
        return (
            bundle.bundleId,
            bundle.articleIds,
            services[_bundleId].price,
            bundle.creator,
            bundleAccessDuration[_bundleId],
            services[_bundleId].usageCount
        );
    }
    
    /**
     * @dev Get access expiry for a user and bundle
     * @param _user User address
     * @param _bundleId Bundle ID
     * @return Expiry timestamp (0 if never purchased, max uint256 if permanent)
     */
    function getBundleAccessExpiry(address _user, uint256 _bundleId) external view returns (uint256) {
        return bundleAccessExpiry[_user][_bundleId];
    }
}
