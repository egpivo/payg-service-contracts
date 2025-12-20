// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {RentalBase} from "../RentalBase.sol";
import {AccessLib} from "../../../core/AccessLib.sol";

/**
 * @title SpaceSubscription
 * @dev Subscription-based space rental service (rent once, use multiple times)
 * 
 * Pattern: Rent once, then use multiple times during access period
 * - Writes to accessExpiry storage (cost consideration for high-volume)
 * - Spaces are exclusive (one user at a time during rental period)
 * - Supports security deposits
 * 
 * Service-specific layer: Defines concrete behavior for space subscription rentals
 */
contract SpaceSubscription is RentalBase {
    
    // Mapping from user address to rental ID to access expiry timestamp
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    
    // Mapping from user address to rental ID to deposit held
    mapping(address => mapping(uint256 => uint256)) public depositsHeld;
    
    // Mapping from rental ID to default access duration (0 = permanent)
    mapping(uint256 => uint256) public rentalAccessDuration;
    
    // Mapping from rental ID to default deposit amount (0 if not required)
    mapping(uint256 => uint256) public rentalDeposit;
    
    // Total deposits held across all users and rentals (for escrow accounting)
    uint256 public totalDepositsHeld;
    
    // Events
    event SpaceRented(uint256 indexed rentalId, address indexed renter, uint256 expiry, uint256 deposit);
    event SpaceUsed(uint256 indexed rentalId, address indexed renter, uint256 timestamp);
    event DepositReturned(uint256 indexed rentalId, address indexed renter, uint256 amount);
    
    // Custom Errors
    error AccessNotGranted(address user, uint256 rentalId);
    error AccessExpired(address user, uint256 rentalId, uint256 expiry, uint256 currentTime);
    error InsufficientDeposit(uint256 rentalId, uint256 required, uint256 sent);
    error NoDepositToReturn(address user, uint256 rentalId);
    error InsufficientContractBalance(uint256 required, uint256 available);
    
    /**
     * @dev Modifier to check if user's access is still valid
     * @param _rentalId The ID of the rental
     */
    modifier withinAccessPeriod(uint256 _rentalId) {
        _withinAccessPeriod(_rentalId);
        _;
    }
    
    /**
     * @dev Internal function to check if user's access is still valid
     * @param _rentalId The ID of the rental
     */
    function _withinAccessPeriod(uint256 _rentalId) internal view {
        uint256 expiry = accessExpiry[msg.sender][_rentalId];
        if (expiry == 0) {
            revert AccessNotGranted(msg.sender, _rentalId);
        }
        if (block.timestamp > expiry) {
            revert AccessExpired(msg.sender, _rentalId, expiry, block.timestamp);
        }
    }
    
    /**
     * @dev List a space for rental
     * @param _rentalId Unique identifier for the space
     * @param _price Price to rent the space
     * @param _name Name of the space
     * @param _description Description of the space
     * @param _assetHash Hash of the space metadata (for verification)
     * @param _accessDuration Access duration in seconds (0 = permanent)
     * @param _deposit Security deposit amount (0 if not required)
     * @notice Spaces are exclusive by default (one user at a time)
     */
    function listSpace(
        uint256 _rentalId,
        uint256 _price,
        string memory _name,
        string memory _description,
        bytes32 _assetHash,
        uint256 _accessDuration,
        uint256 _deposit
    ) external {
        // Spaces are exclusive by default
        _listRental(_rentalId, _price, _name, _description, _assetHash, true);
        
        // Store access duration and deposit (service-specific data)
        rentalAccessDuration[_rentalId] = _accessDuration;
        rentalDeposit[_rentalId] = _deposit;
    }
    
    /**
     * @dev Rent a space (pay once, use multiple times during access period)
     * @param _rentalId The ID of the space to rent
     * @notice Subscription pattern: Rent once, then use multiple times without paying
     *         Uses default access duration and deposit from listing
     *         Allows renewal: If access not expired, extends from current expiry
     *         If expired, starts from now. Writes to accessExpiry storage (gas cost)
     *         Also handles security deposit if required
     */
    function rentSpace(uint256 _rentalId) external payable rentalAvailable(_rentalId) {
        // Get default access duration and deposit from listing
        uint256 _accessDuration = rentalAccessDuration[_rentalId];
        uint256 _deposit = rentalDeposit[_rentalId];
        uint256 price = services[_rentalId].price;
        uint256 totalRequired = price + _deposit;
        
        // Check payment upfront (before any refunds)
        if (msg.value < totalRequired) {
            revert InsufficientDeposit(_rentalId, totalRequired, msg.value);
        }
        
        // Manually handle payment accounting (don't call useService to avoid refunds)
        // Add rental price to provider's earnings (deposit is held separately)
        earnings[services[_rentalId].provider] += price;
        
        // Handle deposit: check for existing deposit first to prevent double-charging on renewal
        uint256 existingDeposit = depositsHeld[msg.sender][_rentalId];
        if (_deposit > 0) {
            if (existingDeposit > 0) {
                if (existingDeposit != _deposit) {
                    // Deposit amount changed: refund old deposit first, then charge new one
                    // This prevents locking user funds and inflating totalDepositsHeld
                    depositsHeld[msg.sender][_rentalId] = 0;
                    totalDepositsHeld -= existingDeposit;
                    
                    // Refund old deposit to user
                    (bool refundSuccess, ) = payable(msg.sender).call{value: existingDeposit}("");
                    if (!refundSuccess) {
                        revert TransferFailed(msg.sender, existingDeposit);
                    }
                    
                    // Set new deposit
                    depositsHeld[msg.sender][_rentalId] = _deposit;
                    totalDepositsHeld += _deposit; // Track total deposits for escrow accounting
                }
                // If existingDeposit == _deposit, no action needed (deposit already correct)
            } else {
                // No existing deposit: set new deposit
                depositsHeld[msg.sender][_rentalId] = _deposit;
                totalDepositsHeld += _deposit; // Track total deposits for escrow accounting
            }
        } else if (existingDeposit > 0) {
            // Deposit requirement removed: refund existing deposit
            depositsHeld[msg.sender][_rentalId] = 0;
            totalDepositsHeld -= existingDeposit;
            
            // Refund existing deposit to user
            (bool refundSuccess, ) = payable(msg.sender).call{value: existingDeposit}("");
            if (!refundSuccess) {
                revert TransferFailed(msg.sender, existingDeposit);
            }
        }
        
        // Increment usage count
        services[_rentalId].usageCount += 1;
        
        // Set access expiry time (storage write - gas cost)
        uint256 currentExpiry = accessExpiry[msg.sender][_rentalId];
        uint256 expiry = AccessLib.computeExpiry(currentExpiry, block.timestamp, _accessDuration);
        accessExpiry[msg.sender][_rentalId] = expiry;
        
        // For exclusive spaces, mark as in use during rental period
        _startExclusiveRental(_rentalId, msg.sender, expiry);
        
        // Refund excess payment if any (only once, after all accounting)
        if (msg.value > totalRequired) {
            uint256 refundAmount = msg.value - totalRequired;
            (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
            if (!success) {
                revert TransferFailed(msg.sender, refundAmount);
            }
        }
        
        // Emit events
        emit ServiceUsed(_rentalId, msg.sender, services[_rentalId].usageCount);
        emit SpaceRented(_rentalId, msg.sender, expiry, _deposit);
    }
    
    /**
     * @dev Use space after renting (no payment required)
     * @param _rentalId The ID of the space to use
     * @notice Requires valid access period (rented and not expired)
     *         This is the "rent once, use multiple times" pattern
     */
    function useSpace(uint256 _rentalId) external rentalExists(_rentalId) withinAccessPeriod(_rentalId) {
        // Verify user is the current renter (for exclusive spaces)
        Rental memory rental = rentals[_rentalId];
        if (rental.exclusive) {
            require(currentRenter[_rentalId] == msg.sender, "Not the current renter");
        }
        
        // Emit use event for tracking
        emit SpaceUsed(_rentalId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Return deposit to renter (owner can call this after space is returned)
     * @param _rentalId The ID of the space
     * @param _renter The address of the renter
     * @notice Only the space owner can return deposits
     */
    function returnDeposit(uint256 _rentalId, address _renter) 
        external 
        rentalExists(_rentalId) 
        onlyProvider(_rentalId) 
    {
        uint256 depositAmount = depositsHeld[_renter][_rentalId];
        if (depositAmount == 0) {
            revert NoDepositToReturn(_renter, _rentalId);
        }
        
        // Reset deposit before transfer to prevent reentrancy
        depositsHeld[_renter][_rentalId] = 0;
        totalDepositsHeld -= depositAmount; // Decrement total deposits held
        
        // Transfer deposit back
        (bool success, ) = payable(_renter).call{value: depositAmount}("");
        if (!success) {
            revert TransferFailed(_renter, depositAmount);
        }
        
        emit DepositReturned(_rentalId, _renter, depositAmount);
    }
    
    /**
     * @dev Check if user has valid access to a space
     * @param _user User address
     * @param _rentalId Space ID
     * @return True if user has valid access
     */
    function hasValidAccess(address _user, uint256 _rentalId) external view returns (bool) {
        return AccessLib.isValid(accessExpiry[_user][_rentalId], block.timestamp);
    }
    
    /**
     * @dev Get access expiry time for a user and space
     * @param _user User address
     * @param _rentalId Space ID
     * @return Expiry timestamp (0 if never rented, max uint256 if permanent)
     */
    function getAccessExpiry(address _user, uint256 _rentalId) external view returns (uint256) {
        return accessExpiry[_user][_rentalId];
    }
    
    /**
     * @dev Get deposit amount held for a user and space
     * @param _user User address
     * @param _rentalId Space ID
     * @return Deposit amount held
     */
    function getDepositHeld(address _user, uint256 _rentalId) external view returns (uint256) {
        return depositsHeld[_user][_rentalId];
    }
    
    /**
     * @dev Withdraw earnings for a provider (with escrow protection)
     * @notice Overrides base withdraw to ensure deposits are not withdrawn
     *         Only allows withdrawal if contract balance >= totalDepositsHeld + earnings
     *         This ensures deposits remain locked in the contract (true escrow)
     */
    function withdraw() public override nonReentrant {
        uint256 amount = earnings[msg.sender];
        if (amount == 0) {
            revert NoEarningsToWithdraw(msg.sender);
        }
        
        // Ensure contract balance is sufficient to cover all deposits + this withdrawal
        // This prevents withdrawing deposits that should be held in escrow
        uint256 requiredBalance = totalDepositsHeld + amount;
        uint256 contractBalance = address(this).balance;
        if (contractBalance < requiredBalance) {
            revert InsufficientContractBalance(requiredBalance, contractBalance);
        }
        
        // Effects: Reset earnings before transfer to prevent reentrancy
        earnings[msg.sender] = 0;
        
        // Interactions: Transfer earnings to provider (deposits remain in contract)
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed(msg.sender, amount);
        }
        
        emit Withdrawn(msg.sender, amount);
    }
}

