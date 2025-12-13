const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessLib", function () {
    let AccessLib;
    let accessLib;

    before(async function () {
        // Deploy a test contract that uses AccessLib
        const AccessLibTest = await ethers.getContractFactory("AccessLibTest");
        accessLib = await AccessLibTest.deploy();
    });

    describe("computeExpiry", function () {
        it("Should return max uint256 for permanent access (duration = 0)", async function () {
            const result = await accessLib.testComputeExpiry(0, 1000, 0);
            expect(result).to.equal(ethers.MaxUint256);
        });

        it("Should start from now for new purchase (currentExpiry = 0)", async function () {
            const nowTs = Math.floor(Date.now() / 1000);
            const duration = 86400; // 1 day
            const result = await accessLib.testComputeExpiry(0, nowTs, duration);
            expect(result).to.equal(nowTs + duration);
        });

        it("Should start from now if expired", async function () {
            const expiredTime = 1000;
            const nowTs = 2000;
            const duration = 86400; // 1 day
            const result = await accessLib.testComputeExpiry(expiredTime, nowTs, duration);
            expect(result).to.equal(nowTs + duration);
        });

        it("Should extend from current expiry if not expired", async function () {
            const currentExpiry = 2000;
            const nowTs = 1500;
            const duration = 86400; // 1 day
            const result = await accessLib.testComputeExpiry(currentExpiry, nowTs, duration);
            expect(result).to.equal(currentExpiry + duration);
        });

        it("Should handle renewal at exact expiry time", async function () {
            const currentExpiry = 2000;
            const nowTs = 2000; // exactly at expiry
            const duration = 86400; // 1 day
            const result = await accessLib.testComputeExpiry(currentExpiry, nowTs, duration);
            // Should start from now (not extend) since nowTs >= currentExpiry
            expect(result).to.equal(nowTs + duration);
        });
    });

    describe("isValid", function () {
        it("Should return false for never purchased (expiry = 0)", async function () {
            const nowTs = 1000;
            const result = await accessLib.testIsValid(0, nowTs);
            expect(result).to.be.false;
        });

        it("Should return true for permanent access (expiry = max uint256)", async function () {
            const nowTs = 1000;
            const result = await accessLib.testIsValid(ethers.MaxUint256, nowTs);
            expect(result).to.be.true;
        });

        it("Should return true if not expired", async function () {
            const expiry = 2000;
            const nowTs = 1500;
            const result = await accessLib.testIsValid(expiry, nowTs);
            expect(result).to.be.true;
        });

        it("Should return false if expired", async function () {
            const expiry = 1000;
            const nowTs = 2000;
            const result = await accessLib.testIsValid(expiry, nowTs);
            expect(result).to.be.false;
        });

        it("Should return true at exact expiry time", async function () {
            const expiry = 2000;
            const nowTs = 2000;
            const result = await accessLib.testIsValid(expiry, nowTs);
            expect(result).to.be.true;
        });
    });
});

