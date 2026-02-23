/**
 * Shared types for the Isnad Chain frontend.
 * Mirrors the SDK types from @nullius/isnad for frontend use.
 */

export interface SkillTrustInfo {
  skillHash: string;
  trustScore: bigint;
  attestationCount: bigint;
}

export interface AttestOptions {
  skillHash: string;
  quality: number;
}

export interface StoreCredentialOptions {
  keyId: string;
  value: string;
  label: string;
}

export interface CredentialResult {
  keyId: string;
  value: string;
  label: string;
}

export interface RotateCredentialOptions {
  keyId: string;
  newValue: string;
  newLabel: string;
}

export interface GrantAccessOptions {
  keyId: string;
  skillAddress: string;
  nonce?: bigint;
}

/**
 * A private attestation in the auditor's local history.
 * This exists only in the mock — the real PXE decrypts AttestationNotes locally.
 */
export interface LocalAttestation {
  skillHash: string;
  quality: number;
  timestamp: Date;
  txHash: string;
  revoked: boolean;
}

/**
 * Trust level classification based on score thresholds.
 */
export type TrustLevel = "none" | "low" | "moderate" | "trusted";

export function classifyTrust(score: bigint, count: bigint): TrustLevel {
  if (count === 0n) return "none";
  if (score < 300n) return "low";
  if (score < 700n) return "moderate";
  return "trusted";
}

export const TRUST_LEVEL_CONFIG = {
  none: {
    label: "No attestations",
    color: "text-ink-muted",
    barColor: "bg-wire-200",
    badge: "bg-wire-200 text-ink-muted",
  },
  low: {
    label: "Low trust",
    color: "text-signal-danger",
    barColor: "bg-signal-danger",
    badge: "bg-signal-danger/10 text-signal-danger border border-signal-danger/30",
  },
  moderate: {
    label: "Moderate trust",
    color: "text-signal-caution",
    barColor: "bg-signal-caution",
    badge: "bg-signal-caution/10 text-signal-caution border border-signal-caution/30",
  },
  trusted: {
    label: "Trusted",
    color: "text-signal-trusted",
    barColor: "bg-signal-trusted",
    badge: "bg-signal-trusted/10 text-signal-trusted border border-signal-trusted/30",
  },
} as const;
