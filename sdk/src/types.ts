import type { AztecAddress } from "@aztec/aztec.js/addresses";
import type { Fr } from "@aztec/aztec.js/fields";

/**
 * The result of calling getTrustScore — public data readable by anyone.
 */
export interface SkillTrustInfo {
  /** SHA256 of the skill file content, as a hex string */
  skillHash: string;
  /** Cumulative quality score (sum of all auditor quality scores) */
  trustScore: bigint;
  /** Number of unique auditors who have attested this skill */
  attestationCount: bigint;
}

/**
 * Options for submitting an attestation.
 */
export interface AttestOptions {
  /** SHA256 of the skill file content bytes. Use computeSkillHash() for consistency. */
  skillHash: string | Fr;
  /** Quality score: 0-100. How safe/well-written is this skill? */
  quality: number;
}

/**
 * Options for storing a credential in the private vault.
 */
export interface StoreCredentialOptions {
  /**
   * Identifier for this credential key. Recommended: use a descriptive string
   * like "openai-api-key" — the SDK will hash it to a Field automatically.
   */
  keyId: string;
  /**
   * The credential value (the actual API key, token, etc.)
   * Up to 128 bytes. Stored encrypted in your PXE — nobody else can read it.
   */
  value: string;
  /** Human-readable label for display in UIs. Up to 31 ASCII chars. */
  label: string;
}

/**
 * A credential retrieved from the private vault.
 */
export interface CredentialResult {
  keyId: string;
  value: string;
  label: string;
}

/**
 * Options for a skill calling get_credential_for_skill with an owner's AuthWit.
 */
export interface DelegatedCredentialOptions {
  /** The credential owner's address */
  owner: AztecAddress;
  /** The key identifier to retrieve */
  keyId: string;
  /**
   * The nonce matching the AuthWit the owner created.
   * Pass 0n if the owner is calling directly (no delegation).
   */
  authwitNonce?: bigint;
}

/**
 * Options for granting a skill access to one of your credentials.
 * Creates an AuthWit scoped to (skillAddress, get_credential_for_skill, owner, keyId, nonce).
 */
export interface GrantAccessOptions {
  /** The key to grant access to */
  keyId: string;
  /** The skill's contract address that will receive read access */
  skillAddress: AztecAddress;
  /**
   * Optional nonce for the AuthWit. Defaults to Date.now().
   * The same nonce cannot be used twice (AuthWit is single-use).
   * Return value from grantCredentialAccess includes the nonce used.
   */
  nonce?: bigint;
}

/**
 * Options for rotating (replacing) a credential atomically.
 */
export interface RotateCredentialOptions {
  /** The key identifier of the credential to replace */
  keyId: string;
  /** The new credential value (up to 128 bytes) */
  newValue: string;
  /** Human-readable label for the new credential (up to 31 ASCII chars) */
  newLabel: string;
}
