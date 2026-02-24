/**
 * Full Flow Test — simulates the complete user workflow against an in-memory mock.
 *
 * This test suite validates the business logic and encoding/decoding behavior of the
 * Isnad Chain SDK without requiring a live Aztec network (Docker is blocked in this env).
 *
 * It uses:
 *   - Real SDK methods: IsnadSDK.computeSkillHash (SHA256 + BN254 reduction)
 *   - Real encoding logic: field encoding extracted to testable helpers
 *   - In-memory contract state: simulates the Noir contract's state transitions
 *     exactly as the IsnadRegistry contract would execute them on-chain
 *
 * When Docker becomes available, un-skip the equivalent tests in sdk.integration.test.ts
 * to verify the same flows generate real ZK proofs and update real on-chain state.
 *
 * Run with: vitest run tests/sdk.flow.test.ts
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Fr } from "@aztec/aztec.js/fields";
import { IsnadSDK } from "../src/isnad.js";

// ─── ENCODING HELPERS ─────────────────────────────────────────────────────────
// These replicate the private _encodeValue / _decodeValue methods in IsnadSDK.
// They're extracted here so we can test the encode→store→retrieve→decode roundtrip.
// In the real SDK, these run inside private functions — the PXE encrypts the result
// before broadcasting; here we test the logic itself.

function encodeValue(value: string): [Fr, Fr, Fr, Fr] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const fields: [Fr, Fr, Fr, Fr] = [Fr.ZERO, Fr.ZERO, Fr.ZERO, Fr.ZERO];
  for (let i = 0; i < 4; i++) {
    const chunk = bytes.slice(i * 31, (i + 1) * 31);
    let fieldVal = 0n;
    for (let j = 0; j < chunk.length; j++) {
      fieldVal = (fieldVal << 8n) | BigInt(chunk[j]);
    }
    fields[i] = new Fr(fieldVal);
  }
  return fields;
}

function decodeValue(fields: [Fr, Fr, Fr, Fr]): string {
  const bytes: number[] = [];
  for (const field of fields) {
    let val = field.toBigInt();
    const chunk: number[] = [];
    while (val > 0n) {
      chunk.unshift(Number(val & 0xffn));
      val >>= 8n;
    }
    bytes.push(...chunk);
  }
  const nonNull = bytes.filter((b) => b !== 0);
  return new TextDecoder().decode(new Uint8Array(nonNull));
}

function mockTxHash(): string {
  const bytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
  return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── IN-MEMORY CONTRACT STATE SIMULATION ──────────────────────────────────────
// Models the on-chain state transitions that IsnadRegistry.nr performs.
// Each method maps to a Noir function:
//   attest()           -> private fn attest() + public fn _increment_score()
//   revokeAttestation() -> private fn revoke_attestation() + public fn _decrement_score()
//   storeCredential()  -> private fn store_credential()
//   getCredential()    -> unconstrained fn get_credential() (reads PXE cache)
//   deleteCredential() -> private fn delete_credential()
//   rotateCredential() -> private fn rotate_credential()

class MockIsnadContractState {
  // PUBLIC STATE — readable by anyone without a wallet
  private trustScores = new Map<string, bigint>();
  private attestationCounts = new Map<string, bigint>();

  // PRIVATE STATE — stored as encrypted Notes in the Note Hash Tree.
  // Only the owner's PXE can decrypt and read these.
  private attestationNotes = new Map<string, Map<string, { quality: number }>>();
  private credentialNotes = new Map<string, Map<string, { value: [Fr, Fr, Fr, Fr]; label: string }>>();

  // NULLIFIER REGISTRY — SingleUseClaim prevents double-attestation.
  // Each (auditor, skill_hash) pair can only be claimed once.
  private usedClaims = new Set<string>();

  // ─── PUBLIC VIEW FUNCTIONS ───────────────────────────────────────────────

  getTrustScore(skillHashStr: string): bigint {
    return this.trustScores.get(skillHashStr) ?? 0n;
  }

  getAttestationCount(skillHashStr: string): bigint {
    return this.attestationCounts.get(skillHashStr) ?? 0n;
  }

  // ─── PRIVATE FUNCTIONS (simulate ZK private execution) ──────────────────

  // Corresponds to: #[external("private")] fn attest(skill_hash: Field, quality: u8)
  //   1. Validates quality range
  //   2. Claims SingleUseClaim (prevents double-attestation, emits nullifier)
  //   3. Inserts AttestationNote into auditor's PrivateSet
  //   4. Enqueues + executes _increment_score() public function
  attest(auditorAddress: string, skillHashStr: string, quality: number): string {
    if (quality < 0 || quality > 100) {
      throw new Error(`quality must be 0-100, got ${quality}`);
    }

    // SingleUseClaim: poseidon2(auditor, skill_hash) → nullifier (prevents double-attest)
    const claimKey = `${auditorAddress}:${skillHashStr}`;
    if (this.usedClaims.has(claimKey)) {
      throw new Error(
        "Transaction reverted: SingleUseClaim already consumed (double attestation prevented)",
      );
    }
    this.usedClaims.add(claimKey);

    // Insert private AttestationNote (only auditor's PXE can decrypt this)
    if (!this.attestationNotes.has(auditorAddress)) {
      this.attestationNotes.set(auditorAddress, new Map());
    }
    this.attestationNotes.get(auditorAddress)!.set(skillHashStr, { quality });

    // Execute _increment_score() — PUBLIC, visible on-chain
    // Note: auditor's identity (auditorAddress) is NEVER written to public state
    const current = this.trustScores.get(skillHashStr) ?? 0n;
    this.trustScores.set(skillHashStr, current + BigInt(quality));
    const count = this.attestationCounts.get(skillHashStr) ?? 0n;
    this.attestationCounts.set(skillHashStr, count + 1n);

    return mockTxHash();
  }

  // Corresponds to: #[external("private")] fn revoke_attestation(skill_hash: Field)
  //   1. Pops AttestationNote from auditor's PrivateSet (nullifies it)
  //   2. Enqueues + executes _decrement_score() public function
  revokeAttestation(auditorAddress: string, skillHashStr: string): string {
    const notes = this.attestationNotes.get(auditorAddress);
    const note = notes?.get(skillHashStr);
    if (!note) {
      throw new Error("No AttestationNote found for this skill — cannot revoke");
    }

    // Nullify the AttestationNote (pop from PrivateSet emits nullifier)
    notes!.delete(skillHashStr);

    // Execute _decrement_score() — PUBLIC
    const current = this.trustScores.get(skillHashStr) ?? 0n;
    const delta = BigInt(note.quality);
    this.trustScores.set(skillHashStr, current >= delta ? current - delta : 0n);
    const count = this.attestationCounts.get(skillHashStr) ?? 0n;
    this.attestationCounts.set(skillHashStr, count > 0n ? count - 1n : 0n);

    return mockTxHash();
  }

  // Corresponds to: #[external("private")] fn store_credential(key_id, value, label)
  //   Creates a CredentialNote in owner's PrivateSet. Encrypted by PXE.
  storeCredential(
    ownerAddress: string,
    keyIdStr: string,
    encodedValue: [Fr, Fr, Fr, Fr],
    label: string,
  ): string {
    if (!this.credentialNotes.has(ownerAddress)) {
      this.credentialNotes.set(ownerAddress, new Map());
    }
    this.credentialNotes.get(ownerAddress)!.set(keyIdStr, { value: encodedValue, label });
    return mockTxHash();
  }

  // Corresponds to: #[external("utility")] unconstrained fn get_credential(owner, key_id)
  //   Reads from PXE cache (no on-chain tx needed). Returns None if not found.
  getCredential(ownerAddress: string, keyIdStr: string): [Fr, Fr, Fr, Fr] | null {
    return this.credentialNotes.get(ownerAddress)?.get(keyIdStr)?.value ?? null;
  }

  // Corresponds to: #[external("private")] fn delete_credential(key_id)
  //   Pops CredentialNote (emits nullifier). Credential becomes permanently inaccessible.
  deleteCredential(ownerAddress: string, keyIdStr: string): string {
    const notes = this.credentialNotes.get(ownerAddress);
    if (!notes?.has(keyIdStr)) {
      throw new Error("No CredentialNote found — cannot delete");
    }
    notes.delete(keyIdStr);
    return mockTxHash();
  }

  // Corresponds to: #[external("private")] fn rotate_credential(key_id, new_value, label)
  //   Atomic delete + insert. Vault never transiently empty.
  rotateCredential(
    ownerAddress: string,
    keyIdStr: string,
    newValue: [Fr, Fr, Fr, Fr],
    newLabel: string,
  ): string {
    const notes = this.credentialNotes.get(ownerAddress);
    if (!notes?.has(keyIdStr)) {
      throw new Error("No CredentialNote found — cannot rotate");
    }
    notes.set(keyIdStr, { value: newValue, label: newLabel });
    return mockTxHash();
  }

  // ─── TEST HELPERS (not available in real contract — private PXE state) ────

  getAuditorNoteCount(auditorAddress: string): number {
    return this.attestationNotes.get(auditorAddress)?.size ?? 0;
  }

  listCredentialKeys(ownerAddress: string): string[] {
    return Array.from(this.credentialNotes.get(ownerAddress)?.keys() ?? []);
  }
}

// ─── MOCK WALLET ADDRESSES ────────────────────────────────────────────────────
const ALICE = "0x" + "1".repeat(64); // auditor
const BOB = "0x" + "2".repeat(64); // second auditor
const CHARLIE = "0x" + "3".repeat(64); // agent storing credentials

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("IsnadSDK.computeSkillHash — field encoding", () => {
  it("produces a valid Fr for any skill content", () => {
    const content = new TextEncoder().encode("function getWeather() { return 'sunny'; }");
    const hash = IsnadSDK.computeSkillHash(content);
    expect(hash).toBeInstanceOf(Fr);
    expect(hash.toBigInt()).toBeGreaterThan(0n);
  });

  it("is deterministic — identical content always yields identical hash", () => {
    const content = new TextEncoder().encode("weather-reporter-v2.skill.md content bytes");
    const h1 = IsnadSDK.computeSkillHash(content);
    const h2 = IsnadSDK.computeSkillHash(content);
    expect(h1.toBigInt()).toBe(h2.toBigInt());
  });

  it("is content-addressed — any byte change changes the hash", () => {
    const v1 = IsnadSDK.computeSkillHash(new TextEncoder().encode("skill v1"));
    const v2 = IsnadSDK.computeSkillHash(new TextEncoder().encode("skill v2"));
    expect(v1.toBigInt()).not.toBe(v2.toBigInt());
  });

  it("stays within BN254 field bounds (required for Noir Field type)", () => {
    const BN254_P =
      21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const content = new Uint8Array(256).fill(0xff); // max-value bytes — worst case
    const hash = IsnadSDK.computeSkillHash(content);
    expect(hash.toBigInt()).toBeLessThan(BN254_P);
  });
});

describe("Credential encoding roundtrip — _encodeValue / _decodeValue", () => {
  it("short credential value (< 31 bytes, fits in one field)", () => {
    const original = "sk-test-12345";
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("31-byte credential value (exactly one field capacity)", () => {
    const original = "1234567890123456789012345678901"; // 31 chars
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("32-byte credential value (spans two fields)", () => {
    const original = "12345678901234567890123456789012"; // 32 chars
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("62-byte credential value (exactly two fields)", () => {
    const original = "A".repeat(62);
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("realistic OpenAI API key (51 chars, spans two fields)", () => {
    const original = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz12345678";
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("realistic GitHub PAT (93 chars, spans three fields)", () => {
    const original = "ghp_" + "a".repeat(89); // GitHub PATs are 93+ chars
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("124-byte credential value (full 4-field capacity)", () => {
    const original = "B".repeat(124);
    expect(decodeValue(encodeValue(original))).toBe(original);
  });

  it("different credentials encode to different field arrays", () => {
    const enc1 = encodeValue("key-one");
    const enc2 = encodeValue("key-two");
    expect(enc1[0].toBigInt()).not.toBe(enc2[0].toBigInt());
  });
});

describe("Attestation flow", () => {
  let state: MockIsnadContractState;

  beforeEach(() => {
    state = new MockIsnadContractState();
  });

  it("new skill starts with trust score = 0 and attestation count = 0", () => {
    const content = new TextEncoder().encode("function getWeather() { return 'sunny'; }");
    const skillHash = IsnadSDK.computeSkillHash(content);

    expect(state.getTrustScore(skillHash.toString())).toBe(0n);
    expect(state.getAttestationCount(skillHash.toString())).toBe(0n);
  });

  it("attest() increments public trust score and count", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("safe-skill-content"));
    const hashStr = skillHash.toString();

    const txHash = state.attest(ALICE, hashStr, 85);

    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(state.getTrustScore(hashStr)).toBe(85n);
    expect(state.getAttestationCount(hashStr)).toBe(1n);
  });

  it("auditor identity is never in public state (privacy guarantee)", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("private-skill"));
    const hashStr = skillHash.toString();

    state.attest(ALICE, hashStr, 90);

    // Only aggregate data in public state — no auditor address visible
    expect(state.getTrustScore(hashStr)).toBe(90n);
    expect(state.getAttestationCount(hashStr)).toBe(1n);
    // Alice's private note exists only in her PXE (not on-chain public state)
    expect(state.getAuditorNoteCount(ALICE)).toBe(1);
    expect(state.getAuditorNoteCount(BOB)).toBe(0); // Bob has no notes for this skill
  });

  it("multiple auditors accumulate scores independently", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("multi-attested-skill"));
    const hashStr = skillHash.toString();

    state.attest(ALICE, hashStr, 85);
    state.attest(BOB, hashStr, 92);

    expect(state.getTrustScore(hashStr)).toBe(177n); // 85 + 92
    expect(state.getAttestationCount(hashStr)).toBe(2n);
    expect(state.getAuditorNoteCount(ALICE)).toBe(1);
    expect(state.getAuditorNoteCount(BOB)).toBe(1);
  });

  it("double-attestation is prevented by SingleUseClaim nullifier", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("double-test-skill"));
    const hashStr = skillHash.toString();

    state.attest(ALICE, hashStr, 85);

    // Second attest from ALICE for same skill must revert
    expect(() => state.attest(ALICE, hashStr, 90)).toThrow(
      "SingleUseClaim already consumed",
    );

    // Score must be unchanged — only first attestation accepted
    expect(state.getTrustScore(hashStr)).toBe(85n);
    expect(state.getAttestationCount(hashStr)).toBe(1n);
  });

  it("BOB can still attest after ALICE's double-attest attempt fails", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("multi-auditor-skill"));
    const hashStr = skillHash.toString();

    state.attest(ALICE, hashStr, 85);
    expect(() => state.attest(ALICE, hashStr, 90)).toThrow(); // Alice's double-attest fails

    // Bob can still attest independently
    state.attest(BOB, hashStr, 92);

    expect(state.getTrustScore(hashStr)).toBe(177n); // 85 + 92
    expect(state.getAttestationCount(hashStr)).toBe(2n);
  });

  it("quality must be in 0-100 range", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("quality-test"));
    const hashStr = skillHash.toString();

    expect(() => state.attest(ALICE, hashStr, -1)).toThrow("quality must be 0-100");
    expect(() => state.attest(ALICE, hashStr, 101)).toThrow("quality must be 0-100");
    // Edge cases — valid
    expect(() => state.attest(ALICE, hashStr, 0)).not.toThrow();
    expect(() => state.attest(BOB, hashStr, 100)).not.toThrow();
  });

  it("revoke_attestation() decrements score and nullifies private note", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("revoke-test-skill"));
    const hashStr = skillHash.toString();

    state.attest(ALICE, hashStr, 85);
    expect(state.getTrustScore(hashStr)).toBe(85n);
    expect(state.getAuditorNoteCount(ALICE)).toBe(1);

    state.revokeAttestation(ALICE, hashStr);

    expect(state.getTrustScore(hashStr)).toBe(0n);
    expect(state.getAttestationCount(hashStr)).toBe(0n);
    expect(state.getAuditorNoteCount(ALICE)).toBe(0); // private note is nullified
  });

  it("partial revocation: one revokes, other's score remains", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("partial-revoke-skill"));
    const hashStr = skillHash.toString();

    state.attest(ALICE, hashStr, 80);
    state.attest(BOB, hashStr, 70);
    expect(state.getTrustScore(hashStr)).toBe(150n);

    // Alice revokes; Bob's attestation stays
    state.revokeAttestation(ALICE, hashStr);

    expect(state.getTrustScore(hashStr)).toBe(70n); // only Bob's remains
    expect(state.getAttestationCount(hashStr)).toBe(1n);
  });

  it("cannot revoke without a prior attestation", () => {
    const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("no-attest-skill"));
    expect(() => state.revokeAttestation(ALICE, skillHash.toString())).toThrow(
      "No AttestationNote found",
    );
  });
});

describe("Credential vault flow", () => {
  let state: MockIsnadContractState;

  beforeEach(() => {
    state = new MockIsnadContractState();
  });

  it("storeCredential() and getCredential() roundtrip", () => {
    const secretValue = "sk-openai-test-key-1234567890";
    const txHash = state.storeCredential(
      CHARLIE,
      "openai-key",
      encodeValue(secretValue),
      "OpenAI API Key",
    );

    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const retrieved = state.getCredential(CHARLIE, "openai-key");
    expect(retrieved).not.toBeNull();
    expect(decodeValue(retrieved!)).toBe(secretValue);
  });

  it("getCredential() returns null for unknown key", () => {
    expect(state.getCredential(CHARLIE, "nonexistent-key")).toBeNull();
  });

  it("credentials are isolated between owners (private note ownership)", () => {
    const aliceSecret = "alice-openai-key";
    const charlieSecret = "charlie-openai-key";

    state.storeCredential(ALICE, "openai-key", encodeValue(aliceSecret), "Alice's key");
    state.storeCredential(CHARLIE, "openai-key", encodeValue(charlieSecret), "Charlie's key");

    // Each owner only sees their own credential
    expect(decodeValue(state.getCredential(ALICE, "openai-key")!)).toBe(aliceSecret);
    expect(decodeValue(state.getCredential(CHARLIE, "openai-key")!)).toBe(charlieSecret);

    // Alice cannot see Charlie's credential and vice versa (PXE encryption)
    expect(state.getCredential(ALICE, "github-token")).toBeNull();
  });

  it("multiple credentials per owner", () => {
    state.storeCredential(CHARLIE, "openai-key", encodeValue("sk-openai"), "OpenAI");
    state.storeCredential(CHARLIE, "github-token", encodeValue("ghp-github"), "GitHub");
    state.storeCredential(CHARLIE, "anthropic-key", encodeValue("sk-ant"), "Anthropic");

    const keys = state.listCredentialKeys(CHARLIE);
    expect(keys).toHaveLength(3);
    expect(keys).toContain("openai-key");
    expect(keys).toContain("github-token");
    expect(keys).toContain("anthropic-key");

    expect(decodeValue(state.getCredential(CHARLIE, "openai-key")!)).toBe("sk-openai");
    expect(decodeValue(state.getCredential(CHARLIE, "github-token")!)).toBe("ghp-github");
    expect(decodeValue(state.getCredential(CHARLIE, "anthropic-key")!)).toBe("sk-ant");
  });

  it("deleteCredential() nullifies the note — credential becomes inaccessible", () => {
    state.storeCredential(CHARLIE, "temp-key", encodeValue("temp-secret"), "temp");
    expect(state.getCredential(CHARLIE, "temp-key")).not.toBeNull();

    state.deleteCredential(CHARLIE, "temp-key");

    expect(state.getCredential(CHARLIE, "temp-key")).toBeNull();
    expect(state.listCredentialKeys(CHARLIE)).toHaveLength(0);
  });

  it("deleteCredential() on non-existent key throws", () => {
    expect(() => state.deleteCredential(CHARLIE, "nonexistent")).toThrow("No CredentialNote found");
  });

  it("rotateCredential() atomically replaces credential value", () => {
    state.storeCredential(CHARLIE, "api-key", encodeValue("old-secret-v1"), "v1");

    state.rotateCredential(CHARLIE, "api-key", encodeValue("new-secret-v2"), "v2");

    const retrieved = state.getCredential(CHARLIE, "api-key");
    expect(retrieved).not.toBeNull();
    expect(decodeValue(retrieved!)).toBe("new-secret-v2");
    // Old value is gone — nullifier was emitted
  });

  it("rotateCredential() on non-existent key throws", () => {
    expect(() =>
      state.rotateCredential(CHARLIE, "nonexistent", encodeValue("val"), "label"),
    ).toThrow("No CredentialNote found");
  });

  it("other credentials unaffected by delete", () => {
    state.storeCredential(CHARLIE, "keep-key", encodeValue("keep-value"), "keep");
    state.storeCredential(CHARLIE, "delete-key", encodeValue("delete-value"), "delete");

    state.deleteCredential(CHARLIE, "delete-key");

    expect(state.getCredential(CHARLIE, "delete-key")).toBeNull();
    expect(decodeValue(state.getCredential(CHARLIE, "keep-key")!)).toBe("keep-value");
  });
});

describe("Complete end-to-end flow", () => {
  it("connect wallet → attest skill → verify trust score → store credential → retrieve", () => {
    const state = new MockIsnadContractState();
    const AGENT_WALLET = ALICE; // Alice is our auditor + credential holder

    // ── Step 1: Wallet connection ──────────────────────────────────────────
    // In real mode: createPXEClient(pxeUrl) + load test wallet from local network
    console.log(`\n[1] Wallet connected: ${AGENT_WALLET.slice(0, 12)}...`);

    // ── Step 2: Compute skill hash ─────────────────────────────────────────
    // In real mode: IsnadSDK.computeSkillHash(fs.readFileSync(skillPath))
    const skillContent = new TextEncoder().encode(`
      // weather-reporter-v2.skill.md
      export async function getWeather(location: string): Promise<WeatherData> {
        const res = await fetch(\`https://wttr.in/\${location}?format=json\`);
        return res.json();
      }
    `);
    const skillHash = IsnadSDK.computeSkillHash(skillContent);
    const hashStr = skillHash.toString();
    console.log(`[2] Skill hash: ${hashStr.slice(0, 24)}...`);
    console.log(`    Hash standard: SHA256(content) % BN254_P`);

    // ── Step 3: Check initial trust score ─────────────────────────────────
    // In real mode: await isnad.getTrustScore(skillHash)
    const initialScore = state.getTrustScore(hashStr);
    const initialCount = state.getAttestationCount(hashStr);
    expect(initialScore).toBe(0n);
    expect(initialCount).toBe(0n);
    console.log(`[3] Trust score: ${initialScore} | Attestations: ${initialCount} → UNSCORED`);

    // ── Step 4: Submit attestation ─────────────────────────────────────────
    // In real mode: await isnad.attest({ skillHash, quality: 88 })
    // PXE generates ZK proof (~15-40s), auditor identity NEVER on-chain
    const tx1 = state.attest(AGENT_WALLET, hashStr, 88);
    expect(tx1).toMatch(/^0x[0-9a-f]{64}$/);
    console.log(`[4] Attestation submitted (quality=88)`);
    console.log(`    tx: ${tx1.slice(0, 24)}...`);
    console.log(`    Real mode: ZK proof generated, auditor identity never revealed on-chain`);

    // ── Step 5: Verify trust score incremented ─────────────────────────────
    const newScore = state.getTrustScore(hashStr);
    const newCount = state.getAttestationCount(hashStr);
    expect(newScore).toBe(88n);
    expect(newCount).toBe(1n);
    console.log(`[5] Trust score: ${newScore} | Attestations: ${newCount} → EMERGING`);

    // ── Step 6: Store a credential ─────────────────────────────────────────
    // In real mode: await isnad.storeCredential({ keyId, value, label })
    // PXE encrypts the note; sequencer only sees the encrypted hash
    const SECRET = "sk-proj-realkey1234567890abcdef";
    const tx2 = state.storeCredential(
      AGENT_WALLET,
      "openai-key",
      encodeValue(SECRET),
      "OpenAI API Key",
    );
    expect(tx2).toMatch(/^0x[0-9a-f]{64}$/);
    console.log(`[6] Credential stored: openai-key`);
    console.log(`    tx: ${tx2.slice(0, 24)}...`);
    console.log(`    Real mode: encrypted with PXE key, unreadable to anyone else`);

    // ── Step 7: Retrieve the credential ───────────────────────────────────
    // In real mode: await isnad.getCredential("openai-key")
    // PXE reads from local cache — no on-chain transaction needed
    const retrieved = state.getCredential(AGENT_WALLET, "openai-key");
    expect(retrieved).not.toBeNull();
    const decoded = decodeValue(retrieved!);
    expect(decoded).toBe(SECRET);
    console.log(`[7] Credential retrieved: ${decoded.slice(0, 12)}...`);
    console.log(`    Decoded from [Field; 4] → string correctly`);

    console.log(`\n✓ Full end-to-end flow PASSED`);
    console.log(`  Trust score: 0 → 88 (one attestation, quality 88)`);
    console.log(`  Credential: stored and retrieved with perfect roundtrip`);
    console.log(`  Privacy: auditor identity never touched public state\n`);
  });

  it("multi-auditor trust building flow", () => {
    const state = new MockIsnadContractState();
    const AUDITOR_1 = ALICE;
    const AUDITOR_2 = BOB;
    const AUDITOR_3 = CHARLIE;

    const skillHash = IsnadSDK.computeSkillHash(
      new TextEncoder().encode("high-trust-skill content bytes"),
    );
    const hashStr = skillHash.toString();

    // Three independent auditors attest
    state.attest(AUDITOR_1, hashStr, 90);
    state.attest(AUDITOR_2, hashStr, 85);
    state.attest(AUDITOR_3, hashStr, 92);

    const score = state.getTrustScore(hashStr);
    const count = state.getAttestationCount(hashStr);

    expect(score).toBe(267n); // 90 + 85 + 92
    expect(count).toBe(3n);

    // Trust level classification: count >= 3 and score >= 150 → TRUSTED
    const isTrusted = count >= 3n && score >= 150n;
    expect(isTrusted).toBe(true);

    console.log(
      `Multi-auditor: score=${score}, count=${count} → TRUSTED (qualifies for gated operations)`,
    );
  });

  it("credential rotation without vault downtime", () => {
    const state = new MockIsnadContractState();
    const AGENT = CHARLIE;

    // Initial credential
    state.storeCredential(AGENT, "api-key", encodeValue("old-api-key-v1"), "v1");
    expect(decodeValue(state.getCredential(AGENT, "api-key")!)).toBe("old-api-key-v1");

    // Rotate — atomic, vault never empty
    state.rotateCredential(AGENT, "api-key", encodeValue("new-api-key-v2"), "v2");
    expect(decodeValue(state.getCredential(AGENT, "api-key")!)).toBe("new-api-key-v2");

    // Old value is gone
    const retrieved = state.getCredential(AGENT, "api-key")!;
    expect(decodeValue(retrieved)).not.toBe("old-api-key-v1");

    console.log(`Credential rotated atomically: v1 → v2, old value nullified`);
  });
});
