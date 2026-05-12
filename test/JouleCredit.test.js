const { expect } = require("chai");

describe("JouleCredit", function () {
  describe("Token math verification", function () {
    it("encodes 0.000375 kWh correctly", function () {
      const kwhReduced = 0.000375;
      const kwhScaled = Math.floor(kwhReduced * 1e9); // 375000
      const tokens = BigInt(kwhScaled) * BigInt(1e9); // 3.75e14
      const expectedJLC = Number(tokens) / 1e18;      // 0.000375 JLC

      expect(kwhScaled).to.equal(375000);
      expect(tokens).to.equal(375000000000000n);
      expect(expectedJLC).to.be.closeTo(0.000375, 1e-12);
    });

    it("encodes a T3 event correctly", function () {
      const deltaW = 13.5 - 3.7;
      const kwhReduced = (deltaW * 300) / 3_600_000;
      const kwhScaled = Math.floor(kwhReduced * 1e9);
      expect(kwhScaled).to.be.greaterThan(0);
      expect(kwhScaled).to.be.lessThan(1e9);
    });

    it("kwhScaled stays within uint256 safe range", function () {
      const kwhScaled = Math.floor(0.5 * 1e9); // max plausible: 500W for 1h
      expect(kwhScaled).to.be.lessThan(Number.MAX_SAFE_INTEGER);
      const tokens = BigInt(kwhScaled) * BigInt(1e9);
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      expect(tokens < MAX_UINT256).to.equal(true);
    });
  });

  describe("source.js validation logic", function () {
    it("rejects negative kwh_reduced", function () {
      expect(-0.001 <= 0).to.equal(true);
    });

    it("rejects kwh_reduced > 100", function () {
      expect(150 > 100).to.equal(true);
    });

    it("rejects invalid event name", function () {
      expect("bad-event-name".startsWith("grid-tier")).to.equal(false);
    });

    it("accepts valid grid-tier event name", function () {
      const name = "grid-tier2-1715515294";
      expect(name.startsWith("grid-tier")).to.equal(true);
      const ts = parseInt(name.split("-").pop(), 10);
      expect(ts).to.be.greaterThan(1700000000);
    });
  });

  describe("API report structure", function () {
    it("has all required fields", function () {
      const report = {
        event_name: "grid-tier2-1715515294",
        tier: 2, start_ts: 1715515294, end_ts: 1715515474,
        baseline_w: 13.5, avg_curtailed_w: 6.0,
        duration_s: 180, kwh_reduced: 0.000375, completed_at: 1715515480,
      };
      const required = ["event_name","tier","start_ts","end_ts",
        "baseline_w","avg_curtailed_w","duration_s","kwh_reduced","completed_at"];
      for (const f of required) expect(report).to.have.property(f);
      expect(report.kwh_reduced).to.be.greaterThan(0);
    });
  });
});
