/**
 * Add JouleCredit contract as a Chainlink Functions subscription consumer.
 * Usage: CONTRACT=0x... npx hardhat run scripts/addConsumer.js --network polygon
 *        CONTRACT=0x... npx hardhat run scripts/addConsumer.js --network amoy
 *
 * Or add via: https://functions.chain.link → select network → subscription → Add consumer
 */
const { ethers } = require("hardhat");
const hre = require("hardhat");

const FUNCTIONS_ROUTER = {
  polygon: "0xdc2AAF042Aeff2E68B3e8E33F19e4B9fA7C73F10",
  amoy:    "0xC22a79eBA640940ABB6dF0f7982cc119578E11De",
};
const ROUTER_ABI = [
  "function addConsumer(uint64 subscriptionId, address consumer) external",
  "function getSubscription(uint64 subscriptionId) external view returns (uint96 balance, uint96 blockedBalance, address owner, address[] consumers)",
];

async function main() {
  const contractAddress = process.env.CONTRACT;
  if (!contractAddress) {
    console.error("Usage: CONTRACT=0x... npx hardhat run scripts/addConsumer.js --network polygon");
    process.exit(1);
  }

  const subscriptionId = process.env.FUNCTIONS_SUBSCRIPTION_ID;
  if (!subscriptionId) throw new Error("FUNCTIONS_SUBSCRIPTION_ID not set");

  const network = hre.network.name;
  const routerAddress = FUNCTIONS_ROUTER[network];
  if (!routerAddress) throw new Error(`No router address for network: ${network}`);

  const [signer] = await ethers.getSigners();
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);

  const sub = await router.getSubscription(BigInt(subscriptionId));
  console.log("Subscription owner:", sub.owner);
  console.log("LINK balance:", ethers.formatEther(sub.balance), "LINK");

  if (sub.consumers.map(c => c.toLowerCase()).includes(contractAddress.toLowerCase())) {
    console.log("✓ Already a consumer:", contractAddress);
    return;
  }

  const tx = await router.addConsumer(BigInt(subscriptionId), contractAddress);
  console.log("Adding consumer, tx:", tx.hash);
  await tx.wait();
  console.log("✓ Consumer added:", contractAddress);
}

main().catch(err => { console.error(err); process.exit(1); });
