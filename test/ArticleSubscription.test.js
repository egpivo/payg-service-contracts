const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArticleSubscription", function () {
  let articleSubscription;
  let owner;
  let publisher;
  let reader;

  beforeEach(async function () {
    [owner, publisher, reader] = await ethers.getSigners();

    const ArticleSubscription = await ethers.getContractFactory("ArticleSubscription");
    articleSubscription = await ArticleSubscription.deploy();
    await articleSubscription.waitForDeployment();
  });

  describe("Article Publishing", function () {
    it("Should publish an article with metadata", async function () {
      const articleId = 1;
      const price = ethers.parseEther("0.001");
      const title = "Introduction to Solidity";
      const contentHash = ethers.id("article content");
      const accessDuration = 2 * 24 * 60 * 60; // 2 days in seconds

      await expect(
        articleSubscription.connect(publisher).publishArticle(articleId, price, title, contentHash, accessDuration)
      )
        .to.emit(articleSubscription, "ServiceRegistered")
        .withArgs(articleId, publisher.address, price)
        .and.to.emit(articleSubscription, "ArticlePublished")
        .withArgs(articleId, title, publisher.address);

      const article = await articleSubscription.getArticle(articleId);
      expect(article.articleId).to.equal(articleId);
      expect(article.title).to.equal(title);
      expect(article.contentHash).to.equal(contentHash);
      expect(article.price).to.equal(price);
      expect(article.provider).to.equal(publisher.address);
      expect(article.accessDuration).to.equal(accessDuration);
    });

    it("Should reject duplicate article ID", async function () {
      const contentHash = ethers.id("content");
      await articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Title", contentHash, 0);
      
      await expect(
        articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.002"), "Another Title", contentHash, 0)
      ).to.be.revertedWith("Article already published");
    });
  });

  describe("Purchase and Read Pattern", function () {
    const articleId = 1;
    const price = ethers.parseEther("0.001");
    const title = "Subscription Article";
    const contentHash = ethers.id("subscription content");
    const accessDuration = 2 * 24 * 60 * 60; // 2 days

    beforeEach(async function () {
      await articleSubscription.connect(publisher).publishArticle(articleId, price, title, contentHash, accessDuration);
    });

    it("Should allow user to purchase article access", async function () {
      const tx = await articleSubscription.connect(reader).purchaseArticle(articleId, { value: price });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedExpiry = block.timestamp + accessDuration;

      await expect(tx)
        .to.emit(articleSubscription, "ServiceUsed")
        .withArgs(articleId, reader.address, 1)
        .and.to.emit(articleSubscription, "ArticlePurchased")
        .withArgs(articleId, reader.address, expectedExpiry);

      const expiry = await articleSubscription.getAccessExpiry(reader.address, articleId);
      expect(expiry).to.equal(expectedExpiry);
    });

    it("Should allow reading after purchase without payment", async function () {
      await articleSubscription.connect(reader).purchaseArticle(articleId, { value: price });

      const tx = await articleSubscription.connect(reader).readArticle(articleId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(articleSubscription, "ArticleRead")
        .withArgs(articleId, reader.address, block.timestamp);
    });

    it("Should allow multiple reads after single purchase", async function () {
      await articleSubscription.connect(reader).purchaseArticle(articleId, { value: price });

      await articleSubscription.connect(reader).readArticle(articleId);
      await articleSubscription.connect(reader).readArticle(articleId);
      await articleSubscription.connect(reader).readArticle(articleId);

      // All reads should succeed without additional payment
      const hasAccess = await articleSubscription.hasValidAccess(reader.address, articleId);
      expect(hasAccess).to.be.true;
    });

    it("Should distinguish between purchase and read", async function () {
      await articleSubscription.connect(reader).purchaseArticle(articleId, { value: price });

      // After purchase: hasPurchased = true, hasRead = false
      expect(await articleSubscription.userHasPurchased(reader.address, articleId)).to.be.true;
      expect(await articleSubscription.userHasRead(reader.address, articleId)).to.be.false;

      // After read: both should be true
      await articleSubscription.connect(reader).readArticle(articleId);
      expect(await articleSubscription.userHasPurchased(reader.address, articleId)).to.be.true;
      expect(await articleSubscription.userHasRead(reader.address, articleId)).to.be.true;
    });

    it("Should reject reading without purchase", async function () {
      await expect(
        articleSubscription.connect(reader).readArticle(articleId)
      ).to.be.revertedWith("Access not granted");
    });

    it("Should reject insufficient payment for purchase", async function () {
      await expect(
        articleSubscription.connect(reader).purchaseArticle(articleId, { value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Insufficient payment");
    });
  });

  describe("Inherited Functionality", function () {
    beforeEach(async function () {
      const contentHash = ethers.id("content");
      await articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Article 1", contentHash, 0);
      await articleSubscription.connect(reader).purchaseArticle(1, { value: ethers.parseEther("0.001") });
    });

    it("Should allow provider to withdraw earnings", async function () {
      const earnings = await articleSubscription.earnings(publisher.address);
      expect(earnings).to.equal(ethers.parseEther("0.001"));

      await articleSubscription.connect(publisher).withdraw();

      const earningsAfter = await articleSubscription.earnings(publisher.address);
      expect(earningsAfter).to.equal(0);
    });

    it("Should return service count", async function () {
      const contentHash = ethers.id("content2");
      await articleSubscription.connect(publisher).publishArticle(2, ethers.parseEther("0.002"), "Article 2", contentHash, 0);
      
      const count = await articleSubscription.getServiceCount();
      expect(count).to.equal(2);
    });
  });

  describe("Time-Limited Access", function () {
    const articleId = 2;
    const price = ethers.parseEther("0.001");
    const title = "Time-Limited Article";
    const contentHash = ethers.id("time limited content");
    const accessDuration = 2 * 24 * 60 * 60; // 2 days in seconds

    beforeEach(async function () {
      await articleSubscription.connect(publisher).publishArticle(articleId, price, title, contentHash, accessDuration);
    });

    it("Should grant time-limited access when purchasing", async function () {
      const tx = await articleSubscription.connect(reader).purchaseArticle(articleId, { value: price });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedExpiry = block.timestamp + accessDuration;

      await expect(tx)
        .to.emit(articleSubscription, "ArticlePurchased")
        .withArgs(articleId, reader.address, expectedExpiry);

      const expiry = await articleSubscription.getAccessExpiry(reader.address, articleId);
      expect(expiry).to.equal(expectedExpiry);
    });

    it("Should grant permanent access when accessDuration is 0", async function () {
      const permanentArticleId = 3;
      await articleSubscription.connect(publisher).publishArticle(
        permanentArticleId, 
        price, 
        "Permanent Article", 
        ethers.id("permanent"), 
        0 // 0 = permanent
      );

      await articleSubscription.connect(reader).purchaseArticle(permanentArticleId, { value: price });

      const expiry = await articleSubscription.getAccessExpiry(reader.address, permanentArticleId);
      expect(expiry).to.equal(ethers.MaxUint256); // Permanent access
    });

    it("Should return true for hasValidAccess before expiry", async function () {
      await articleSubscription.connect(reader).purchaseArticle(articleId, { value: price });

      const hasAccess = await articleSubscription.hasValidAccess(reader.address, articleId);
      expect(hasAccess).to.be.true;
    });

    it("Should return false for hasValidAccess if never purchased", async function () {
      const hasAccess = await articleSubscription.hasValidAccess(reader.address, articleId);
      expect(hasAccess).to.be.false;
    });
  });

  describe("Modifiers", function () {
    beforeEach(async function () {
      const contentHash = ethers.id("content");
      await articleSubscription.connect(publisher).publishArticle(100, ethers.parseEther("0.001"), "Article 100", contentHash, 0);
      await articleSubscription.connect(reader).purchaseArticle(100, { value: ethers.parseEther("0.001") });
    });

    it("Should enforce articleExists modifier on readArticle", async function () {
      // Try to read non-existent article (should fail at articleExists modifier)
      await expect(
        articleSubscription.connect(reader).readArticle(999)
      ).to.be.revertedWith("Article does not exist");
    });

    it("Should enforce articleExists modifier on getArticle", async function () {
      await expect(
        articleSubscription.getArticle(999)
      ).to.be.revertedWith("Article does not exist");
    });
  });
});

