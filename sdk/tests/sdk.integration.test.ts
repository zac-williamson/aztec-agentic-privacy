/**
 * Integration tests for @nullius/isnad — require a live Aztec local network.
 *
 * Prerequisites:
 *   1. [DONE] nargo compile in contracts/isnad_registry/
 *   2. [DONE] npm run gen-artifacts (patches artifact + runs aztec codegen)
 *   3. [DONE] Contract calls activated in sdk/src/isnad.ts
 *   4. [PENDING] aztec start --local-network running at localhost:8080
 *   5. [PENDING] Deploy contract and update DEPLOYED_CONTRACT below
 *
 * Run with: vitest run tests/sdk.integration.test.ts
 *
 * All tests in this file are skipped until prerequisites 4 & 5 are met.
 * When activating: replace `it.skip` with `it` and fill in contract address.
 */
import { describe, expect, it } from "vitest";
import { createPXEClient } from "@aztec/aztec.js";
import { IsnadSDK } from "../src/isnad.js";
import { IsnadRegistryContract } from "../src/artifacts/IsnadRegistry.js";

const DEVNET_URL = "http://localhost:8080";
const DEPLOYED_CONTRACT = "0x0000000000000000000000000000000000000000"; // replace after deploy

describe("IsnadSDK — integration (requires live local network)", () => {
  // ─── SETUP ─────────────────────────────────────────────────────────────────
  //
  // Activation checklist:
  // [x] Run: nargo compile (in contracts/isnad_registry/)
  // [x] Run: npm run gen-artifacts (patches artifact + aztec codegen)
  // [x] Contract calls activated in sdk/src/isnad.ts
  // [x] Imports uncommented at top of this file
  // [ ] Run: aztec start --local-network
  // [ ] Deploy contract: IsnadRegistryContract.deploy(wallet).send().deployed()
  // [ ] Update DEPLOYED_CONTRACT address above
  // [ ] Replace it.skip with it throughout this file

  it.skip("can connect to the PXE at localhost:8080", async () => {
    // const pxe = createPXEClient(DEVNET_URL);
    // const nodeInfo = await pxe.getPXEInfo();
    // expect(nodeInfo.protocolContractAddresses).toBeDefined();
  });

  it.skip("can deploy IsnadRegistry contract", async () => {
    // const wallet = await setupTestWallet(DEVNET_URL);
    // const contract = await IsnadRegistryContract.deploy(wallet).send().deployed();
    // expect(contract.address).toBeDefined();
    // console.log(`Deployed at: ${contract.address}`);
  });

  // ─── ATTESTATION FLOW ──────────────────────────────────────────────────────

  it.skip("getTrustScore returns 0 for an unattested skill", async () => {
    // const isnad = await IsnadSDK.connect(wallet, contractAddress);
    // const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("test-skill"));
    // const info = await isnad.getTrustScore(skillHash);
    // expect(info.trustScore).toBe(0n);
    // expect(info.attestationCount).toBe(0n);
  });

  it.skip("attest() increments trust score for a skill", async () => {
    // const isnad = await IsnadSDK.connect(auditorWallet, contractAddress);
    // const skillContent = new TextEncoder().encode("#!/usr/bin/env node\nconsole.log('safe skill')");
    // const skillHash = IsnadSDK.computeSkillHash(skillContent);
    //
    // await isnad.attest({ skillHash, quality: 85 });
    //
    // const info = await isnad.getTrustScore(skillHash);
    // expect(info.trustScore).toBe(85n);
    // expect(info.attestationCount).toBe(1n);
  });

  it.skip("attest() is anonymous — auditor address not readable from public state", async () => {
    // This verifies the core privacy guarantee: the auditor's identity is never
    // stored in public contract state.
    //
    // const isnad = await IsnadSDK.connect(auditorWallet, contractAddress);
    // const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("private-skill"));
    // await isnad.attest({ skillHash, quality: 90 });
    //
    // // Check public state: score should increment, no auditor address visible
    // const info = await isnad.getTrustScore(skillHash);
    // expect(info.trustScore).toBe(90n);
    // // There is no public function to retrieve auditor addresses — by design.
  });

  it.skip("double-attestation is prevented by SingleUseClaim", async () => {
    // const isnad = await IsnadSDK.connect(auditorWallet, contractAddress);
    // const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("double-test-skill"));
    //
    // await isnad.attest({ skillHash, quality: 70 });
    //
    // // Second attest should throw — the SingleUseClaim nullifier is already spent
    // await expect(isnad.attest({ skillHash, quality: 80 })).rejects.toThrow();
  });

  it.skip("revokeAttestation() decrements trust score", async () => {
    // const isnad = await IsnadSDK.connect(auditorWallet, contractAddress);
    // const skillHash = IsnadSDK.computeSkillHash(new TextEncoder().encode("revoke-test-skill"));
    //
    // await isnad.attest({ skillHash, quality: 60 });
    // const before = await isnad.getTrustScore(skillHash);
    // expect(before.trustScore).toBe(60n);
    //
    // await isnad.revokeAttestation(skillHash);
    // const after = await isnad.getTrustScore(skillHash);
    // expect(after.trustScore).toBe(0n);
    // expect(after.attestationCount).toBe(0n);
  });

  // ─── CREDENTIAL VAULT FLOW ─────────────────────────────────────────────────

  it.skip("storeCredential() stores a credential privately", async () => {
    // const isnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // await isnad.storeCredential({
    //   keyId: "openai-api-key",
    //   value: "sk-test-1234567890abcdef",
    //   label: "OpenAI API Key",
    // });
    // No error means the transaction was accepted
  });

  it.skip("getCredential() retrieves a stored credential", async () => {
    // const isnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // const SECRET = "sk-test-openai-key-value";
    // await isnad.storeCredential({ keyId: "openai-key", value: SECRET, label: "OpenAI" });
    //
    // const result = await isnad.getCredential("openai-key");
    // expect(result).not.toBeNull();
    // expect(result!.value).toBe(SECRET);
  });

  it.skip("getCredential() returns null for unknown keyId", async () => {
    // const isnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // const result = await isnad.getCredential("nonexistent-key");
    // expect(result).toBeNull();
  });

  it.skip("deleteCredential() removes a credential", async () => {
    // const isnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // await isnad.storeCredential({ keyId: "delete-test", value: "temp-secret", label: "temp" });
    // await isnad.deleteCredential("delete-test");
    // const result = await isnad.getCredential("delete-test");
    // expect(result).toBeNull();
  });

  it.skip("rotateCredential() atomically replaces a credential", async () => {
    // const isnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // await isnad.storeCredential({ keyId: "rotate-test", value: "old-secret", label: "old" });
    //
    // await isnad.rotateCredential({ keyId: "rotate-test", newValue: "new-secret", newLabel: "new" });
    //
    // const result = await isnad.getCredential("rotate-test");
    // expect(result!.value).toBe("new-secret");
  });

  // ─── AUTHWIT DELEGATION FLOW ───────────────────────────────────────────────

  it.skip("grantCredentialAccess + getCredentialForSkill delegation flow", async () => {
    // const agentIsnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // const skillIsnad = await IsnadSDK.connect(skillWallet, contractAddress);
    //
    // // Agent stores a credential
    // await agentIsnad.storeCredential({ keyId: "github-token", value: "ghp_testtoken", label: "GitHub" });
    //
    // // Agent grants the skill wallet read access to this one credential
    // const { authwitNonce } = await agentIsnad.grantCredentialAccess({
    //   keyId: "github-token",
    //   skillAddress: skillWallet.getAddress(),
    // });
    //
    // // Skill reads the credential using the delegation
    // const result = await skillIsnad.getCredentialForSkill({
    //   owner: agentWallet.getAddress(),
    //   keyId: "github-token",
    //   authwitNonce,
    // });
    // expect(result!.value).toBe("ghp_testtoken");
  });

  it.skip("delegated skill cannot access a different credential (scope isolation)", async () => {
    // const agentIsnad = await IsnadSDK.connect(agentWallet, contractAddress);
    // const skillIsnad = await IsnadSDK.connect(skillWallet, contractAddress);
    //
    // // Store two credentials
    // await agentIsnad.storeCredential({ keyId: "allowed-key", value: "allowed", label: "A" });
    // await agentIsnad.storeCredential({ keyId: "forbidden-key", value: "forbidden", label: "B" });
    //
    // // Grant access only to allowed-key
    // const { authwitNonce } = await agentIsnad.grantCredentialAccess({
    //   keyId: "allowed-key",
    //   skillAddress: skillWallet.getAddress(),
    // });
    //
    // // Skill tries to access forbidden-key with the allowed-key nonce — should fail
    // await expect(skillIsnad.getCredentialForSkill({
    //   owner: agentWallet.getAddress(),
    //   keyId: "forbidden-key",
    //   authwitNonce,
    // })).rejects.toThrow();
  });
});
