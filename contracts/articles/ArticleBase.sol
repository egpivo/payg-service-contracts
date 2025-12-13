// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../PayAsYouGoBase.sol";

/**
 * @title ArticleBase
 * @dev Abstract base contract for article services
 */
abstract contract ArticleBase is PayAsYouGoBase {
    
    struct Article {
        uint256 articleId;
        string title;
        bytes32 contentHash;
        uint256 publishDate;
        uint256 accessDuration; // 0 = not applicable, > 0 = duration in seconds
    }
    
    mapping(uint256 => Article) public articles;
    
    event ArticlePublished(uint256 indexed articleId, string title, address indexed publisher);
    
    modifier articleExists(uint256 _articleId) {
        require(services[_articleId].exists, "Article does not exist");
        require(articles[_articleId].publishDate != 0, "Article data not found");
        _;
    }
    
    function _publishArticle(
        uint256 _articleId,
        uint256 _price,
        string memory _title,
        bytes32 _contentHash,
        uint256 _accessDuration
    ) internal {
        require(articles[_articleId].publishDate == 0, "Article already published");
        
        registerService(_articleId, _price);
        
        articles[_articleId] = Article({
            articleId: _articleId,
            title: _title,
            contentHash: _contentHash,
            publishDate: block.timestamp,
            accessDuration: _accessDuration
        });
        
        emit ArticlePublished(_articleId, _title, msg.sender);
    }
    
    function getArticle(uint256 _articleId) external view virtual articleExists(_articleId) returns (
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

