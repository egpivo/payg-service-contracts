// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ArticleBase.sol";

/**
 * @title ArticlePayPerRead
 * @dev Pay-per-read article service (gas efficient)
 * 
 * Pattern: Pay each time you read
 * - No accessExpiry storage writes (saves gas)
 * - Tracking via events for off-chain analytics
 */
contract ArticlePayPerRead is ArticleBase {
    
    // Events
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    
    /**
     * @dev Register an article as a service
     * @param _articleId Unique identifier for the article
     * @param _price Price to read the article
     * @param _title Title of the article
     * @param _contentHash Hash of the article content (for verification)
     * @notice Pay-per-read pattern: accessDuration is not applicable (set to 0)
     */
    function publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash
    ) external {
        // Call internal publishArticle with accessDuration = 0 (not applicable for pay-per-read)
        _publishArticle(_articleId, _price, _title, _contentHash, 0);
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
    
}

