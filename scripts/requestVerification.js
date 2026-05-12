/**
 * Trigger Chainlink oracle verification for a completed DR event.
 * Usage: npx hardhat run scripts/requestVerification.js --network amoy
 *        EVENT_NAME=grid-tier2-1715515294 CONTRACT=0xAbc...
 */
const { ethers } = require("hardhat");

const ABI = [
  "function requestVerification(string calldata eventName) external",
  "function eventMinted(string) view returns (bool)",
  "event JouleCreditMinted(string indexed eventName, uint256 kwhScaled, uint256 tokens, bytes32 requestId)",
  "event VerificationRequested(string indexed eventName, bytes32 requestId)",
];

async function main() {
  const contractAddress = process.env.CONTRACT;
  const eventName = process.env.EVENT_NAME;

  if (!contractAddress || !eventName) {
    console.error("Usage: CONTRACT=0x... EVENT_NAME=grid-tier2-... npx hardhat run scripts/requestVerification.js --network amoy");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const contract = new ethers.Contract(contractAddress, ABI, signer);
  const alreadyMinted = await contract.eventMinted(eventName);
  if (alreadyMinted) {
    console.log("⚠ Already minted for event:", eventName);
    return;
  }

  console.log("Requesting verification for:", eventName);
  const tx = await contract.requestVerification(eventName);
  console.log("Tx:", tx.hash);
  console.log("Polygonscan: https://amoy.polygonscan.com/tx/" + tx.hash);

  const receipt = await tx.wait();
  console.log("✓ Confirmed in block", receipt.blockNumber);
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "VerificationRequested") {
        console.log("  Chainlink request ID:", parsed.args.requestId);
        console.log("  Monitor: https://functions.chain.link");
      }
    } catch { /* ignore */ }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
