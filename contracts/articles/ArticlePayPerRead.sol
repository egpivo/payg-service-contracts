// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ArticleBase.sol";

/**
 * @title ArticlePayPerRead
 * @dev Pay-per-read article service (gas efficient, no storage writes)
 */
contract ArticlePayPerRead is ArticleBase {
    
    event ArticleRead(uint256 indexed articleId, address indexed reader, uint256 timestamp);
    
    function publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash
    ) external {
        _publishArticle(_articleId, _price, _title, _contentHash, 0);
    }
    
    function readArticle(uint256 _articleId) external payable articleExists(_articleId) {
        useService(_articleId);
        emit ArticleRead(_articleId, msg.sender, block.timestamp);
    }
}

