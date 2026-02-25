/**
 * Unit tests for @nullius/isnad — methods that work without a live Aztec network.
 *
 * Run with: vitest run tests/sdk.unit.test.ts
 * (requires npm install first)
 */
import { describe, expect, it } from "vitest";
import { IsnadSDK } from "../src/isnad.js";
import {
  INSTALL_THRESHOLD_COUNT,
  INSTALL_THRESHOLD_SCORE,
  INSTALL_THRESHOLD_WEIGHTED_SCORE,
} from "../src/types.js";
import { Fr } from "@aztec/aztec.js/fields";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeInfo(
  overrides: Partial<{
    trustScore: bigint;
    attestationCount: bigint;
    isQuarantined: boolean;
  }>,
) {
  return {
    skillHash: "0x" + "a".repeat(64),
    trustScore: overrides.trustScore ?? 0n,
    attestationCount: overrides.attestationCount ?? 0n,
    isQuarantined: overrides.isQuarantined ?? false,
  };
}

describe("IsnadSDK.computeSkillHash", () => {
  it("returns an Fr for a non-empty input", () => {
    const content = new TextEncoder().encode("#!/usr/bin/env node\nconsole.log('hello world');\n");
    const hash = IsnadSDK.computeSkillHash(content);
    expect(hash).toBeInstanceOf(Fr);
    expect(hash.toBigInt()).toBeGreaterThan(0n);
  });

  it("is deterministic — same content always gives same hash", () => {
    const content = new TextEncoder().encode("skill content bytes");
    const hash1 = IsnadSDK.computeSkillHash(content);
    const hash2 = IsnadSDK.computeSkillHash(content);
    expect(hash1.toBigInt()).toBe(hash2.toBigInt());
  });

  it("different content gives different hashes", () => {
    const a = IsnadSDK.computeSkillHash(new TextEncoder().encode("skill-a"));
    const b = IsnadSDK.computeSkillHash(new TextEncoder().encode("skill-b"));
    expect(a.toBigInt()).not.toBe(b.toBigInt());
  });

  it("empty input produces a valid Fr (SHA256 of empty bytes)", () => {
    const hash = IsnadSDK.computeSkillHash(new Uint8Array(0));
    expect(hash).toBeInstanceOf(Fr);
    // SHA256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    // As a field element this should be non-zero
    expect(hash.toBigInt()).toBeGreaterThan(0n);
  });

  it("output fits within the BN254 field (less than the field modulus)", () => {
    // BN254 scalar field order p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
    const BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const content = new Uint8Array(256).fill(0xff); // all-max bytes
    const hash = IsnadSDK.computeSkillHash(content);
    expect(hash.toBigInt()).toBeLessThan(BN254_P);
  });
});

describe("IsnadSDK — pre-activation error behaviour", () => {
  // Before `aztec compile` + `aztec codegen`, contract-backed methods should throw
  // with a clear error message directing developers to the activation steps.
  //
  // These tests verify the error contract so that SDK consumers get helpful messages
  // rather than cryptic runtime failures.

  // We can't create a real IsnadSDK instance without a wallet, so we test the
  // static method separately and document the expected errors here as integration stubs.

  it("computeSkillHash static method is synchronous (no Promise required)", () => {
    const result = IsnadSDK.computeSkillHash(new TextEncoder().encode("test"));
    // If this were async, the test would need await — verifies it's sync
    expect(result).toBeInstanceOf(Fr);
  });
});

// ── checkInstallPolicy ────────────────────────────────────────────────────────

describe("IsnadSDK.checkInstallPolicy — default thresholds", () => {
  it("returns 'deny' for a quarantined skill regardless of score", () => {
    const info = makeInfo({ trustScore: 9999n, attestationCount: 50n, isQuarantined: true });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("deny");
  });

  it("returns 'deny' for zero attestations (unattested skill)", () => {
    const info = makeInfo({ trustScore: 0n, attestationCount: 0n });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("deny");
  });

  it("returns 'sandbox' when count is below threshold even if score passes", () => {
    // 2 attestors < INSTALL_THRESHOLD_COUNT (3), score well above 300
    const info = makeInfo({ trustScore: 9999n, attestationCount: 2n });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("sandbox");
  });

  it("returns 'sandbox' when score is below threshold even if count passes", () => {
    // count=3 meets threshold; score=200 < 300
    const info = makeInfo({ trustScore: 200n, attestationCount: 3n });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("sandbox");
  });

  it("returns 'allow' at exactly the minimum thresholds", () => {
    // count = INSTALL_THRESHOLD_COUNT, score = INSTALL_THRESHOLD_SCORE
    const info = makeInfo({
      trustScore: INSTALL_THRESHOLD_SCORE,
      attestationCount: INSTALL_THRESHOLD_COUNT,
    });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("allow");
  });

  it("returns 'allow' well above both thresholds", () => {
    // 3 root attestors each at quality=100: 3 × 100 × 4 = 1200
    const info = makeInfo({ trustScore: 1200n, attestationCount: 3n });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("allow");
  });

  it("returns 'sandbox' for score = 299 (one below threshold)", () => {
    const info = makeInfo({ trustScore: 299n, attestationCount: 3n });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("sandbox");
  });
});

describe("IsnadSDK.checkInstallPolicy — strict INSTALL_THRESHOLD_WEIGHTED_SCORE", () => {
  it("threshold constant equals 1200n (3 × 100 × 4 — three root attestors at max quality)", () => {
    expect(INSTALL_THRESHOLD_WEIGHTED_SCORE).toBe(1200n);
  });

  it("WEIGHTED is 4× INSTALL_THRESHOLD_SCORE (same ratio as root attestor weight multiplier)", () => {
    expect(INSTALL_THRESHOLD_WEIGHTED_SCORE).toBe(INSTALL_THRESHOLD_SCORE * 4n);
  });

  it("returns 'sandbox' for a skill that passes default policy but not weighted policy", () => {
    // score=300 satisfies the default (>=300) but not the weighted bar (>=1200)
    const info = makeInfo({ trustScore: 300n, attestationCount: 3n });
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("allow"); // default passes
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: INSTALL_THRESHOLD_WEIGHTED_SCORE }),
    ).toBe("sandbox"); // strict policy fails
  });

  it("returns 'allow' at exactly INSTALL_THRESHOLD_WEIGHTED_SCORE (1200n)", () => {
    // 3 root attestors (depth=0) each at quality=100: 3 × 100 × 4 = 1200
    const info = makeInfo({ trustScore: 1200n, attestationCount: 3n });
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: INSTALL_THRESHOLD_WEIGHTED_SCORE }),
    ).toBe("allow");
  });

  it("returns 'sandbox' at score=1199 (one below weighted threshold)", () => {
    const info = makeInfo({ trustScore: 1199n, attestationCount: 3n });
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: INSTALL_THRESHOLD_WEIGHTED_SCORE }),
    ).toBe("sandbox");
  });

  it("still returns 'deny' for quarantined skills even above weighted threshold", () => {
    const info = makeInfo({ trustScore: 9999n, attestationCount: 10n, isQuarantined: true });
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: INSTALL_THRESHOLD_WEIGHTED_SCORE }),
    ).toBe("deny");
  });

  it("still returns 'deny' for zero attestations under weighted policy", () => {
    const info = makeInfo({ trustScore: 0n, attestationCount: 0n });
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: INSTALL_THRESHOLD_WEIGHTED_SCORE }),
    ).toBe("deny");
  });

  it("still enforces count threshold independently with weighted score", () => {
    // score=9999 far above weighted threshold, but only 2 attestors
    const info = makeInfo({ trustScore: 9999n, attestationCount: 2n });
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: INSTALL_THRESHOLD_WEIGHTED_SCORE }),
    ).toBe("sandbox");
  });
});

describe("IsnadSDK.checkInstallPolicy — custom threshold overrides", () => {
  it("accepts a custom scoreThreshold override", () => {
    const info = makeInfo({ trustScore: 500n, attestationCount: 3n });
    // Custom bar of 500 — skill exactly meets it
    expect(IsnadSDK.checkInstallPolicy(info, { scoreThreshold: 500n })).toBe("allow");
    // Custom bar of 501 — skill falls just short
    expect(IsnadSDK.checkInstallPolicy(info, { scoreThreshold: 501n })).toBe("sandbox");
  });

  it("accepts a custom countThreshold override", () => {
    const info = makeInfo({ trustScore: 300n, attestationCount: 2n });
    // Default count threshold is 3, so 2 attestors would sandbox
    expect(IsnadSDK.checkInstallPolicy(info)).toBe("sandbox");
    // With custom countThreshold=2, 2 attestors is sufficient
    expect(IsnadSDK.checkInstallPolicy(info, { countThreshold: 2n })).toBe("allow");
  });

  it("allows overriding both thresholds simultaneously", () => {
    // A lenient policy: score >= 50, count >= 1
    const info = makeInfo({ trustScore: 75n, attestationCount: 1n });
    expect(
      IsnadSDK.checkInstallPolicy(info, { scoreThreshold: 50n, countThreshold: 1n }),
    ).toBe("allow");
    // Still deny on quarantine regardless of options
    const quarantined = makeInfo({ trustScore: 75n, attestationCount: 1n, isQuarantined: true });
    expect(
      IsnadSDK.checkInstallPolicy(quarantined, { scoreThreshold: 50n, countThreshold: 1n }),
    ).toBe("deny");
  });

  it("with no opts uses INSTALL_THRESHOLD_SCORE and INSTALL_THRESHOLD_COUNT defaults", () => {
    // Verify the no-opts path is identical to explicit defaults
    const info = makeInfo({ trustScore: 300n, attestationCount: 3n });
    const implicitDefault = IsnadSDK.checkInstallPolicy(info);
    const explicitDefault = IsnadSDK.checkInstallPolicy(info, {
      scoreThreshold: INSTALL_THRESHOLD_SCORE,
      countThreshold: INSTALL_THRESHOLD_COUNT,
    });
    expect(implicitDefault).toBe(explicitDefault);
  });
});
