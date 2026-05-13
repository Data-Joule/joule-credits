/**
 * Chainlink Functions source — runs on each node of the decentralized oracle network.
 *
 * args[0] = eventName (e.g., "grid-tier2-1715515294")
 *
 * Returns: uint256 encoding of floor(kwh_reduced * 1e9)
 *   - Avoids floating-point in Solidity
 *   - Contract decodes: tokens = kwhScaled * 1e9 = kwh_reduced * 1e18
 *
 * Data source: https://data-joule.com/api/events/{eventName}
 *   This endpoint returns a completed DR event report generated when the VEN
 *   (pi-ven, Raspberry Pi 5) detected tier drop (≥1→0) after an OpenADR 3.0
 *   VTN event expired. The wattage data comes from a Zigbee smart plug (plug_1)
 *   measuring real consumption of the llama.cpp inference node (mtl-edge-01).
 */

const eventName = args[0];

// Validate event name format before making any HTTP request
if (!eventName || typeof eventName !== "string") {
  throw Error("args[0] (eventName) is required");
}
if (!/^grid-tier[1-4]-\d{10}$/.test(eventName)) {
  throw Error(`Invalid event name format: ${eventName}`);
}

// Fetch completed event report from VEN API
const response = await Functions.makeHttpRequest({
  url: `https://data-joule.com/api/events/${eventName}`,
  method: "GET",
  timeout: 10000,
});

if (response.error) {
  throw Error(`HTTP request failed: ${response.message || "unknown error"}`);
}
if (response.status === 404) {
  throw Error(`Event report not found: ${eventName} — event may not have completed yet`);
}
if (response.status !== 200) {
  throw Error(`Unexpected status ${response.status} for event ${eventName}`);
}

const report = response.data;

// Validate required fields
if (!report || typeof report !== "object") {
  throw Error("Invalid response body — expected JSON object");
}
if (typeof report.kwh_reduced !== "number") {
  throw Error("Missing or invalid kwh_reduced field");
}
if (typeof report.completed_at !== "number") {
  throw Error("Missing completed_at — event report not finalized");
}
if (report.event_name !== eventName) {
  throw Error(`event_name mismatch: got ${report.event_name}, expected ${eventName}`);
}

// Sanity bounds — prevent obviously wrong values from being minted
if (report.kwh_reduced <= 0) {
  throw Error("kwh_reduced must be positive (no curtailment recorded)");
}
if (report.kwh_reduced > 100) {
  throw Error(`Implausible curtailment: ${report.kwh_reduced} kWh`);
}
if (typeof report.baseline_w === "number") {
  if (report.baseline_w < 1 || report.baseline_w > 500) {
    throw Error(`Implausible baseline wattage: ${report.baseline_w} W`);
  }
}
if (typeof report.duration_s === "number") {
  if (report.duration_s < 30 || report.duration_s > 3600) {
    throw Error(`Invalid event duration: ${report.duration_s} s`);
  }
}
if (typeof report.tier === "number") {
  if (report.tier < 1 || report.tier > 4) {
    throw Error(`Invalid tier: ${report.tier}`);
  }
}

// Encode as uint256: kwh_reduced * 1e9, floored to integer
// Example: 0.000375 kWh → 375000
const kwhScaled = Math.floor(report.kwh_reduced * 1e9);

if (kwhScaled <= 0 || !Number.isFinite(kwhScaled) || kwhScaled > Number.MAX_SAFE_INTEGER) {
  throw Error(`Encoding error: kwhScaled=${kwhScaled}`);
}

return Functions.encodeUint256(kwhScaled);
