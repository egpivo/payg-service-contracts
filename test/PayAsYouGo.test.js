const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PayAsYouGo", function () {
  let payAsYouGo;
  let owner;
  let provider;
  let user;

  beforeEach(async function () {
    [owner, provider, user] = await ethers.getSigners();

    const PayAsYouGo = await ethers.getContractFactory("PayAsYouGo");
    payAsYouGo = await PayAsYouGo.deploy();
    await payAsYouGo.waitForDeployment();
  });

  describe("Service Registration", function () {
    it("Should register a service with id and price", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");

      await expect(payAsYouGo.connect(provider).registerService(serviceId, price))
        .to.emit(payAsYouGo, "ServiceRegistered")
        .withArgs(serviceId, provider.address, price);

      const service = await payAsYouGo.getService(serviceId);
      expect(service.id).to.equal(serviceId);
      expect(service.price).to.equal(price);
      expect(service.provider).to.equal(provider.address);
      expect(service.usageCount).to.equal(0);
    });

    it("Should reject zero price", async function () {
      await expect(
        payAsYouGo.connect(provider).registerService(1, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should reject duplicate service ID", async function () {
      await payAsYouGo.connect(provider).registerService(1, ethers.parseEther("0.001"));
      
      await expect(
        payAsYouGo.connect(provider).registerService(1, ethers.parseEther("0.002"))
      ).to.be.revertedWith("Service ID already exists");
    });
  });

  describe("Service Usage", function () {
    beforeEach(async function () {
      await payAsYouGo.connect(provider).registerService(1, ethers.parseEther("0.001"));
    });

    it("Should allow user to pay and use service", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");

      await expect(
        payAsYouGo.connect(user).useService(serviceId, { value: price })
      )
        .to.emit(payAsYouGo, "ServiceUsed")
        .withArgs(serviceId, user.address, 1);

      const service = await payAsYouGo.getService(serviceId);
      expect(service.usageCount).to.equal(1);
    });

    it("Should increment usageCount on each use", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");

      await payAsYouGo.connect(user).useService(serviceId, { value: price });
      await payAsYouGo.connect(user).useService(serviceId, { value: price });

      const service = await payAsYouGo.getService(serviceId);
      expect(service.usageCount).to.equal(2);
    });

    it("Should reject insufficient payment", async function () {
      await expect(
        payAsYouGo.connect(user).useService(1, { value: ethers.parseEther("0.0005") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should refund excess payment", async function () {
      const serviceId = 1;
      const price = ethers.parseEther("0.001");
      const excessPayment = ethers.parseEther("0.002");

      const userBalanceBefore = await ethers.provider.getBalance(user.address);
      
      const tx = await payAsYouGo.connect(user).useService(serviceId, { value: excessPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const userBalanceAfter = await ethers.provider.getBalance(user.address);
      
      // User should have paid exactly the service price + gas
      expect(userBalanceBefore - userBalanceAfter).to.equal(price + gasUsed);
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      await payAsYouGo.connect(provider).registerService(1, ethers.parseEther("0.001"));
      await payAsYouGo.connect(user).useService(1, { value: ethers.parseEther("0.001") });
    });

    it("Should allow provider to withdraw earnings", async function () {
      const earnings = await payAsYouGo.earnings(provider.address);
      expect(earnings).to.equal(ethers.parseEther("0.001"));

      const providerBalanceBefore = await ethers.provider.getBalance(provider.address);

      const tx = await payAsYouGo.connect(provider).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const providerBalanceAfter = await ethers.provider.getBalance(provider.address);
      
      expect(providerBalanceAfter - providerBalanceBefore).to.equal(earnings - gasUsed);
      
      const earningsAfter = await payAsYouGo.earnings(provider.address);
      expect(earningsAfter).to.equal(0);
    });

    it("Should reject withdraw when no earnings", async function () {
      await payAsYouGo.connect(provider).withdraw();
      
      await expect(
        payAsYouGo.connect(provider).withdraw()
      ).to.be.revertedWith("No earnings to withdraw");
    });
  });
});

