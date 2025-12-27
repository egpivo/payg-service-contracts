// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SplitLib
 * @dev Library for calculating revenue splits based on member shares
 * 
 * This library handles weighted revenue distribution with deterministic remainder handling.
 * Remainder is allocated to the first member (deterministic tie-breaker).
 */
library SplitLib {
    
    /**
     * @dev Calculate payout amounts for each member based on shares
     * @param netAmount Net amount to split (after fees, if any)
     * @param memberShares Array of shares for each member
     * @param totalShares Total shares across all members
     * @return payouts Array of payout amounts for each member
     * @return remainder Remaining amount (due to rounding)
     * 
     * @notice Invariant: sum(payouts) + remainder == netAmount
     */
    function calculateSplits(
        uint256 netAmount,
        uint256[] memory memberShares,
        uint256 totalShares
    ) internal pure returns (uint256[] memory payouts, uint256 remainder) {
        require(totalShares > 0, "SplitLib: totalShares must be greater than 0");
        require(memberShares.length > 0, "SplitLib: memberShares cannot be empty");
        
        uint256 memberCount = memberShares.length;
        payouts = new uint256[](memberCount);
        
        // Calculate each member's payout based on their share
        uint256 distributedAmount = 0;
        for (uint256 i = 0; i < memberCount; i++) {
            // Calculate: payout = (netAmount * memberShares[i]) / totalShares
            // This handles rounding by truncating
            payouts[i] = (netAmount * memberShares[i]) / totalShares;
            distributedAmount += payouts[i];
        }
        
        // Remainder goes to first member (deterministic tie-breaker)
        remainder = netAmount - distributedAmount;
        
        return (payouts, remainder);
    }
    
    /**
     * @dev Calculate a single member's payout
     * @param netAmount Net amount to split
     * @param memberShare Member's share
     * @param totalShares Total shares across all members
     * @return payout Amount for this member
     * @return remainder Remaining amount (only non-zero if this is the only member)
     */
    function calculateMemberPayout(
        uint256 netAmount,
        uint256 memberShare,
        uint256 totalShares
    ) internal pure returns (uint256 payout, uint256 remainder) {
        require(totalShares > 0, "SplitLib: totalShares must be greater than 0");
        
        payout = (netAmount * memberShare) / totalShares;
        remainder = netAmount - payout;
        
        return (payout, remainder);
    }
}

