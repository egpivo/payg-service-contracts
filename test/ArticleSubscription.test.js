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

      await expect(
        articleSubscription.connect(publisher).publishArticle(articleId, price, title, contentHash)
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
    });

    it("Should reject duplicate article ID", async function () {
      const contentHash = ethers.id("content");
      await articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Title", contentHash);
      
      await expect(
        articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.002"), "Another Title", contentHash)
      ).to.be.revertedWith("Service ID already exists");
    });
  });

  describe("Reading Articles", function () {
    const articleId = 1;
    const price = ethers.parseEther("0.001");
    const title = "Test Article";
    const contentHash = ethers.id("test content");

    beforeEach(async function () {
      await articleSubscription.connect(publisher).publishArticle(articleId, price, title, contentHash);
    });

    it("Should allow user to read article after payment", async function () {
      await expect(
        articleSubscription.connect(reader).readArticle(articleId, { value: price })
      )
        .to.emit(articleSubscription, "ServiceUsed")
        .withArgs(articleId, reader.address, 1)
        .and.to.emit(articleSubscription, "ArticleRead")
        .withArgs(articleId, reader.address);

      const hasRead = await articleSubscription.userHasRead(reader.address, articleId);
      expect(hasRead).to.be.true;
    });

    it("Should track multiple readers", async function () {
      const [, , reader2] = await ethers.getSigners();
      
      await articleSubscription.connect(reader).readArticle(articleId, { value: price });
      await articleSubscription.connect(reader2).readArticle(articleId, { value: price });

      expect(await articleSubscription.userHasRead(reader.address, articleId)).to.be.true;
      expect(await articleSubscription.userHasRead(reader2.address, articleId)).to.be.true;

      const article = await articleSubscription.getArticle(articleId);
      expect(article.readCount).to.equal(2);
    });

    it("Should reject insufficient payment", async function () {
      await expect(
        articleSubscription.connect(reader).readArticle(articleId, { value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should increment usage count on each read", async function () {
      await articleSubscription.connect(reader).readArticle(articleId, { value: price });
      await articleSubscription.connect(reader).readArticle(articleId, { value: price });

      const article = await articleSubscription.getArticle(articleId);
      expect(article.readCount).to.equal(2);
    });

    it("Should reject reading non-existent article", async function () {
      await expect(
        articleSubscription.connect(reader).readArticle(999, { value: price })
      ).to.be.revertedWith("Article does not exist");
    });
  });

  describe("Inherited Functionality", function () {
    beforeEach(async function () {
      const contentHash = ethers.id("content");
      await articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Article 1", contentHash);
      await articleSubscription.connect(reader).readArticle(1, { value: ethers.parseEther("0.001") });
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
      await articleSubscription.connect(publisher).publishArticle(2, ethers.parseEther("0.002"), "Article 2", contentHash);
      
      const count = await articleSubscription.getServiceCount();
      expect(count).to.equal(2);
    });
  });

  describe("Modifiers", function () {
    beforeEach(async function () {
      const contentHash = ethers.id("content");
      await articleSubscription.connect(publisher).publishArticle(1, ethers.parseEther("0.001"), "Article 1", contentHash);
    });

    it("Should enforce articleExists modifier on readArticle", async function () {
      await expect(
        articleSubscription.connect(reader).readArticle(999, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Article does not exist");
    });

    it("Should enforce articleExists modifier on getArticle", async function () {
      await expect(
        articleSubscription.getArticle(999)
      ).to.be.revertedWith("Article does not exist");
    });
  });
});

