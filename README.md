# Joule Credits (JLC)

**ERC-20 · Chainlink Functions · Polygon Amoy testnet**

Existing energy tokenization projects tokenize renewable generation or carbon offsets — things easy to measure at the meter. Demand response curtailment has always been self-reported: the utility trusts your claim that you reduced load. Joule Credits are different. A real OpenADR 3.0 VTN issues an event with a cryptographic identifier. The VEN responds, the smart plug measures before and after, and Chainlink's decentralized oracle network — not a single API call, but a consensus of independent nodes — verifies the measurement and mints the token. No single party, including the VEN operator, can falsify it. That is the oracle problem for energy, solved.

---

## Verification Chain

```
OpenADR 3.0 VTN
      │  issues DR event (eventName, duration, tier)
      ▼
VEN — pi-ven (Raspberry Pi 5)
      │  applies 4-tier response ladder to llama.cpp inference node
      ▼
Zigbee smart plug (plug_1)
      │  measures before/after wattage → kwh_reduced
      │  data available at: data-joule.com/api/events/{eventName}
      ▼
Chainlink Functions (Decentralized Oracle Network)
      │  multiple independent nodes fetch and verify the measurement
      │  consensus: all nodes must agree on kwh_reduced
      ▼
JouleCredit.sol — fulfillRequest()
      │  mints floor(kwh_reduced * 1e18) JLC tokens
      ▼
mintTo address — 1 JLC per kWh curtailed, on-chain forever
```

**Live demo**: [data-joule.com/joule-credits](https://data-joule.com/joule-credits)  
**Contract**: *Polygon Amoy testnet — address in [deployment.json](deployment.json) after deploy*

---

## Token

| Property | Value |
|----------|-------|
| Name | Joule Credit |
| Symbol | JLC |
| Decimals | 18 |
| Unit | 1 JLC = 1 kWh curtailed, Chainlink-verified |
| Network | Polygon Amoy testnet → Energy Web Chain (production) |

**Token math** (no floats in Solidity):
- `source.js` returns `floor(kwh_reduced * 1e9)` as `uint256`
- Contract: `tokens = kwhScaled * 1e9` = `kwh_reduced * 1e18` ✓
- Example: 0.000375 kWh → `kwhScaled=375000` → `3.75e14 wei` = `0.000375 JLC`

---

## Why This Is Novel

**Existing energy tokenization**:
- WePower / Power Ledger — tokenize renewable *generation* (meter-verified)
- Toucan Protocol — tokenize carbon offsets (self-reported, human-audited)
- Ampere.energy / Drift — DR credits (centralized attestation, one party)

**What Joule Credits add**:
1. **OpenADR 3.0 provenance** — every token traces to a cryptographically identified VTN event
2. **Physical measurement** — Zigbee plug data, not self-report
3. **Chainlink decentralized verification** — consensus of independent oracle nodes; no single party can forge the measurement
4. **DLMS/COSEM upgrade path** — replace the consumer plug with a utility-grade meter for settlement-grade tokens

---

## Repository Structure

```
joule-credits/
├── contracts/
│   └── JouleCredit.sol          # ERC-20 + Chainlink FunctionsClient
├── functions/
│   └── source.js                # Chainlink Functions JavaScript (runs on oracle nodes)
├── scripts/
│   ├── deploy.js                # Deploy to Amoy testnet
│   ├── addConsumer.js           # Add contract to Chainlink subscription
│   └── requestVerification.js  # Trigger oracle verification for a completed event
├── test/
│   └── JouleCredit.test.js
├── hardhat.config.js
└── .env.example
```

---

## Prerequisites

1. **MetaMask wallet** — export private key to `.env`
2. **Polygon Amoy MATIC** — [faucet.polygon.technology](https://faucet.polygon.technology)
3. **LINK tokens on Amoy** — [faucets.chain.link](https://faucets.chain.link) (need ~5 LINK)
4. **Chainlink Functions subscription** — [functions.chain.link](https://functions.chain.link) → select Amoy → Create subscription → Fund with LINK
5. **Polygonscan API key** — [polygonscan.com/apis](https://polygonscan.com/apis) (free)

---

## Setup

```bash
git clone https://github.com/data-joule/joule-credits
cd joule-credits
npm install
cp .env.example .env
# Fill in PRIVATE_KEY, FUNCTIONS_SUBSCRIPTION_ID, POLYGONSCAN_API_KEY
```

---

## Deploy

```bash
# Compile
npx hardhat compile

# Run unit tests
npx hardhat test

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.js --network amoy

# Add contract to Chainlink subscription (or add via functions.chain.link UI)
node scripts/addConsumer.js <contractAddress>

# Verify source on Polygonscan
npx hardhat verify --network amoy <contractAddress> \
  "0xC22a79eBA640940ABB6dF0f7982cc119578E11De" \  # router
  <subscriptionId> \
  "0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000" \  # DON ID
  "<source>"  # inline source (use updateSource() post-deploy instead)
```

---

## Trigger Verification (after a real DR event)

```bash
# First confirm the event report exists:
curl https://data-joule.com/api/events/grid-tier2-1715515294

# If 200 OK with kwh_reduced > 0, trigger the oracle:
node scripts/requestVerification.js <contractAddress> grid-tier2-1715515294

# Oracle callback fires in ~30-90s. Check Polygonscan for JouleCreditMinted event.
```

---

## Chainlink Functions — Polygon Amoy Constants

| Parameter | Value |
|-----------|-------|
| Router | `0xC22a79eBA640940ABB6dF0f7982cc119578E11De` |
| DON ID | `fun-polygon-amoy-1` |
| DON ID (bytes32) | `0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000` |
| LINK token | `0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904` |

---

## Part of Data-Joule

This repo is the tokenization layer of the Data-Joule stack:

```
flexcompute-edge  →  joule-credits
OpenADR 3.0 VEN      Chainlink oracle + ERC-20
(pi-ven)             (this repo)
```

**Live dashboard**: [data-joule.com/demo](https://data-joule.com/demo)  
**Edge node repo**: [github.com/data-joule/flexcompute-edge](https://github.com/data-joule/flexcompute-edge)

---

## License

Apache 2.0 — see [LICENSE](LICENSE)
