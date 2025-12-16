const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArticleBundle", function () {
  let articlePayPerRead;
  let articleBundle;
  let publisher1, publisher2, publisher3;
  let buyer;
  let articleId1, articleId2, articleId3;
  const price1 = ethers.parseEther("0.001");
  const price2 = ethers.parseEther("0.002");
  const price3 = ethers.parseEther("0.0015");

  beforeEach(async function () {
    [publisher1, publisher2, publisher3, buyer] = await ethers.getSigners();
    
    // Deploy ArticlePayPerRead
    const ArticlePayPerRead = await ethers.getContractFactory("ArticlePayPerRead");
    articlePayPerRead = await ArticlePayPerRead.deploy();
    
    // Deploy ArticleBundle with reference to ArticlePayPerRead
    const ArticleBundle = await ethers.getContractFactory("ArticleBundle");
    articleBundle = await ArticleBundle.deploy(await articlePayPerRead.getAddress());
    
    // Publish articles
    articleId1 = 1;
    articleId2 = 2;
    articleId3 = 3;
    
    await articlePayPerRead.connect(publisher1).publishArticle(
      articleId1,
      price1,
      "Article 1",
      ethers.id("content1")
    );
    
    await articlePayPerRead.connect(publisher2).publishArticle(
      articleId2,
      price2,
      "Article 2",
      ethers.id("content2")
    );
    
    await articlePayPerRead.connect(publisher3).publishArticle(
      articleId3,
      price3,
      "Article 3",
      ethers.id("content3")
    );
  });

  describe("Bundle Creation", function () {
    it("Should create a bundle with multiple articles", async function () {
      const bundleId = 100;
      const bundlePrice = ethers.parseEther("0.004");
      const articleIds = [articleId1, articleId2, articleId3];
      const accessDuration = 86400; // 1 day

      await articleBundle.connect(publisher1).createBundle(
        bundleId,
        articleIds,
        bundlePrice,
        accessDuration
      );

      const bundle = await articleBundle.getBundle(bundleId);
      expect(bundle.bundleId).to.equal(bundleId);
      expect(bundle.articleIds.length).to.equal(3);
      expect(bundle.price).to.equal(bundlePrice);
      expect(bundle.creator).to.equal(publisher1.address);
      expect(bundle.accessDuration).to.equal(accessDuration);
    });

    it("Should revert if bundle ID already exists", async function () {
      const bundleId = 100;
      const articleIds = [articleId1, articleId2];
      const bundlePrice = ethers.parseEther("0.003");

      await articleBundle.connect(publisher1).createBundle(
        bundleId,
        articleIds,
        bundlePrice,
        0
      );

      await expect(
        articleBundle.connect(publisher1).createBundle(
          bundleId,
          articleIds,
          bundlePrice,
          0
        )
      ).to.be.revertedWith("Bundle ID already exists");
    });

    it("Should revert if bundle contains non-existent article", async function () {
      const bundleId = 100;
      const articleIds = [articleId1, 999]; // 999 doesn't exist
      const bundlePrice = ethers.parseEther("0.003");

      await expect(
        articleBundle.connect(publisher1).createBundle(
          bundleId,
          articleIds,
          bundlePrice,
          0
        )
      ).to.be.revertedWith("Article does not exist");
    });

    it("Should revert if bundle is empty", async function () {
      const bundleId = 100;
      const articleIds = [];
      const bundlePrice = ethers.parseEther("0.001");

      await expect(
        articleBundle.connect(publisher1).createBundle(
          bundleId,
          articleIds,
          bundlePrice,
          0
        )
      ).to.be.revertedWith("Bundle must contain at least one article");
    });

    it("Should revert if bundle price is zero", async function () {
      const bundleId = 100;
      const articleIds = [articleId1, articleId2];

      await expect(
        articleBundle.connect(publisher1).createBundle(
          bundleId,
          articleIds,
          0,
          0
        )
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("Bundle Purchase", function () {
    let bundleId;
    let bundlePrice;
    let articleIds;

    beforeEach(async function () {
      bundleId = 100;
      bundlePrice = ethers.parseEther("0.004");
      articleIds = [articleId1, articleId2, articleId3];
      const accessDuration = 86400; // 1 day

      await articleBundle.connect(publisher1).createBundle(
        bundleId,
        articleIds,
        bundlePrice,
        accessDuration
      );
    });

    it("Should purchase bundle and grant access", async function () {
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });

      const hasAccess = await articleBundle.hasBundleAccess(buyer.address, bundleId);
      expect(hasAccess).to.be.true;

      const expiry = await articleBundle.getBundleAccessExpiry(buyer.address, bundleId);
      expect(expiry).to.be.gt(0);
    });

    it("Should distribute revenue equally among article providers", async function () {
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
      
      const tx = await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Revenue per article: 0.004 / 3 = 0.001333... (with remainder 0.000001)
      // Each provider gets 0.001333, first provider gets remainder
      const revenuePerArticle = bundlePrice / 3n;
      const remainder = bundlePrice % 3n;

      const earnings1 = await articleBundle.earnings(publisher1.address);
      const earnings2 = await articleBundle.earnings(publisher2.address);
      const earnings3 = await articleBundle.earnings(publisher3.address);

      expect(earnings1).to.equal(revenuePerArticle + remainder); // First provider gets remainder
      expect(earnings2).to.equal(revenuePerArticle);
      expect(earnings3).to.equal(revenuePerArticle);
    });

    it("Should refund excess payment", async function () {
      const excessPayment = ethers.parseEther("0.006");
      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: excessPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      const expectedBalance = buyerBalanceBefore - bundlePrice - gasUsed;
      
      // Allow small difference for gas estimation
      expect(buyerBalanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.0001"));
    });

    it("Should revert if payment is insufficient", async function () {
      const insufficientPayment = bundlePrice - 1n;

      await expect(
        articleBundle.connect(buyer).purchaseBundle(bundleId, { value: insufficientPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should support renewal (extend access from current expiry)", async function () {
      const accessDuration = 86400; // 1 day
      
      // First purchase
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      const expiry1 = await articleBundle.getBundleAccessExpiry(buyer.address, bundleId);
      
      // Move time forward (but not past expiry)
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);
      
      // Renewal purchase
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      const expiry2 = await articleBundle.getBundleAccessExpiry(buyer.address, bundleId);
      
      // Expiry should be extended from previous expiry, not from now
      expect(expiry2).to.equal(expiry1 + BigInt(accessDuration));
    });

    it("Should start from now if access expired", async function () {
      const accessDuration = 86400; // 1 day
      
      // First purchase
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      
      // Move time past expiry
      await ethers.provider.send("evm_increaseTime", [86401]); // More than 1 day
      await ethers.provider.send("evm_mine", []);
      
      // Purchase again (should start from now)
      const tx = await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      const receipt = await tx.wait();
      const blockTimestamp = (await ethers.provider.getBlock(receipt.blockNumber)).timestamp;
      
      const expiry = await articleBundle.getBundleAccessExpiry(buyer.address, bundleId);
      expect(expiry).to.equal(blockTimestamp + accessDuration);
    });

    it("Should support permanent access (duration = 0)", async function () {
      const permanentBundleId = 200;
      await articleBundle.connect(publisher1).createBundle(
        permanentBundleId,
        [articleId1, articleId2],
        bundlePrice,
        0 // Permanent access
      );

      await articleBundle.connect(buyer).purchaseBundle(permanentBundleId, { value: bundlePrice });
      
      const expiry = await articleBundle.getBundleAccessExpiry(buyer.address, permanentBundleId);
      expect(expiry).to.equal(ethers.MaxUint256);
      
      const hasAccess = await articleBundle.hasBundleAccess(buyer.address, permanentBundleId);
      expect(hasAccess).to.be.true;
    });

    it("Should increment usage count", async function () {
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      
      const bundle = await articleBundle.getBundle(bundleId);
      expect(bundle.usageCount).to.equal(1);
      
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
      const bundle2 = await articleBundle.getBundle(bundleId);
      expect(bundle2.usageCount).to.equal(2);
    });
  });

  describe("Access Management", function () {
    let bundleId;

    beforeEach(async function () {
      bundleId = 100;
      const bundlePrice = ethers.parseEther("0.004");
      const articleIds = [articleId1, articleId2, articleId3];
      const accessDuration = 86400; // 1 day

      await articleBundle.connect(publisher1).createBundle(
        bundleId,
        articleIds,
        bundlePrice,
        accessDuration
      );
    });

    it("Should return false for never purchased bundle", async function () {
      const hasAccess = await articleBundle.hasBundleAccess(buyer.address, bundleId);
      expect(hasAccess).to.be.false;
    });

    it("Should return true for valid access", async function () {
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: ethers.parseEther("0.004") });
      
      const hasAccess = await articleBundle.hasBundleAccess(buyer.address, bundleId);
      expect(hasAccess).to.be.true;
    });

    it("Should return false for expired access", async function () {
      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: ethers.parseEther("0.004") });
      
      // Move time past expiry
      await ethers.provider.send("evm_increaseTime", [86401]); // More than 1 day
      await ethers.provider.send("evm_mine", []);
      
      const hasAccess = await articleBundle.hasBundleAccess(buyer.address, bundleId);
      expect(hasAccess).to.be.false;
    });

    it("Should return true for permanent access", async function () {
      const permanentBundleId = 200;
      await articleBundle.connect(publisher1).createBundle(
        permanentBundleId,
        [articleId1],
        ethers.parseEther("0.001"),
        0 // Permanent
      );

      await articleBundle.connect(buyer).purchaseBundle(permanentBundleId, { value: ethers.parseEther("0.001") });
      
      const hasAccess = await articleBundle.hasBundleAccess(buyer.address, permanentBundleId);
      expect(hasAccess).to.be.true;
    });
  });

  describe("Withdraw", function () {
    let bundleId;

    beforeEach(async function () {
      bundleId = 100;
      const bundlePrice = ethers.parseEther("0.004");
      const articleIds = [articleId1, articleId2, articleId3];

      await articleBundle.connect(publisher1).createBundle(
        bundleId,
        articleIds,
        bundlePrice,
        0
      );

      await articleBundle.connect(buyer).purchaseBundle(bundleId, { value: bundlePrice });
    });

    it("Should allow providers to withdraw bundle earnings", async function () {
      const revenuePerArticle = ethers.parseEther("0.004") / 3n;
      const remainder = ethers.parseEther("0.004") % 3n;

      // Publisher1 should have revenuePerArticle + remainder
      const earnings1 = await articleBundle.earnings(publisher1.address);
      expect(earnings1).to.equal(revenuePerArticle + remainder);

      const balanceBefore = await ethers.provider.getBalance(publisher1.address);
      const tx = await articleBundle.connect(publisher1).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(publisher1.address);

      expect(balanceAfter - balanceBefore).to.equal(earnings1 - gasUsed);
      expect(await articleBundle.earnings(publisher1.address)).to.equal(0);
    });

    it("Should allow multiple providers to withdraw", async function () {
      const revenuePerArticle = ethers.parseEther("0.004") / 3n;

      // Publisher2 should have revenuePerArticle
      const earnings2 = await articleBundle.earnings(publisher2.address);
      expect(earnings2).to.equal(revenuePerArticle);

      const balanceBefore = await ethers.provider.getBalance(publisher2.address);
      const tx = await articleBundle.connect(publisher2).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(publisher2.address);

      expect(balanceAfter - balanceBefore).to.equal(earnings2 - gasUsed);
      expect(await articleBundle.earnings(publisher2.address)).to.equal(0);
    });
  });
});

