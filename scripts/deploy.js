const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Chainlink Functions constants
const FUNCTIONS_ROUTER = {
  polygon: "0xdc2AAF042Aeff2E68B3e8E33F19e4B9fA7C73F10",
  amoy:    "0xC22a79eBA640940ABB6dF0f7982cc119578E11De",
};
const DON_ID = {
  polygon: "0x66756e2d706f6c79676f6e2d6d61696e6e65742d310000000000000000000000",
  amoy:    "0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000",
};

async function main() {
  const subscriptionId = process.env.FUNCTIONS_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    throw new Error("FUNCTIONS_SUBSCRIPTION_ID not set in .env");
  }

  const network = hre.network.name;
  const router = FUNCTIONS_ROUTER[network];
  const donId = DON_ID[network];
  if (!router || !donId) throw new Error(`No Chainlink constants for network: ${network}`);

  const isMainnet = network === "polygon";
  const chainId = isMainnet ? 137 : 80002;
  const explorerBase = isMainnet ? "https://polygonscan.com" : "https://amoy.polygonscan.com";

  const source = fs.readFileSync(path.join(__dirname, "../functions/source.js"), "utf8");
  const [deployer] = await ethers.getSigners();

  console.log("Deploying JouleCredit from:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "POL");
  console.log("Network:", network, `(chainId ${chainId})`);

  const JouleCredit = await ethers.getContractFactory("JouleCredit");
  const contract = await JouleCredit.deploy(router, BigInt(subscriptionId), donId, source);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n✓ JouleCredit deployed to:", address);
  console.log("  Subscription:  ", subscriptionId);
  console.log("  mintTo:        ", deployer.address);
  console.log("\nPolygonscan:", `${explorerBase}/address/${address}`);

  fs.writeFileSync(
    path.join(__dirname, "../deployment.json"),
    JSON.stringify({ address, network, chainId, subscriptionId,
      donId, deployedAt: new Date().toISOString(), deployer: deployer.address }, null, 2)
  );
  console.log("Deployment info saved to deployment.json");
}

main().catch(err => { console.error(err); process.exit(1); });
