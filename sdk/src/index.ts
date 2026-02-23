/**
 * @nullius/isnad — ZK Skill Attestation and Credential Registry for AI agents
 *
 * Built on the Aztec network. Private by default. Verifiable by proof. Owned by no one.
 *
 * @example
 * ```typescript
 * import { IsnadSDK } from '@nullius/isnad';
 *
 * // Connect to a deployed IsnadRegistry contract
 * const isnad = await IsnadSDK.connect(wallet, contractAddress);
 *
 * // Check a skill's trust score before installing
 * const info = await isnad.getTrustScore(skillHash);
 * console.log(`Trust score: ${info.trustScore} from ${info.attestationCount} auditors`);
 *
 * // Store your API key privately
 * await isnad.storeCredential({ keyId: 'openai', value: 'sk-...', label: 'OpenAI Key' });
 * ```
 */

export { IsnadSDK } from "./isnad.js";
export type {
  AttestOptions,
  CredentialResult,
  DelegatedCredentialOptions,
  GrantAccessOptions,
  RotateCredentialOptions,
  SkillTrustInfo,
  StoreCredentialOptions,
} from "./types.js";
export {
  IsnadRegistryContract,
  IsnadRegistryContractArtifact,
} from "./artifacts/IsnadRegistry.js";
