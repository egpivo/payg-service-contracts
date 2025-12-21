// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AccessLib} from "../../core/AccessLib.sol";
import {RentalBase} from "./RentalBase.sol";
import {IRentalRegistry} from "./IRentalRegistry.sol";

/**
 * @title RentalBundle
 * @dev Bundle deal: purchase multiple rentals with one payment
 * 
 * Features:
 * - Create bundle with multiple rental IDs
 * - One payment grants access to all rentals in bundle
 * - Revenue sharing: equal split or simple bps per rental
 */
contract RentalBundle is RentalBase {
    
    // Custom Errors
    error BundleIdAlreadyExists(uint256 bundleId);
    error BundleMustContainAtLeastOneRental();
    error TooManyRentalsInBundle(uint256 count, uint256 max);
    error DuplicateRentalInBundle(uint256 rentalId);
    error RentalDoesNotExistInRegistry(uint256 rentalId);
    error InvalidProvider(address provider);
    error BundleDoesNotExist(uint256 bundleId);
    error InsufficientPaymentForBundle(uint256 bundleId, uint256 required, uint256 sent);
    error RefundFailed(address recipient, uint256 amount);

    // Keep bundle sizes bounded to avoid gas griefing
    uint256 public constant MAX_RENTALS_PER_BUNDLE = 25;

    // Bundle structure
    struct Bundle {
        uint256 bundleId;
        uint256[] rentalIds;
        address creator;
        bool exists;
    }
    
    // External rental registry (e.g., RentalPayPerUse / RentalSubscription).
    // Trust boundary: this contract assumes the registry's provider mapping is correct.
    IRentalRegistry public immutable RENTAL_REGISTRY;
    
    // Mapping from bundle ID to Bundle
    mapping(uint256 => Bundle) public bundles;
    
    // Mapping from user address to bundle ID to access expiry
    mapping(address => mapping(uint256 => uint256)) public bundleAccessExpiry;
    
    // Mapping from bundle ID to access duration (0 = permanent)
    mapping(uint256 => uint256) public bundleAccessDuration;
    
    // Events
    event BundleCreated(uint256 indexed bundleId, uint256 rentalCount, uint256 price, address indexed creator);
    event BundlePurchased(uint256 indexed bundleId, address indexed buyer, uint256 expiry);
    
    /**
     * @dev Constructor
     * @param _rentalRegistry Address of rental registry contract (e.g., RentalPayPerUse)
     * @notice RentalBundle inherits from RentalBase but uses external registry for rentals
     */
    constructor(IRentalRegistry _rentalRegistry) {
        RENTAL_REGISTRY = _rentalRegistry;
    }
    
    /**
     * @dev Override getRentalService to use external rental registry
     * @notice This allows RentalBundle to access rentals from external contract
     *         instead of managing its own rentals
     */
    function getRentalService(uint256 _rentalId) external view override returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount,
        bool exists
    ) {
        return RENTAL_REGISTRY.getRentalService(_rentalId);
    }
    
    /**
     * @dev Create a bundle with multiple rentals
     * @param _bundleId Unique identifier for the bundle
     * @param _rentalIds Array of rental IDs to include in bundle
     * @param _price Price to purchase the bundle
     * @param _accessDuration Access duration in seconds (0 = permanent)
     * @notice All rentals must exist in the rental contract
     *         Only service providers or contract owner can create bundles
     */
    function createBundle(
        uint256 _bundleId,
        uint256[] memory _rentalIds,
        uint256 _price,
        uint256 _accessDuration
    ) external validPrice(_price) {
        if (bundles[_bundleId].exists) {
            revert BundleIdAlreadyExists(_bundleId);
        }
        if (_rentalIds.length == 0) {
            revert BundleMustContainAtLeastOneRental();
        }
        if (_rentalIds.length > MAX_RENTALS_PER_BUNDLE) {
            revert TooManyRentalsInBundle(_rentalIds.length, MAX_RENTALS_PER_BUNDLE);
        }
        
        // Prevent duplicate rental IDs (avoids double-paying the same underlying content)
        for (uint256 i = 0; i < _rentalIds.length; i++) {
            for (uint256 j = i + 1; j < _rentalIds.length; j++) {
                if (_rentalIds[i] == _rentalIds[j]) {
                    revert DuplicateRentalInBundle(_rentalIds[i]);
                }
            }
        }
        
        // Verify all rentals exist and have valid provider
        for (uint256 i = 0; i < _rentalIds.length; i++) {
            (, , address provider, , bool exists) = RENTAL_REGISTRY.getRentalService(_rentalIds[i]);
            if (!exists) {
                revert RentalDoesNotExistInRegistry(_rentalIds[i]);
            }
            if (provider == address(0)) {
                revert InvalidProvider(provider);
            }
        }
        
        // Manually create service record (don't register bundle creator as provider)
        // Bundle creator is just a curator, not a service provider
        if (services[_bundleId].exists) {
            revert ServiceIdAlreadyExists(_bundleId);
        }
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
            rentalIds: _rentalIds,
            creator: msg.sender,
            exists: true
        });
        
        bundleAccessDuration[_bundleId] = _accessDuration;
        
        emit BundleCreated(_bundleId, _rentalIds.length, _price, msg.sender);
    }
    
    /**
     * @dev Purchase a bundle (one payment grants access to all rentals)
     * @param _bundleId The ID of the bundle to purchase
     * @notice Revenue is split equally among rental providers
     */
    function purchaseBundle(uint256 _bundleId) external payable serviceExists(_bundleId) nonReentrant {
        Bundle storage bundle = bundles[_bundleId];
        if (!bundle.exists) {
            revert BundleDoesNotExist(_bundleId);
        }
        
        uint256 price = services[_bundleId].price;
        if (msg.value < price) {
            revert InsufficientPaymentForBundle(_bundleId, price, msg.value);
        }
        
        // Calculate revenue per rental (equal split)
        uint256 rentalCount = bundle.rentalIds.length;
        uint256 revenuePerRental = price / rentalCount;
        uint256 remainder = price % rentalCount; // Handle rounding
        
        // Distribute revenue to each rental's provider
        // Note: Providers can withdraw bundle earnings from this contract
        for (uint256 i = 0; i < rentalCount; i++) {
            (, , address provider, , ) = RENTAL_REGISTRY.getRentalService(bundle.rentalIds[i]);
            if (provider == address(0)) {
                revert InvalidProvider(provider);
            }
            earnings[provider] += revenuePerRental;
        }
        
        // Give remainder to first rental's provider
        if (remainder > 0) {
            (, , address firstProvider, , ) = RENTAL_REGISTRY.getRentalService(bundle.rentalIds[0]);
            if (firstProvider == address(0)) {
                revert InvalidProvider(firstProvider);
            }
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
            if (!ok) {
                revert RefundFailed(msg.sender, refund);
            }
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
     * @return rentalIds Array of rental IDs
     * @return price Bundle price
     * @return creator Bundle creator address
     * @return accessDuration Access duration (0 = permanent)
     * @return usageCount Number of times bundle was purchased
     */
    function getBundle(uint256 _bundleId) external view serviceExists(_bundleId) returns (
        uint256 bundleId,
        uint256[] memory rentalIds,
        uint256 price,
        address creator,
        uint256 accessDuration,
        uint256 usageCount
    ) {
        Bundle memory bundle = bundles[_bundleId];
        if (!bundle.exists) {
            revert BundleDoesNotExist(_bundleId);
        }
        
        return (
            bundle.bundleId,
            bundle.rentalIds,
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

