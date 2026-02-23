/**
 * Unit tests for @nullius/isnad — methods that work without a live Aztec network.
 *
 * Run with: vitest run tests/sdk.unit.test.ts
 * (requires npm install first)
 */
import { describe, expect, it } from "vitest";
import { IsnadSDK } from "../src/isnad.js";
import { Fr } from "@aztec/aztec.js/fields";

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
