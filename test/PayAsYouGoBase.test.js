const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PayAsYouGoBase", function () {
  let payAsYouGoBase;
  let owner;
  let provider;
  let user;

  beforeEach(async function () {
    [owner, provider, user] = await ethers.getSigners();

    const PayAsYouGoBase = await ethers.getContractFactory("PayAsYouGoBase");
    payAsYouGoBase = await PayAsYouGoBase.deploy();
    await payAsYouGoBase.waitForDeployment();
  });

  describe("Service Registration", function () {
    it("Should register a service with id and price", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");

      await expect(payAsYouGoBase.connect(provider).registerService(serviceId, price))
        .to.emit(payAsYouGoBase, "ServiceRegistered")
        .withArgs(serviceId, provider.address, price);

      const service = await payAsYouGoBase.getService(serviceId);
      expect(service.id).to.equal(serviceId);
      expect(service.price).to.equal(price);
      expect(service.provider).to.equal(provider.address);
      expect(service.usageCount).to.equal(0);
    });

    it("Should reject zero price", async function () {
      await expect(
        payAsYouGoBase.connect(provider).registerService(1, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should reject duplicate service ID", async function () {
      await payAsYouGoBase.connect(provider).registerService(1, ethers.parseEther("0.001"));
      
      await expect(
        payAsYouGoBase.connect(provider).registerService(1, ethers.parseEther("0.002"))
      ).to.be.revertedWith("Service ID already exists");
    });
  });

  describe("Service Usage", function () {
    beforeEach(async function () {
      await payAsYouGoBase.connect(provider).registerService(1, ethers.parseEther("0.001"));
    });

    it("Should allow user to pay and use service", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");

      await expect(
        payAsYouGoBase.connect(user).useService(serviceId, { value: price })
      )
        .to.emit(payAsYouGoBase, "ServiceUsed")
        .withArgs(serviceId, user.address, 1);

      const service = await payAsYouGoBase.getService(serviceId);
      expect(service.usageCount).to.equal(1);
    });

    it("Should increment usageCount on each use", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");

      await payAsYouGoBase.connect(user).useService(serviceId, { value: price });
      await payAsYouGoBase.connect(user).useService(serviceId, { value: price });

      const service = await payAsYouGoBase.getService(serviceId);
      expect(service.usageCount).to.equal(2);
    });

    it("Should reject insufficient payment", async function () {
      await expect(
        payAsYouGoBase.connect(user).useService(1, { value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should reject using non-existent service", async function () {
      await expect(
        payAsYouGoBase.connect(user).useService(999, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Service does not exist");
    });

    it("Should refund excess payment", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");
      const excessPayment = ethers.parseEther("0.002");

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      
      const tx = await payAsYouGoBase.connect(user).useService(serviceId, { value: excessPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      
      // User should have paid exactly the service price + gas
      expect(userBalanceBefore - userBalanceAfter).to.equal(price + gasUsed);
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      await payAsYouGoBase.connect(provider).registerService(1, ethers.parseEther("0.001"));
      await payAsYouGoBase.connect(user).useService(1, { value: ethers.parseEther("0.001") });
    });

    it("Should allow provider to withdraw earnings", async function () {
      const earnings = await payAsYouGoBase.earnings(provider.address);
      expect(earnings).to.equal(ethers.parseEther("0.001"));

      const providerBalanceBefore = await ethers.provider.getBalance(provider.address);

      const tx = await payAsYouGoBase.connect(provider).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const providerBalanceAfter = await ethers.provider.getBalance(provider.address);
      
      expect(providerBalanceAfter - providerBalanceBefore).to.equal(earnings - gasUsed);
      
      const earningsAfter = await payAsYouGoBase.earnings(provider.address);
      expect(earningsAfter).to.equal(0);
    });

    it("Should reject withdraw when no earnings", async function () {
      await payAsYouGoBase.connect(provider).withdraw();
      
      await expect(
        payAsYouGoBase.connect(provider).withdraw()
      ).to.be.revertedWith("No earnings to withdraw");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await payAsYouGoBase.connect(provider).registerService(1, ethers.parseEther("0.001"));
      await payAsYouGoBase.connect(provider).registerService(2, ethers.parseEther("0.002"));
    });

    it("Should return correct service count", async function () {
      const count = await payAsYouGoBase.getServiceCount();
      expect(count).to.equal(2);
    });

    it("Should return service details", async function () {
      const service = await payAsYouGoBase.getService(1);
      expect(service.id).to.equal(1);
      expect(service.price).to.equal(ethers.parseEther("0.001"));
      expect(service.provider).to.equal(provider.address);
      expect(service.usageCount).to.equal(0);
    });

    it("Should reject getting non-existent service", async function () {
      await expect(
        payAsYouGoBase.getService(999)
      ).to.be.revertedWith("Service does not exist");
    });
  });

  describe("Modifiers", function () {
    beforeEach(async function () {
      await payAsYouGoBase.connect(provider).registerService(1, ethers.parseEther("0.001"));
    });

    it("Should enforce validPrice modifier", async function () {
      await expect(
        payAsYouGoBase.connect(provider).registerService(2, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should enforce serviceExists modifier on useService", async function () {
      await expect(
        payAsYouGoBase.connect(user).useService(999, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Service does not exist");
    });

    it("Should enforce serviceExists modifier on getService", async function () {
      await expect(
        payAsYouGoBase.getService(999)
      ).to.be.revertedWith("Service does not exist");
    });
  });
});

