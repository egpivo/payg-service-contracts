// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PayAsYouGoBase} from "../../core/PayAsYouGoBase.sol";
import {IServiceRegistry} from "../../interfaces/IServiceRegistry.sol";
import {AccessLib} from "../../core/AccessLib.sol";
import {SplitLib} from "./SplitLib.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PoolRegistry
 * @dev Universal Pool Protocol - Composition Layer for Cross-Module Service Aggregation
 * 
 * Core Philosophy: "One payment, multiple providers, deterministic settlement."
 * 
 * Pool Protocol supports TWO distinct membership models on the same foundation:
 * 
 * 1. PAYER MEMBERSHIP (User Subscription):
 *    - Users buy: Access rights to a set of services for a time period (all-you-can-eat)
 *    - Example: Medium membership, venue pass, software subscription bundle
 *    - User = Access holder (NOT a pool member)
 * 
 * 2. PAYEE MEMBERSHIP (Provider Alliance):
 *    - Providers join: A supply-side alliance that shares revenue
 *    - Example: Creator alliance, equipment rental consortium, API provider network
 *    - Provider = Pool member (supply side)
 * 
 * Architecture:
 * - PoolRegistry is a composition layer, NOT coupled to specific modules
 * - Articles, rentals, future services are all "services that can be bundled"
 * - Modules don't need to know pools exist (clean separation of concerns)
 * - Pool accesses modules through IServiceRegistry interface
 * 
 * What Pool Handles:
 * - Bundle/pool purchase and payment
 * - Revenue splitting (weighted shares, fees, deterministic remainder)
 * - Access entitlement (time-based or permanent)
 * 
 * What Modules Handle:
 * - Domain-specific logic (availability, exclusivity, content management)
 * - Service lifecycle and state
 * - Business rules (who can use, when, how)
 * 
 * Current Implementation:
 * - Pricing Model: SubscriptionPool (pay once, get access for duration)
 *   - Future: PayPerUsePool, CreditPool, TieredPool can be added
 * - Membership Policy: Policy A (operator-controlled)
 *   - Future: Policy B (provider join/leave), Policy C (permissionless)
 * 
 * Terminology:
 * - Pool Member = Provider/Service from any module (supply side alliance)
 * - Pool Creator/Operator = Manager who controls membership
 * - User = Access holder (demand side, purchases access, not membership)
 */
contract PoolRegistry is PayAsYouGoBase {
    
    // Custom Errors
    error PoolIdAlreadyExists(uint256 poolId);
    error PoolDoesNotExist(uint256 poolId);
    error PoolMustContainAtLeastOneMember();
    error TooManyMembersInPool(uint256 count, uint256 max);
    error DuplicateMemberInPool(uint256 serviceId);
    error ServiceDoesNotExistInRegistry(uint256 serviceId, address registry);
    error InvalidShare(uint256 share);
    error OnlyPoolOperatorCanCall(uint256 poolId, address caller);
    error PoolIsPaused(uint256 poolId);
    error MemberDoesNotExist(uint256 poolId, uint256 serviceId);
    error CannotRemoveOnlyMember(uint256 poolId);
    error InsufficientPaymentForPool(uint256 poolId, uint256 required, uint256 sent);
    error RefundFailed(address recipient, uint256 amount);
    error InvalidFeeBps(uint16 feeBps);
    error InvalidRegistry(address registry);
    error PoolPriceNotSet(uint256 poolId);
    
    // Keep pool sizes bounded to avoid gas griefing
    uint256 public constant MAX_MEMBERS_PER_POOL = 25;
    
    // Pool structure (v1 MVP)
    struct Pool {
        uint256 poolId;
        address operator; // Manager who controls membership (creator becomes operator)
        uint16 operatorFeeBps; // Operator fee in basis points (e.g., 200 = 2%)
        uint256 totalShares; // Sum of all member shares
        uint256 price; // Fixed pool price (set at creation, independent of member prices)
        uint256 accessDuration; // Access duration in seconds (0 = permanent)
        bool exists;
        bool paused; // If paused, purchases are disabled
    }
    
    // Member structure
    // Stores serviceId + registry + shares
        // Provider is fetched from registry.getService(serviceId) at payout time
    struct Member {
        uint256 serviceId;
        address registry; // Service registry address (IServiceRegistry)
        uint256 shares;
        bool exists;
    }
    
    // Mapping from pool ID to Pool
    mapping(uint256 => Pool) public pools;
    
    // Mapping from pool ID to array of member service IDs
    mapping(uint256 => uint256[]) public poolMembers;
    
    // Mapping from pool ID to service ID to Member
    mapping(uint256 => mapping(uint256 => Member)) public members;
    
    // Mapping from user address to pool ID to access expiry
    mapping(address => mapping(uint256 => uint256)) public poolAccessExpiry;
    
    // Events
    event PoolCreated(uint256 indexed poolId, address indexed operator, uint256 memberCount, uint256 price);
    event PoolPaused(uint256 indexed poolId, address indexed operator);
    event PoolUnpaused(uint256 indexed poolId, address indexed operator);
    event MemberAdded(uint256 indexed poolId, uint256 indexed serviceId, address indexed registry, uint256 shares);
    event MemberRemoved(uint256 indexed poolId, uint256 indexed serviceId);
    event MemberSharesUpdated(uint256 indexed poolId, uint256 indexed serviceId, uint256 oldShares, uint256 newShares);
    event PoolPurchased(uint256 indexed poolId, address indexed buyer, uint256 required, uint256 expiry, address indexed affiliate);
    
    /**
     * @dev Constructor that sets the deployer as the initial owner
     */
    constructor() PayAsYouGoBase() {}
    
    // Modifiers
    /**
     * @dev Modifier to check if pool exists
     * @param _poolId The ID of the pool to check
     */
    modifier poolExists(uint256 _poolId) {
        if (!pools[_poolId].exists) {
            revert PoolDoesNotExist(_poolId);
        }
        _;
    }
    
    /**
     * @dev Modifier to check if caller is the pool operator
     * @param _poolId The ID of the pool
     */
    modifier onlyPoolOperator(uint256 _poolId) {
        if (pools[_poolId].operator != msg.sender) {
            revert OnlyPoolOperatorCanCall(_poolId, msg.sender);
        }
        _;
    }
    
    /**
     * @dev Modifier to check if pool is not paused
     * @param _poolId The ID of the pool
     */
    modifier poolNotPaused(uint256 _poolId) {
        if (pools[_poolId].paused) {
            revert PoolIsPaused(_poolId);
        }
        _;
    }
    
    /**
     * @dev Create a pool with multiple provider members from any service registry (v1 MVP)
     * @param _poolId Unique identifier for the pool
     * @param _serviceIds Array of service IDs
     * @param _registries Array of registry addresses for each service (must match _serviceIds length)
     * @param _shares Array of shares for each member (must match _serviceIds length)
     * @param _price Fixed pool price (independent of member service prices)
     * @param _accessDuration Access duration in seconds (0 = permanent)
     * @param _operatorFeeBps Operator fee in basis points (max 10000 = 100%)
     * @notice Pool creator becomes operator. Affiliate tracking available via events but no fee in v1.
     *         Services can come from any module (articles, rentals, etc.) via their registries
     */
    function createPool(
        uint256 _poolId,
        uint256[] memory _serviceIds,
        address[] memory _registries,
        uint256[] memory _shares,
        uint256 _price,
        uint256 _accessDuration,
        uint16 _operatorFeeBps
    ) external validPrice(_price) {
        if (pools[_poolId].exists) {
            revert PoolIdAlreadyExists(_poolId);
        }
        if (_serviceIds.length == 0) {
            revert PoolMustContainAtLeastOneMember();
        }
        if (_serviceIds.length > MAX_MEMBERS_PER_POOL) {
            revert TooManyMembersInPool(_serviceIds.length, MAX_MEMBERS_PER_POOL);
        }
        if (_serviceIds.length != _shares.length || _serviceIds.length != _registries.length) {
            revert InvalidShare(0); // Use InvalidShare to indicate length mismatch
        }
        
        // Prevent duplicate service IDs (same serviceId + registry combination)
        for (uint256 i = 0; i < _serviceIds.length; i++) {
            for (uint256 j = i + 1; j < _serviceIds.length; j++) {
                if (_serviceIds[i] == _serviceIds[j] && _registries[i] == _registries[j]) {
                    revert DuplicateMemberInPool(_serviceIds[i]);
                }
            }
        }
        
        // Verify all services exist in their registries and have valid shares
        uint256 totalShares = 0;
        for (uint256 i = 0; i < _serviceIds.length; i++) {
            if (_registries[i] == address(0)) {
                revert InvalidRegistry(_registries[i]);
            }
            if (_shares[i] == 0) {
                revert InvalidShare(_shares[i]);
            }
            
            // Check service exists via registry interface
            IServiceRegistry registry = IServiceRegistry(_registries[i]);
            (,, bool exists) = registry.getService(_serviceIds[i]);
            if (!exists) {
                revert ServiceDoesNotExistInRegistry(_serviceIds[i], _registries[i]);
            }
            
            totalShares += _shares[i];
        }
        
        // Validate fees (v1: only operator fee)
        if (_operatorFeeBps > 10000) {
            revert InvalidFeeBps(_operatorFeeBps);
        }
        
        // Create service record for the pool (pool itself is a service in PayAsYouGoBase)
        if (services[_poolId].exists) {
            revert ServiceIdAlreadyExists(_poolId);
        }
        services[_poolId] = Service({
            id: _poolId,
            price: _price,
            provider: address(0), // Pool operator is not a provider
            usageCount: 0,
            exists: true
        });
        serviceIds.push(_poolId);
        emit ServiceRegistered(_poolId, address(0), _price);
        
        // Store pool data (v1 MVP: operator = creator, no affiliate fee)
        pools[_poolId] = Pool({
            poolId: _poolId,
            operator: msg.sender, // Creator becomes operator
            operatorFeeBps: _operatorFeeBps,
            totalShares: totalShares,
            price: _price,
            accessDuration: _accessDuration,
            exists: true,
            paused: false
        });
        
        // Store members
        for (uint256 i = 0; i < _serviceIds.length; i++) {
            poolMembers[_poolId].push(_serviceIds[i]);
            members[_poolId][_serviceIds[i]] = Member({
                serviceId: _serviceIds[i],
                registry: _registries[i],
                shares: _shares[i],
                exists: true
            });
        }
        
        emit PoolCreated(_poolId, msg.sender, _serviceIds.length, _price);
    }
    
    /**
     * @dev Pause a pool (disables purchases)
     * @param _poolId The ID of the pool to pause
     */
    function pausePool(uint256 _poolId) external poolExists(_poolId) onlyPoolOperator(_poolId) {
        pools[_poolId].paused = true;
        emit PoolPaused(_poolId, msg.sender);
    }
    
    /**
     * @dev Unpause a pool (enables purchases)
     * @param _poolId The ID of the pool to unpause
     */
    function unpausePool(uint256 _poolId) external poolExists(_poolId) onlyPoolOperator(_poolId) {
        pools[_poolId].paused = false;
        emit PoolUnpaused(_poolId, msg.sender);
    }
    
    /**
     * @dev Add a new member to a pool
     * @param _poolId The ID of the pool
     * @param _serviceId The service ID to add as member
     * @param _registry The service registry address
     * @param _shares The shares for this member
     * @notice Only pool operator can add members
     */
    function addMember(
        uint256 _poolId,
        uint256 _serviceId,
        address _registry,
        uint256 _shares
    ) external poolExists(_poolId) onlyPoolOperator(_poolId) {
        if (members[_poolId][_serviceId].exists) {
            revert DuplicateMemberInPool(_serviceId);
        }
        if (_registry == address(0)) {
            revert InvalidRegistry(_registry);
        }
        if (_shares == 0) {
            revert InvalidShare(_shares);
        }
        if (poolMembers[_poolId].length >= MAX_MEMBERS_PER_POOL) {
            revert TooManyMembersInPool(poolMembers[_poolId].length + 1, MAX_MEMBERS_PER_POOL);
        }
        
        // Verify service exists in registry
        IServiceRegistry registry = IServiceRegistry(_registry);
            (,, bool exists) = registry.getService(_serviceId);
        if (!exists) {
            revert ServiceDoesNotExistInRegistry(_serviceId, _registry);
        }
        
        poolMembers[_poolId].push(_serviceId);
        members[_poolId][_serviceId] = Member({
            serviceId: _serviceId,
            registry: _registry,
            shares: _shares,
            exists: true
        });
        
        pools[_poolId].totalShares += _shares;
        
        emit MemberAdded(_poolId, _serviceId, _registry, _shares);
    }
    
    /**
     * @dev Remove a member from a pool
     * @param _poolId The ID of the pool
     * @param _serviceId The service ID to remove
     * @notice Only pool operator can remove members
     *         Cannot remove if it's the only member
     */
    function removeMember(
        uint256 _poolId,
        uint256 _serviceId
    ) external poolExists(_poolId) onlyPoolOperator(_poolId) {
        if (!members[_poolId][_serviceId].exists) {
            revert MemberDoesNotExist(_poolId, _serviceId);
        }
        if (poolMembers[_poolId].length == 1) {
            revert CannotRemoveOnlyMember(_poolId);
        }
        
        Member memory member = members[_poolId][_serviceId];
        pools[_poolId].totalShares -= member.shares;
        
        // Remove from members mapping
        delete members[_poolId][_serviceId];
        
        // Remove from array
        uint256[] storage memberIds = poolMembers[_poolId];
        for (uint256 i = 0; i < memberIds.length; i++) {
            if (memberIds[i] == _serviceId) {
                memberIds[i] = memberIds[memberIds.length - 1];
                memberIds.pop();
                break;
            }
        }
        
        emit MemberRemoved(_poolId, _serviceId);
    }
    
    /**
     * @dev Update shares for a member
     * @param _poolId The ID of the pool
     * @param _serviceId The service ID of the member
     * @param _newShares The new shares value
     * @notice Only pool operator can update shares
     */
    function setShares(
        uint256 _poolId,
        uint256 _serviceId,
        uint256 _newShares
    ) external poolExists(_poolId) onlyPoolOperator(_poolId) {
        if (!members[_poolId][_serviceId].exists) {
            revert MemberDoesNotExist(_poolId, _serviceId);
        }
        if (_newShares == 0) {
            revert InvalidShare(_newShares);
        }
        
        Member storage member = members[_poolId][_serviceId];
        uint256 oldShares = member.shares;
        
        pools[_poolId].totalShares = pools[_poolId].totalShares - oldShares + _newShares;
        member.shares = _newShares;
        
        emit MemberSharesUpdated(_poolId, _serviceId, oldShares, _newShares);
    }
    
    /**
     * @dev Get pool details (v1 MVP)
     * @param _poolId The ID of the pool
     * @return poolId Pool ID
     * @return operator Pool operator address (creator becomes operator)
     * @return memberCount Number of members
     * @return totalShares Total shares in pool
     * @return price Pool purchase price (fixed, independent of member prices)
     * @return operatorFeeBps Operator fee in basis points
     * @return paused Whether pool is paused
     * @return accessDuration Access duration (0 = permanent)
     * @return usageCount Number of times pool was purchased
     */
    function getPool(uint256 _poolId) external view poolExists(_poolId) returns (
        uint256 poolId,
        address operator,
        uint256 memberCount,
        uint256 totalShares,
        uint256 price,
        uint16 operatorFeeBps,
        bool paused,
        uint256 accessDuration,
        uint256 usageCount
    ) {
        Pool memory pool = pools[_poolId];
        return (
            pool.poolId,
            pool.operator,
            poolMembers[_poolId].length,
            pool.totalShares,
            pool.price,
            pool.operatorFeeBps,
            pool.paused,
            pool.accessDuration,
            services[_poolId].usageCount
        );
    }
    
    /**
     * @dev Get member details
     * @param _poolId The ID of the pool
     * @param _serviceId The service ID of the member
     * @return serviceId Member service ID
     * @return registry Service registry address
     * @return shares Member shares
     * @return exists Whether member exists
     */
    function getMember(
        uint256 _poolId,
        uint256 _serviceId
    ) external view poolExists(_poolId) returns (
        uint256 serviceId,
        address registry,
        uint256 shares,
        bool exists
    ) {
        Member memory member = members[_poolId][_serviceId];
        return (member.serviceId, member.registry, member.shares, member.exists);
    }
    
    /**
     * @dev Get all member service IDs for a pool
     * @param _poolId The ID of the pool
     * @return Array of service IDs
     */
    function getPoolMembers(uint256 _poolId) external view poolExists(_poolId) returns (uint256[] memory) {
        return poolMembers[_poolId];
    }
    
    /**
     * @dev Purchase access to a pool (v1 MVP - SubscriptionPool only)
     * @param _poolId The ID of the pool to purchase
     * @param _affiliate Optional affiliate address (tracked via event in v1, no fee)
     * @notice Purchase flow:
     *         1. Calculate operator fee
     *         2. Net revenue = pool.price - operatorFee
     *         3. Split net revenue among members based on shares
     *         4. Remainder goes to first member (deterministic tie-breaker)
     *         5. All payouts via earnings accounting (no direct transfers)
     *         6. Update access expiry (monotonic: extend from max(now, currentExpiry))
     *         Provider addresses are fetched from each member's registry at payout time
     */
    function purchasePool(uint256 _poolId, address _affiliate) external payable poolExists(_poolId) poolNotPaused(_poolId) serviceExists(_poolId) nonReentrant {
        Pool storage pool = pools[_poolId];
        if (!pool.exists) {
            revert PoolDoesNotExist(_poolId);
        }
        
        uint256 required = pool.price;
        if (msg.value < required) {
            revert InsufficientPaymentForPool(_poolId, required, msg.value);
        }
        
        // Calculate fees (v1: only operator fee, affiliate tracked via event but no fee)
        uint256 operatorFee = (required * pool.operatorFeeBps) / 10_000;
        uint256 net = required - operatorFee;
        
        // Credit operator fee to earnings (all payouts via earnings accounting, no direct transfers)
        if (operatorFee > 0 && pool.operator != address(0)) {
            earnings[pool.operator] += operatorFee;
        }
        
        // Note: Affiliate tracking via event only in v1 (no fee collection)
        
        // Split net revenue among members
        uint256[] memory memberIds = poolMembers[_poolId];
        uint256 memberCount = memberIds.length;
        
        // Build array of shares for SplitLib
        uint256[] memory memberShares = new uint256[](memberCount);
        for (uint256 i = 0; i < memberCount; i++) {
            memberShares[i] = members[_poolId][memberIds[i]].shares;
        }
        
        // Calculate revenue splits
        (uint256[] memory payouts, uint256 remainder) = SplitLib.calculateSplits(
            net,
            memberShares,
            pool.totalShares
        );
        
        // Distribute revenue to each member's provider
        // Provider is fetched from each member's registry at payout time
        for (uint256 i = 0; i < memberCount; i++) {
            uint256 serviceId = memberIds[i];
            Member memory member = members[_poolId][serviceId];
            IServiceRegistry registry = IServiceRegistry(member.registry);
            
            (, address provider, ) = registry.getService(serviceId);
            if (provider == address(0)) {
                revert ServiceDoesNotExistInRegistry(serviceId, member.registry);
            }
            earnings[provider] += payouts[i];
        }
        
        // Give remainder to first member's provider (deterministic tie-breaker)
        if (remainder > 0) {
            uint256 firstServiceId = memberIds[0];
            Member memory firstMember = members[_poolId][firstServiceId];
            IServiceRegistry registry = IServiceRegistry(firstMember.registry);
            
            (, address firstProvider, ) = registry.getService(firstServiceId);
            if (firstProvider == address(0)) {
                revert ServiceDoesNotExistInRegistry(firstServiceId, firstMember.registry);
            }
            earnings[firstProvider] += remainder;
        }
        
        // Update access expiry
        uint256 currentExpiry = poolAccessExpiry[msg.sender][_poolId];
        uint256 duration = pool.accessDuration;
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, block.timestamp, duration);
        poolAccessExpiry[msg.sender][_poolId] = expiry;
        
        // Refund excess payment
        uint256 refund = msg.value - required;
        
        // Increment usage count
        services[_poolId].usageCount += 1;
        
        emit PoolPurchased(_poolId, msg.sender, required, expiry, _affiliate);
        emit ServiceUsed(_poolId, msg.sender, services[_poolId].usageCount);
        
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            if (!ok) {
                revert RefundFailed(msg.sender, refund);
            }
        }
    }
    
    /**
     * @dev Check if user has valid access to a pool
     * @param _user User address
     * @param _poolId Pool ID
     * @return True if user has valid access
     */
    function hasPoolAccess(address _user, uint256 _poolId) external view poolExists(_poolId) returns (bool) {
        return AccessLib.isValid(poolAccessExpiry[_user][_poolId], block.timestamp);
    }
    
    /**
     * @dev Get access expiry for a user and pool
     * @param _user User address
     * @param _poolId Pool ID
     * @return Expiry timestamp (0 if never purchased, max uint256 if permanent)
     */
    function getPoolAccessExpiry(address _user, uint256 _poolId) external view poolExists(_poolId) returns (uint256) {
        return poolAccessExpiry[_user][_poolId];
    }
}
