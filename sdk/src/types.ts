import type { AztecAddress } from "@aztec/aztec.js/addresses";
import type { Fr } from "@aztec/aztec.js/fields";

/**
 * Minimum cumulative trust score before an agent should auto-allow a skill install.
 *
 * Derived from community Q1 discussion (builds post, 2026-02-23):
 * "allow if count >= 3 and score >= 300, sandbox if count = 1-2, deny if count = 0"
 *
 * Agents may override this to set stricter or looser policies based on their risk tolerance.
 * For high-risk environments (financial tools, system access), consider doubling both thresholds.
 */
export const INSTALL_THRESHOLD_SCORE = 300n;

/**
 * Minimum number of independent auditors before an agent should auto-allow a skill install.
 *
 * Derived from community Q1 discussion (builds post, 2026-02-23):
 * "allow if count >= 3 and score >= 300, sandbox if count = 1-2, deny if count = 0"
 *
 * Agents may override this to set stricter or looser policies based on their risk tolerance.
 * Three independent auditors is the minimum for meaningful convergence; ten is the ESTABLISHED bar.
 */
export const INSTALL_THRESHOLD_COUNT = 3n;

/**
 * The install policy verdict returned by IsnadSDK.checkInstallPolicy().
 *
 *   allow   — meets both INSTALL_THRESHOLD_COUNT and INSTALL_THRESHOLD_SCORE
 *   sandbox — has attestations but below threshold (proceed with caution)
 *   deny    — quarantined (KNOWN MALICIOUS) or zero attestations
 */
export type InstallVerdict = "allow" | "sandbox" | "deny";

/**
 * The result of calling getTrustScore — public data readable by anyone.
 */
export interface SkillTrustInfo {
  /** SHA256 of the skill file content, as a hex string */
  skillHash: string;
  /**
   * Cumulative quality score (sum of all auditor quality scores).
   * Returns 0 for quarantined skills regardless of accumulated attestations.
   */
  trustScore: bigint;
  /** Number of unique auditors who have attested this skill */
  attestationCount: bigint;
  /**
   * Whether this skill is under admin quarantine (KNOWN MALICIOUS).
   * When true, trustScore is forced to 0 by the contract.
   * Distinguish from an unattested skill (isQuarantined=false, attestationCount=0).
   */
  isQuarantined: boolean;
}

/**
 * Attestation methodology — what kind of audit was performed.
 *
 * Encoded as u8 on-chain; stored privately in the AttestationNote.
 * The claim_type is never revealed publicly — only the auditor knows how they audited.
 */
export const ClaimType = {
  /** Static analysis of skill source code (YARA rules, linting, dependency scanning) */
  CODE_REVIEW: 0,
  /** Runtime behavior monitoring (syscall tracing, tool-call auditing, network inspection) */
  BEHAVIORAL: 1,
  /** Execution in an isolated sandbox with output verification against a test harness */
  SANDBOXED_EXECUTION: 2,
} as const;

export type ClaimType = (typeof ClaimType)[keyof typeof ClaimType];

/**
 * Options for submitting an attestation.
 */
export interface AttestOptions {
  /** SHA256 of the skill file content bytes. Use computeSkillHash() for consistency. */
  skillHash: string | Fr;
  /** Quality score: 0-100. How safe/well-written is this skill? */
  quality: number;
  /**
   * Attestation methodology. Defaults to ClaimType.CODE_REVIEW (0).
   * This is stored privately in your AttestationNote — never revealed on-chain.
   * Use ClaimType.BEHAVIORAL or ClaimType.SANDBOXED_EXECUTION for higher-assurance audits.
   */
  claimType?: ClaimType;
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
 * Information about an attestor's position in the Isnad chain.
 * Returned by getAttestorDepth().
 */
export interface AttestorInfo {
  /** The attestor's Aztec address */
  address: string;
  /** Whether this address is in the authorized Isnad chain */
  isAuthorized: boolean;
  /**
   * Vouching chain depth: 0 = root attestor (added by admin), 1 = vouched by root, etc.
   * Only meaningful if isAuthorized is true.
   */
  depth: number;
  /**
   * Trust score weight multiplier for this attestor's attestations.
   * depth=0: weight=4, depth=1: weight=3, depth=2: weight=2, depth=3+: weight=1
   * effective_quality = quality * weight
   */
  weight: number;
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
