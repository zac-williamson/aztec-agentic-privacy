/**
 * Mock IsnadSDK for development.
 *
 * Implements the same interface as the real IsnadSDK but operates entirely
 * in-memory with simulated proof generation delays. Allows building and
 * demoing the full UI without a live Aztec network or deployed contract.
 *
 * Activation path to real SDK:
 * 1. Resolve GLIBC mismatch (upgrade to 2.38+)
 * 2. Run: aztec compile (in contracts/isnad_registry/)
 * 3. Run: aztec codegen target --outdir sdk/src/artifacts
 * 4. Set NEXT_PUBLIC_USE_MOCK=false in .env.local
 * 5. Set NEXT_PUBLIC_PXE_URL and NEXT_PUBLIC_CONTRACT_ADDRESS
 */

import type {
  AttestOptions,
  CredentialResult,
  GrantAccessOptions,
  LocalAttestation,
  RotateCredentialOptions,
  SkillTrustInfo,
  StoreCredentialOptions,
} from "./types";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

/** Pre-seeded mock trust scores (skill_hash → accumulated score data) */
const SEED_SKILLS: Array<{
  hash: string;
  score: bigint;
  count: bigint;
  history: Array<{ quality: number; daysAgo: number }>;
}> = [
  {
    hash: "0x7f3ac4b82d19e8a1f5b6c3d4e9f2a0b7c8d5e6f1a2b3c4d5e6f7a8b9c0d1e2f",
    score: 847n,
    count: 9n,
    history: [
      { quality: 95, daysAgo: 2 },
      { quality: 88, daysAgo: 3 },
      { quality: 92, daysAgo: 5 },
      { quality: 78, daysAgo: 7 },
      { quality: 100, daysAgo: 9 },
      { quality: 85, daysAgo: 12 },
      { quality: 90, daysAgo: 15 },
      { quality: 72, daysAgo: 18 },
      { quality: 47, daysAgo: 21 },
    ],
  },
  {
    hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
    score: 312n,
    count: 4n,
    history: [
      { quality: 88, daysAgo: 1 },
      { quality: 75, daysAgo: 4 },
      { quality: 82, daysAgo: 6 },
      { quality: 67, daysAgo: 10 },
    ],
  },
  {
    hash: "0xdeadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718",
    score: 0n,
    count: 0n,
    history: [],
  },
];

// ─── MOCK STATE ──────────────────────────────────────────────────────────────

/** In-memory state (resets on page reload) */
interface MockState {
  trustScores: Map<string, { score: bigint; count: bigint; history: Array<{ quality: number; ts: Date }> }>;
  myAttestations: LocalAttestation[];
  credentials: Map<string, { label: string; value: string }>;
  walletAddress: string;
}

function createInitialState(walletAddress: string): MockState {
  const trustScores = new Map<string, { score: bigint; count: bigint; history: Array<{ quality: number; ts: Date }> }>();

  for (const seed of SEED_SKILLS) {
    const now = Date.now();
    trustScores.set(seed.hash.toLowerCase(), {
      score: seed.score,
      count: seed.count,
      history: seed.history.map(({ quality, daysAgo }) => ({
        quality,
        ts: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
      })),
    });
  }

  return {
    trustScores,
    myAttestations: [],
    credentials: new Map(),
    walletAddress,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makeTxHash(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Simulated ZK proof delay (15-40 seconds would be realistic; mock uses 3-5s) */
function proofDelay(): Promise<void> {
  const ms = 3000 + Math.random() * 2000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));
}

export async function computeSkillHashFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function computeSkillHashFromText(text: string): string {
  // Simple mock: just encode the text. Real version uses SHA256.
  // In dev, we use this to look up seeded hashes by entering them directly.
  return text.toLowerCase().startsWith("0x") ? text.toLowerCase() : text.toLowerCase();
}

// ─── MOCK SDK CLASS ───────────────────────────────────────────────────────────

export class MockIsnadSDK {
  private state: MockState;

  constructor(walletAddress: string) {
    this.state = createInitialState(walletAddress);
  }

  get walletAddress(): string {
    return this.state.walletAddress;
  }

  // ─── TRUST SCORE ─────────────────────────────────────────────────────────

  async getTrustScore(skillHash: string): Promise<SkillTrustInfo> {
    await readDelay();
    const key = skillHash.toLowerCase();
    const data = this.state.trustScores.get(key);

    return {
      skillHash,
      trustScore: data?.score ?? 0n,
      attestationCount: data?.count ?? 0n,
    };
  }

  async getAttestationHistory(
    skillHash: string,
  ): Promise<Array<{ quality: number; ts: Date }>> {
    await readDelay();
    const key = skillHash.toLowerCase();
    const data = this.state.trustScores.get(key);
    return data?.history ?? [];
  }

  // ─── ATTESTATION ─────────────────────────────────────────────────────────

  /** Simulate submitting an attestation (includes fake proof generation delay) */
  async attest(
    opts: AttestOptions,
    onProofProgress?: (phase: "proving" | "submitting") => void,
  ): Promise<{ txHash: string }> {
    const key = opts.skillHash.toLowerCase();

    // Check double-attestation
    const alreadyAttested = this.state.myAttestations.some(
      (a) => a.skillHash.toLowerCase() === key && !a.revoked,
    );
    if (alreadyAttested) {
      throw new Error(
        "You have already attested this skill (SingleUseClaim prevents double-attestation).",
      );
    }

    onProofProgress?.("proving");
    await proofDelay();
    onProofProgress?.("submitting");
    await new Promise((r) => setTimeout(r, 500));

    const txHash = makeTxHash();
    const now = new Date();

    // Update trust score
    const existing = this.state.trustScores.get(key) ?? { score: 0n, count: 0n, history: [] };
    this.state.trustScores.set(key, {
      score: existing.score + BigInt(opts.quality),
      count: existing.count + 1n,
      history: [{ quality: opts.quality, ts: now }, ...existing.history],
    });

    // Record local attestation
    this.state.myAttestations.unshift({
      skillHash: opts.skillHash,
      quality: opts.quality,
      timestamp: now,
      txHash,
      revoked: false,
    });

    return { txHash };
  }

  /** Simulate revoking an attestation */
  async revokeAttestation(
    skillHash: string,
    onProofProgress?: (phase: "proving" | "submitting") => void,
  ): Promise<{ txHash: string }> {
    const key = skillHash.toLowerCase();

    const attestation = this.state.myAttestations.find(
      (a) => a.skillHash.toLowerCase() === key && !a.revoked,
    );
    if (!attestation) {
      throw new Error("No active attestation found for this skill.");
    }

    onProofProgress?.("proving");
    await proofDelay();
    onProofProgress?.("submitting");
    await new Promise((r) => setTimeout(r, 500));

    const txHash = makeTxHash();

    // Decrement trust score
    const existing = this.state.trustScores.get(key);
    if (existing) {
      this.state.trustScores.set(key, {
        score: existing.score >= BigInt(attestation.quality) ? existing.score - BigInt(attestation.quality) : 0n,
        count: existing.count > 0n ? existing.count - 1n : 0n,
        history: existing.history.filter((h) => h.ts !== attestation.timestamp),
      });
    }

    // Mark as revoked
    attestation.revoked = true;

    return { txHash };
  }

  /** Get this auditor's local attestation history */
  getMyAttestations(): LocalAttestation[] {
    return [...this.state.myAttestations];
  }

  // ─── CREDENTIAL VAULT ─────────────────────────────────────────────────────

  async storeCredential(
    opts: StoreCredentialOptions,
    onProofProgress?: (phase: "proving" | "submitting") => void,
  ): Promise<{ txHash: string }> {
    if (this.state.credentials.has(opts.keyId)) {
      throw new Error(`Credential '${opts.keyId}' already exists. Use rotateCredential() to replace.`);
    }

    onProofProgress?.("proving");
    await proofDelay();
    onProofProgress?.("submitting");
    await new Promise((r) => setTimeout(r, 500));

    this.state.credentials.set(opts.keyId, { label: opts.label, value: opts.value });
    return { txHash: makeTxHash() };
  }

  async getCredential(keyId: string): Promise<CredentialResult | null> {
    await readDelay();
    const cred = this.state.credentials.get(keyId);
    if (!cred) return null;
    return { keyId, value: cred.value, label: cred.label };
  }

  async deleteCredential(
    keyId: string,
    onProofProgress?: (phase: "proving" | "submitting") => void,
  ): Promise<{ txHash: string }> {
    if (!this.state.credentials.has(keyId)) {
      throw new Error(`No credential found with keyId '${keyId}'.`);
    }

    onProofProgress?.("proving");
    await proofDelay();
    onProofProgress?.("submitting");
    await new Promise((r) => setTimeout(r, 500));

    this.state.credentials.delete(keyId);
    return { txHash: makeTxHash() };
  }

  async rotateCredential(
    opts: RotateCredentialOptions,
    onProofProgress?: (phase: "proving" | "submitting") => void,
  ): Promise<{ txHash: string }> {
    if (!this.state.credentials.has(opts.keyId)) {
      throw new Error(`No credential found with keyId '${opts.keyId}'.`);
    }

    onProofProgress?.("proving");
    await proofDelay();
    onProofProgress?.("submitting");
    await new Promise((r) => setTimeout(r, 500));

    this.state.credentials.set(opts.keyId, { label: opts.newLabel, value: opts.newValue });
    return { txHash: makeTxHash() };
  }

  /** Returns all credential key IDs (not values) for listing */
  listCredentials(): Array<{ keyId: string; label: string }> {
    return Array.from(this.state.credentials.entries()).map(([keyId, { label }]) => ({
      keyId,
      label,
    }));
  }

  async grantCredentialAccess(opts: GrantAccessOptions): Promise<{ authwitNonce: bigint }> {
    await readDelay();
    const nonce = opts.nonce ?? BigInt(Date.now());
    return { authwitNonce: nonce };
  }
}
