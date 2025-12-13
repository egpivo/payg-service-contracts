const hre = require("hardhat");

async function main() {
  console.log("Deploying PayAsYouGoBase contract...");

  const PayAsYouGoBase = await hre.ethers.getContractFactory("PayAsYouGoBase");
  const payAsYouGoBase = await PayAsYouGoBase.deploy();

  await payAsYouGoBase.waitForDeployment();

  const address = await payAsYouGoBase.getAddress();
  console.log("PayAsYouGoBase deployed to:", address);
  
  console.log("\nDeploying ArticlePayPerRead (pay-per-read pattern)...");
  const ArticlePayPerRead = await hre.ethers.getContractFactory("ArticlePayPerRead");
  const articlePayPerRead = await ArticlePayPerRead.deploy();
  await articlePayPerRead.waitForDeployment();
  console.log("ArticlePayPerRead deployed to:", await articlePayPerRead.getAddress());
  
  console.log("\nDeploying ArticleSubscription (subscription pattern)...");
  const ArticleSubscription = await hre.ethers.getContractFactory("ArticleSubscription");
  const articleSubscription = await ArticleSubscription.deploy();
  await articleSubscription.waitForDeployment();
  console.log("ArticleSubscription deployed to:", await articleSubscription.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

