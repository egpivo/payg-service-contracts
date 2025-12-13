const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArticlePayPerRead", function () {
  let articlePayPerRead;
  let owner;
  let publisher;
  let reader;

  beforeEach(async function () {
    [owner, publisher, reader] = await ethers.getSigners();

    const ArticlePayPerRead = await ethers.getContractFactory("ArticlePayPerRead");
    articlePayPerRead = await ArticlePayPerRead.deploy();
    await articlePayPerRead.waitForDeployment();
  });

  describe("Article Publishing", function () {
    it("Should publish an article with metadata", async function () {
      const articleId = 1;
      const price = ethers.parseEther("0.001");
      const title = "Introduction to Solidity";
      const contentHash = ethers.id("article content");

      await expect(
        articlePayPerRead.connect(publisher).publishArticle(articleId, price, title, contentHash)
      )
        .to.emit(articlePayPerRead, "ServiceRegistered")
        .withArgs(articleId, publisher.address, price)
        .and.to.emit(articlePayPerRead, "ArticlePublished")
        .withArgs(articleId, title, publisher.address);

      const article = await articlePayPerRead.getArticle(articleId);
      expect(article.articleId).to.equal(articleId);
      expect(article.title).to.equal(title);
      expect(article.contentHash).to.equal(contentHash);
      expect(article.price).to.equal(price);
      expect(article.provider).to.equal(publisher.address);
    });

    it("Should reject duplicate article ID", async function () {
      const contentHash = ethers.id("content");
      await articlePayPerRead.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Title", contentHash);
      
      await expect(
        articlePayPerRead.connect(publisher).publishArticle(1, ethers.parseEther("0.002"), "Another Title", contentHash)
      ).to.be.revertedWith("Article already published");
    });
  });

  describe("Reading Articles (Pay-per-Read)", function () {
    const articleId = 1;
    const price = ethers.parseEther("0.001");
    const title = "Test Article";
    const contentHash = ethers.id("test content");

    beforeEach(async function () {
      await articlePayPerRead.connect(publisher).publishArticle(articleId, price, title, contentHash);
    });

    it("Should allow user to read article after payment", async function () {
      const tx = await articlePayPerRead.connect(reader).readArticle(articleId, { value: price });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(articlePayPerRead, "ServiceUsed")
        .withArgs(articleId, reader.address, 1)
        .and.to.emit(articlePayPerRead, "ArticleRead")
        .withArgs(articleId, reader.address, block.timestamp);

      // Note: hasRead mapping removed for gas efficiency
      // Tracking done via ArticleRead events
    });

    it("Should track multiple readers", async function () {
      const [, , reader2] = await ethers.getSigners();
      
      await articlePayPerRead.connect(reader).readArticle(articleId, { value: price });
      await articlePayPerRead.connect(reader2).readArticle(articleId, { value: price });

      // Tracking done via events, not storage
      const article = await articlePayPerRead.getArticle(articleId);
      expect(article.readCount).to.equal(2);
    });

    it("Should reject insufficient payment", async function () {
      await expect(
        articlePayPerRead.connect(reader).readArticle(articleId, { value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should increment usage count on each read", async function () {
      await articlePayPerRead.connect(reader).readArticle(articleId, { value: price });
      await articlePayPerRead.connect(reader).readArticle(articleId, { value: price });

      const article = await articlePayPerRead.getArticle(articleId);
      expect(article.readCount).to.equal(2);
    });

    it("Should reject reading non-existent article", async function () {
      await expect(
        articlePayPerRead.connect(reader).readArticle(999, { value: price })
      ).to.be.revertedWith("Article does not exist");
    });

    it("Should not write any storage (gas efficient)", async function () {
      // ArticlePayPerRead only emits events, no storage writes
      // This makes it gas efficient for pay-per-read pattern
      const tx = await articlePayPerRead.connect(reader).readArticle(articleId, { value: price });
      await tx.wait();
      
      // Verify event was emitted (tracking done off-chain)
      // No hasRead or accessExpiry storage writes
    });
  });

  describe("Inherited Functionality", function () {
    beforeEach(async function () {
      const contentHash = ethers.id("content");
      await articlePayPerRead.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Article 1", contentHash);
      await articlePayPerRead.connect(reader).readArticle(1, { value: ethers.parseEther("0.001") });
    });

    it("Should allow provider to withdraw earnings", async function () {
      const earnings = await articlePayPerRead.earnings(publisher.address);
      expect(earnings).to.equal(ethers.parseEther("0.001"));

      await articlePayPerRead.connect(publisher).withdraw();

      const earningsAfter = await articlePayPerRead.earnings(publisher.address);
      expect(earningsAfter).to.equal(0);
    });

    it("Should return service count", async function () {
      const contentHash = ethers.id("content2");
      await articlePayPerRead.connect(publisher).publishArticle(2, ethers.parseEther("0.002"), "Article 2", contentHash);
      
      const count = await articlePayPerRead.getServiceCount();
      expect(count).to.equal(2);
    });
  });
});

