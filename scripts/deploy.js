const hre = require("hardhat");

async function main() {
  console.log("Deploying PayAsYouGo contract...");

  const PayAsYouGo = await hre.ethers.getContractFactory("PayAsYouGo");
  const payAsYouGo = await PayAsYouGo.deploy();

  await payAsYouGo.waitForDeployment();

  const address = await payAsYouGo.getAddress();
  console.log("PayAsYouGo deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

