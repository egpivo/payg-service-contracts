// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IArticleRegistry
 * @dev Interface for accessing article information from article contracts
 * 
 * This interface allows ArticleBundle to access article data without
 * directly depending on specific article contract implementations.
 * 
 * Note: Uses getArticleService() to avoid conflict with PayAsYouGoBase.services mapping
 */
interface IArticleRegistry {
    /**
     * @dev Get service information for an article
     * @param _articleId The ID of the article
     * @return id Service ID
     * @return price Service price
     * @return provider Service provider address
     * @return usageCount Number of times service was used
     * @return exists Whether the service exists
     */
    function getArticleService(uint256 _articleId) external view returns (
        uint256 id,
        uint256 price,
        address provider,
        uint256 usageCount,
        bool exists
    );
}

