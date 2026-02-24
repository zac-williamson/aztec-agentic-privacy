import { createHash } from "node:crypto";
import { Fr } from "@aztec/aztec.js/fields";
import type { Wallet } from "@aztec/aztec.js/wallet";
import type { AztecAddress } from "@aztec/aztec.js/addresses";
import type {
  AttestOptions,
  AttestorInfo,
  CredentialResult,
  DelegatedCredentialOptions,
  GrantAccessOptions,
  RotateCredentialOptions,
  SkillTrustInfo,
  StoreCredentialOptions,
} from "./types.js";
import { ClaimType } from "./types.js";
import { IsnadRegistryContract } from "./artifacts/IsnadRegistry.js";

/**
 * IsnadSDK — TypeScript interface to the IsnadRegistry Aztec contract.
 *
 * Example usage:
 * ```typescript
 * import { IsnadSDK } from '@nullius/isnad';
 *
 * const isnad = await IsnadSDK.connect(wallet, walletAddress, contractAddress);
 *
 * // Check if a skill is safe before installing
 * const trust = await isnad.getTrustScore('0x7f3a...c4b8');
 * if (trust.attestationCount >= 3n && trust.trustScore >= 200n) {
 *   console.log('Skill is trusted — installing');
 * }
 *
 * // Store your OpenAI API key privately
 * await isnad.storeCredential({
 *   keyId: 'openai-api-key',
 *   value: 'sk-...',
 *   label: 'OpenAI API Key',
 * });
 * ```
 */
export class IsnadSDK {
  private constructor(
    private readonly wallet: Wallet,
    private readonly from: AztecAddress,
    private readonly contractAddress: AztecAddress,
    private readonly contract: IsnadRegistryContract,
  ) {}

  /**
   * Connect to a deployed IsnadRegistry contract.
   *
   * @param wallet           An Aztec wallet (PXE-backed, holds private keys)
   * @param from             The AztecAddress of the calling agent
   * @param contractAddress  The deployed IsnadRegistry contract address
   */
  static async connect(
    wallet: Wallet,
    from: AztecAddress,
    contractAddress: AztecAddress,
  ): Promise<IsnadSDK> {
    const contract = await IsnadRegistryContract.at(contractAddress, wallet);
    return new IsnadSDK(wallet, from, contractAddress, contract);
  }

  /**
   * Read the trust score and attestation count for a skill.
   * No authentication needed — this reads public state.
   *
   * @param skillHash  SHA256 of the skill file, as a hex string or Fr
   */
  async getTrustScore(skillHash: string | Fr): Promise<SkillTrustInfo> {
    const hash = typeof skillHash === "string" ? Fr.fromHexString(skillHash) : skillHash;

    const [trustScore, attestationCount] = await Promise.all([
      this.contract.methods.get_trust_score(hash).simulate({ from: this.from }),
      this.contract.methods.get_attestation_count(hash).simulate({ from: this.from }),
    ]);

    return {
      skillHash: hash.toString(),
      trustScore: BigInt(trustScore as bigint | number),
      attestationCount: BigInt(attestationCount as bigint | number),
    };
  }

  /**
   * Submit an anonymous attestation for a skill.
   *
   * Generates a ZK proof that you submitted a valid attestation, then increments
   * the skill's public trust score. Your identity is never recorded on-chain.
   * The claim_type is stored privately in your AttestationNote — never visible on-chain.
   *
   * Proof generation takes 10-60 seconds depending on hardware.
   * The returned promise resolves when the transaction is confirmed.
   *
   * @param opts  skillHash + quality score (0-100) + optional claimType
   * @throws      If you have already attested this skill (double-attestation prevented)
   */
  async attest(opts: AttestOptions): Promise<{ txHash: string }> {
    const hash = typeof opts.skillHash === "string"
      ? Fr.fromHexString(opts.skillHash)
      : opts.skillHash;

    if (opts.quality < 0 || opts.quality > 100) {
      throw new Error(`quality must be 0-100, got ${opts.quality}`);
    }

    const claimType = opts.claimType ?? ClaimType.CODE_REVIEW;

    const receipt = await this.contract.methods
      .attest(hash, opts.quality, claimType)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  /**
   * Store a credential privately in your vault.
   *
   * The credential is encrypted with your PXE key before being stored on-chain.
   * Nobody else can read it — not the network, not the sequencer, not the contract.
   *
   * @param opts  keyId, value (the secret), and label (display name)
   */
  async storeCredential(opts: StoreCredentialOptions): Promise<{ txHash: string }> {
    const keyId = this._hashKeyId(opts.keyId);
    const value = this._encodeValue(opts.value);
    const label = this._encodeLabel(opts.label);

    const receipt = await this.contract.methods
      .store_credential(keyId, value, label)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  /**
   * Retrieve a credential from your vault.
   *
   * Reads from your local PXE cache — no on-chain transaction needed.
   * Returns null if no credential with the given keyId is found.
   *
   * @param keyId  The credential identifier (e.g. 'openai-api-key')
   */
  async getCredential(keyId: string): Promise<CredentialResult | null> {
    const keyIdHash = this._hashKeyId(keyId);

    const result = await this.contract.methods
      .get_credential(this.from, keyIdHash)
      .simulate({ from: this.from });
    // get_credential returns Option<[Field; 4]> — check if Some
    if (!result || (result as any).is_none?.()) return null;
    const rawValue = (result as any).unwrap?.() ?? result;
    return { keyId, value: this._decodeValue(rawValue as [Fr, Fr, Fr, Fr]), label: "" };
  }

  /**
   * Read a credential on behalf of an owner (AuthWit delegated access).
   *
   * A skill calls this function presenting an AuthWit the owner created for:
   *   (skillAddress, get_credential_for_skill, owner, keyId, authwitNonce)
   * The AuthWit is single-use — authwitNonce must be unique per grant.
   *
   * The owner can call this directly by passing authwitNonce = 0n.
   *
   * @param opts  owner, keyId, authwitNonce
   */
  async getCredentialForSkill(opts: DelegatedCredentialOptions): Promise<CredentialResult | null> {
    const keyId = this._hashKeyId(opts.keyId);
    const nonce = opts.authwitNonce ?? 0n;

    const receipt = await this.contract.methods
      .get_credential_for_skill(opts.owner, keyId, new Fr(nonce))
      .send({ from: this.from });
    // Return value is carried in the receipt (private tx return value via PXE)
    const rawValue = (receipt as any).returnValue as [Fr, Fr, Fr, Fr];
    if (!rawValue) return null;
    return { keyId: opts.keyId, value: this._decodeValue(rawValue), label: "" };
  }

  /**
   * Grant a specific skill read access to one specific credential.
   *
   * Creates an AuthWit (authorization witness) scoped to the exact
   * (skillAddress, get_credential_for_skill, owner, keyId, nonce) tuple.
   * The skill cannot use this to access any other credential.
   * The AuthWit is single-use — each delegation needs a unique nonce.
   *
   * @param opts  keyId, skillAddress, optional nonce
   */
  async grantCredentialAccess(opts: GrantAccessOptions): Promise<{ authwitNonce: bigint }> {
    const keyId = this._hashKeyId(opts.keyId);
    const nonce = opts.nonce ?? BigInt(Date.now());

    const action = this.contract.methods
      .get_credential_for_skill(this.from, keyId, new Fr(nonce));
    const call = await action.getFunctionCall();
    await this.wallet.createAuthWit(this.from, { caller: opts.skillAddress, call });
    return { authwitNonce: nonce };
  }

  // ─── CHAIN-OF-TRUST MANAGEMENT ────────────────────────────────────────────

  /**
   * Add a root attestor to the Isnad chain (admin only).
   *
   * Root attestors are the high-trust anchors of the chain (depth=0).
   * Their attestations carry maximum weight (quality * 4).
   * Only the address set as admin at deployment can call this.
   *
   * @param attestorAddress  Aztec address of the new root attestor
   * @throws If caller is not admin, or address is already authorized
   */
  async addRootAttestor(attestorAddress: AztecAddress): Promise<{ txHash: string }> {
    const receipt = await this.contract.methods
      .add_root_attestor(attestorAddress)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  /**
   * Vouch a new attestor into the Isnad chain.
   *
   * The new attestor's depth = caller's depth + 1. Their attestation weight is:
   *   depth=1 (vouched by root): quality * 3
   *   depth=2: quality * 2
   *   depth=3+: quality * 1
   *
   * The vouching chain is PUBLIC — anyone can verify who vouched whom.
   *
   * @param attestorAddress  Aztec address of the new chain member
   * @throws If caller is not authorized, or address is already authorized
   */
  async vouch(attestorAddress: AztecAddress): Promise<{ txHash: string }> {
    const receipt = await this.contract.methods
      .vouch(attestorAddress)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  /**
   * Check whether an address is an authorized attestor in the Isnad chain.
   * Reads public state — no authentication needed.
   *
   * @param address  Aztec address to check
   */
  async isAuthorizedAttestor(address: AztecAddress): Promise<boolean> {
    const result = await this.contract.methods
      .is_authorized_attestor(address)
      .simulate({ from: this.from });
    return Boolean(result);
  }

  /**
   * Get the vouching chain depth for an authorized attestor.
   * Returns 0 for both root attestors and unauthorized addresses.
   * Call isAuthorizedAttestor() first to distinguish the two cases.
   *
   * @param address  Aztec address to query
   */
  async getAttestorDepth(address: AztecAddress): Promise<AttestorInfo> {
    const [authorized, depth] = await Promise.all([
      this.contract.methods.is_authorized_attestor(address).simulate({ from: this.from }),
      this.contract.methods.get_attestor_depth(address).simulate({ from: this.from }),
    ]);
    return {
      address: address.toString(),
      isAuthorized: Boolean(authorized),
      depth: Number(depth),
      weight: this._weightForDepth(Number(depth)),
    };
  }

  /**
   * Revoke a prior attestation for a skill.
   *
   * Nullifies the AttestationNote and decrements the skill's public trust score.
   * Use when you discover that a skill you previously attested is unsafe.
   *
   * Note: after revoking you cannot re-attest the same skill — the anti-double-attestation
   * claim was consumed when you originally attested.
   *
   * @param skillHash  SHA256 of the skill file, as a hex string or Fr
   */
  async revokeAttestation(skillHash: string | Fr): Promise<{ txHash: string }> {
    const hash = typeof skillHash === "string" ? Fr.fromHexString(skillHash) : skillHash;

    const receipt = await this.contract.methods
      .revoke_attestation(hash)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  /**
   * Delete a credential from your vault.
   *
   * Nullifies the CredentialNote permanently. The credential becomes inaccessible.
   * For replacing a credential, prefer rotateCredential() which is atomic.
   *
   * @param keyId  The credential identifier to delete (e.g. 'openai-api-key')
   */
  async deleteCredential(keyId: string): Promise<{ txHash: string }> {
    const keyIdHash = this._hashKeyId(keyId);

    const receipt = await this.contract.methods
      .delete_credential(keyIdHash)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  /**
   * Rotate (atomically replace) a credential in your vault.
   *
   * Nullifies the old CredentialNote and inserts a new one with the same keyId
   * in a single transaction. Safer than deleteCredential + storeCredential because
   * the vault is never transiently empty.
   *
   * @param opts  keyId (existing credential to replace), newValue, newLabel
   */
  async rotateCredential(opts: RotateCredentialOptions): Promise<{ txHash: string }> {
    const keyIdHash = this._hashKeyId(opts.keyId);
    const newValue = this._encodeValue(opts.newValue);
    const newLabel = this._encodeLabel(opts.newLabel);

    const receipt = await this.contract.methods
      .rotate_credential(keyIdHash, newValue, newLabel)
      .send({ from: this.from });
    return { txHash: receipt.txHash.toString() };
  }

  // ─── HELPER UTILITIES ──────────────────────────────────────────────────────

  /**
   * Compute the canonical skill hash for a skill file.
   * Standard: SHA256 of the skill file content bytes, reduced to a BN254 Field element.
   *
   * Uses Node.js built-in `node:crypto` (available in Node.js 18+).
   * The SHA256 output (32 bytes) is interpreted as a big-endian 256-bit integer
   * and reduced modulo the BN254 scalar field order. The bias is negligible (~2^-4).
   *
   * @param content  The raw bytes of the skill file (e.g. fs.readFileSync(path))
   */
  static computeSkillHash(content: Uint8Array): Fr {
    const hashBytes = createHash("sha256").update(content).digest();
    let value = 0n;
    for (const byte of hashBytes) {
      value = (value << 8n) | BigInt(byte);
    }
    // Reduce modulo BN254 scalar field order — SHA256 is 256 bits, field is ~254 bits.
    // Roughly 1/4 of hashes exceed the field modulus and need reduction; bias is negligible.
    const BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    return new Fr(value % BN254_P);
  }

  private _hashKeyId(keyId: string): Fr {
    // Convert string key identifier to a Field using poseidon2 of UTF-8 bytes
    // For now, use a simple encoding — will be replaced with poseidon2 call
    const encoder = new TextEncoder();
    const bytes = encoder.encode(keyId);
    // Pack first 31 bytes as a Field (Aztec's str->Field convention)
    let value = 0n;
    for (let i = 0; i < Math.min(bytes.length, 31); i++) {
      value = (value << 8n) | BigInt(bytes[i]);
    }
    return new Fr(value);
  }

  private _encodeValue(value: string): [Fr, Fr, Fr, Fr] {
    // Encode a string credential value as [Field; 4] (128 bytes max)
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

  private _decodeValue(fields: [Fr, Fr, Fr, Fr]): string {
    // Decode [Field; 4] back to a string credential value
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
    // Remove null bytes
    const nonNull = bytes.filter((b) => b !== 0);
    return new TextDecoder().decode(new Uint8Array(nonNull));
  }

  /** Returns the trust score weight multiplier for a given chain depth. */
  private _weightForDepth(depth: number): number {
    if (depth === 0) return 4;
    if (depth === 1) return 3;
    if (depth === 2) return 2;
    return 1;
  }

  private _encodeLabel(label: string): Fr {
    // Encode label as a Field (up to 31 ASCII bytes)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(label.slice(0, 31));
    let value = 0n;
    for (const byte of bytes) {
      value = (value << 8n) | BigInt(byte);
    }
    return new Fr(value);
  }
}
