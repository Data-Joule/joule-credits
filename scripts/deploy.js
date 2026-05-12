const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Polygon Amoy Chainlink Functions constants
const FUNCTIONS_ROUTER_AMOY = "0xC22a79eBA640940ABB6dF0f7982cc119578E11De";
const DON_ID_AMOY = "0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000";

async function main() {
  const subscriptionId = process.env.FUNCTIONS_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    throw new Error("FUNCTIONS_SUBSCRIPTION_ID not set in .env");
  }

  const source = fs.readFileSync(path.join(__dirname, "../functions/source.js"), "utf8");
  const [deployer] = await ethers.getSigners();

  console.log("Deploying JouleCredit from:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC");

  const JouleCredit = await ethers.getContractFactory("JouleCredit");
  const contract = await JouleCredit.deploy(
    FUNCTIONS_ROUTER_AMOY,
    BigInt(subscriptionId),
    DON_ID_AMOY,
    source
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n✓ JouleCredit deployed to:", address);
  console.log("  Network:        Polygon Amoy testnet (chainId 80002)");
  console.log("  Subscription:  ", subscriptionId);
  console.log("  mintTo:        ", deployer.address);
  console.log("\nPolygonscan: https://amoy.polygonscan.com/address/" + address);

  fs.writeFileSync(
    path.join(__dirname, "../deployment.json"),
    JSON.stringify({ address, network: "amoy", chainId: 80002, subscriptionId,
      donId: DON_ID_AMOY, deployedAt: new Date().toISOString(), deployer: deployer.address }, null, 2)
  );
  console.log("Deployment info saved to deployment.json");
}

main().catch(err => { console.error(err); process.exit(1); });
