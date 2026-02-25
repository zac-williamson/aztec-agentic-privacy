// @ts-nocheck
/**
 * RealSdkWrapper — wraps the live IsnadRegistry contract via a running PXE.
 *
 * ACTIVATION REQUIREMENTS (run scripts/activate-real-sdk.sh):
 *   1. GLIBC 2.38+ or Docker available on the host
 *   2. `aztec start --local-network` running (PXE at localhost:8080)
 *   3. IsnadRegistry deployed; address in NEXT_PUBLIC_CONTRACT_ADDRESS
 *   4. In frontend/: npm install @aztec/aztec.js@4.0.0-devnet.2-patch.0 @aztec/accounts@4.0.0-devnet.2-patch.0
 *   5. In sdk/: npm run build
 *   6. NEXT_PUBLIC_USE_MOCK=false in frontend/.env.local
 *
 * This file uses // @ts-nocheck because @aztec/aztec.js and @nullius/isnad
 * are not yet installed in the frontend node_modules.
 * Once the packages are installed, type errors here will surface and can be fixed.
 *
 * Interface compatibility: RealSdkWrapper implements IsnadSdkLike from ./types,
 * allowing isnad-context.tsx to swap in either MockIsnadSDK or RealSdkWrapper.
 */

import type {
  AttestationEvent,
  AttestOptions,
  CredentialResult,
  GrantAccessOptions,
  IsnadSdkLike,
  LocalAttestation,
  RotateCredentialOptions,
  SkillTrustInfo,
  StoreCredentialOptions,
} from "./types";

type ProofProgressFn = (phase: "proving" | "submitting") => void;

/**
 * Wraps the real IsnadSDK with:
 * - Proof progress callbacks (called right before and after the tx)
 * - Local session state for attestation/credential lists
 * - Graceful error messages when PXE is unreachable
 *
 * Instantiate via: await RealSdkWrapper.create(pxeUrl, contractAddress)
 */
export class RealSdkWrapper implements IsnadSdkLike {
  private readonly sdk: any; // IsnadSDK from @nullius/isnad
  private readonly _walletAddress: string;
  private _myAttestations: LocalAttestation[] = [];
  private _credentialMap: Map<string, { label: string }> = new Map();

  private constructor(sdk: any, walletAddress: string) {
    this.sdk = sdk;
    this._walletAddress = walletAddress;
  }

  /**
   * Connect to a deployed IsnadRegistry contract via a running PXE.
   *
   * Uses the first test account from the local network. For production,
   * replace getDeployedTestAccounts() with proper account management
   * (e.g., Schnorr account creation from a stored private key).
   *
   * @param pxeUrl           PXE HTTP endpoint (e.g. http://localhost:8080)
   * @param contractAddress  Deployed IsnadRegistry address (0x hex string)
   */
  static async create(pxeUrl: string, contractAddress: string): Promise<RealSdkWrapper> {
    // Dynamic imports — will throw with a helpful message if packages are missing
    let createPXEClient: any;
    let AztecAddress: any;
    let getDeployedTestAccounts: any;
    let IsnadSDK: any;

    try {
      // webpackIgnore: true prevents webpack from trying to bundle these at build time.
      // They are resolved at runtime from node_modules when PXE is available.
      const aztecJs = await import(/* webpackIgnore: true */ "@aztec/aztec.js");
      createPXEClient = aztecJs.createPXEClient;
      AztecAddress = (await import(/* webpackIgnore: true */ "@aztec/aztec.js/addresses")).AztecAddress;
    } catch {
      throw new Error(
        "Missing @aztec/aztec.js. Run: cd frontend && npm install @aztec/aztec.js@4.0.0-devnet.2-patch.0",
      );
    }

    try {
      const accountsModule = await import(/* webpackIgnore: true */ "@aztec/accounts");
      getDeployedTestAccounts = accountsModule.getDeployedTestAccounts;
    } catch {
      throw new Error(
        "Missing @aztec/accounts. Run: cd frontend && npm install @aztec/accounts@4.0.0-devnet.2-patch.0",
      );
    }

    try {
      const sdkModule = await import(/* webpackIgnore: true */ "@nullius/isnad");
      IsnadSDK = sdkModule.IsnadSDK;
    } catch {
      throw new Error(
        "Missing @nullius/isnad. Run: cd sdk && npm run build, then link or install the package.",
      );
    }

    // Connect to PXE
    const pxe = createPXEClient(pxeUrl);

    // Verify PXE is reachable
    try {
      await pxe.getNodeInfo();
    } catch {
      throw new Error(
        `Cannot reach PXE at ${pxeUrl}.\n` +
          "Ensure the Aztec local network is running:\n" +
          "  aztec start --local-network",
      );
    }

    // Get the first test account (local-network ships with pre-funded accounts)
    const testAccounts = await getDeployedTestAccounts(pxe);
    if (testAccounts.length === 0) {
      throw new Error(
        "No test accounts on PXE.\n" +
          "Did you run `aztec start --local-network`?\n" +
          "For production, implement Schnorr account creation here.",
      );
    }

    const wallet = await testAccounts[0].getWallet();
    const from = wallet.getAddress();
    const addr = AztecAddress.fromString(contractAddress);
    const sdk = await IsnadSDK.connect(wallet, from, addr);

    return new RealSdkWrapper(sdk, from.toString());
  }

  get walletAddress(): string {
    return this._walletAddress;
  }

  // ─── TRUST READS ────────────────────────────────────────────────────────────

  async getTrustScore(skillHash: string): Promise<SkillTrustInfo> {
    return this.sdk.getTrustScore(skillHash);
  }

  async getAttestationHistory(_skillHash: string): Promise<AttestationEvent[]> {
    // The contract stores aggregate scores, not individual attestation timestamps.
    // A v2 indexer could reconstruct this from on-chain events.
    // For now, return the locally tracked history for this session.
    const key = _skillHash.toLowerCase();
    return this._myAttestations
      .map((a) => ({
        quality: a.quality,
        ts: a.timestamp,
        type: (a.revoked ? "revoke" : "attest") as "attest" | "revoke",
      }))
      .filter((e) => {
        const match = this._myAttestations.find(
          (a) => a.skillHash.toLowerCase() === key && a.timestamp === e.ts,
        );
        return !!match;
      });
  }

  // ─── ATTESTATION ────────────────────────────────────────────────────────────

  async attest(opts: AttestOptions, onProgress?: ProofProgressFn): Promise<{ txHash: string }> {
    onProgress?.("proving");
    const result = await this.sdk.attest(opts);
    onProgress?.("submitting");

    this._myAttestations.unshift({
      skillHash: opts.skillHash,
      quality: opts.quality,
      timestamp: new Date(),
      txHash: result.txHash,
      revoked: false,
    });

    return result;
  }

  async revokeAttestation(
    skillHash: string,
    onProgress?: ProofProgressFn,
  ): Promise<{ txHash: string }> {
    onProgress?.("proving");
    const result = await this.sdk.revokeAttestation(skillHash);
    onProgress?.("submitting");

    const a = this._myAttestations.find(
      (x) => x.skillHash.toLowerCase() === skillHash.toLowerCase() && !x.revoked,
    );
    if (a) a.revoked = true;

    return result;
  }

  getMyAttestations(): LocalAttestation[] {
    return [...this._myAttestations];
  }

  // ─── CREDENTIAL VAULT ───────────────────────────────────────────────────────

  async storeCredential(
    opts: StoreCredentialOptions,
    onProgress?: ProofProgressFn,
  ): Promise<{ txHash: string }> {
    onProgress?.("proving");
    const result = await this.sdk.storeCredential(opts);
    onProgress?.("submitting");
    this._credentialMap.set(opts.keyId, { label: opts.label });
    return result;
  }

  async getCredential(keyId: string): Promise<CredentialResult | null> {
    return this.sdk.getCredential(keyId);
  }

  async deleteCredential(
    keyId: string,
    onProgress?: ProofProgressFn,
  ): Promise<{ txHash: string }> {
    onProgress?.("proving");
    const result = await this.sdk.deleteCredential(keyId);
    onProgress?.("submitting");
    this._credentialMap.delete(keyId);
    return result;
  }

  async rotateCredential(
    opts: RotateCredentialOptions,
    onProgress?: ProofProgressFn,
  ): Promise<{ txHash: string }> {
    onProgress?.("proving");
    const result = await this.sdk.rotateCredential(opts);
    onProgress?.("submitting");
    this._credentialMap.set(opts.keyId, { label: opts.newLabel });
    return result;
  }

  listCredentials(): Array<{ keyId: string; label: string }> {
    return Array.from(this._credentialMap.entries()).map(([keyId, { label }]) => ({
      keyId,
      label,
    }));
  }

  async grantCredentialAccess(opts: GrantAccessOptions): Promise<{ authwitNonce: bigint }> {
    return this.sdk.grantCredentialAccess(opts);
  }
}
