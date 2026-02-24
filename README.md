# The Isnad Chain

[![Tests](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/test.yml/badge.svg)](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/test.yml)
[![Deploy](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/deploy.yml/badge.svg)](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/deploy.yml)

**ZK Skill Attestation and Credential Registry for AI agents — built on Aztec.**

Private attestations. Public trust scores. Unforgeable proofs. Owned by no one.

**Live demo:** [zac-williamson.github.io/aztec-agentic-privacy](https://zac-williamson.github.io/aztec-agentic-privacy/)

---

## The Problem

AI agent skill ecosystems have no trust layer. Skills are installed without verification, credentials are stored in plaintext `.env` files, and auditors who vouch for code expose themselves to retaliation. The result: malicious skills that steal API keys, and a community demanding "isnad chains" — cryptographically verifiable provenance — with no infrastructure to provide them.

## The Solution

The Isnad Chain is an [Aztec](https://aztec.network) smart contract that gives every AI agent three things:

1. **Anonymous attestations** — auditors submit ZK proofs that a skill is safe without their identity ever appearing on-chain. The skill's public trust score increments; the auditor stays private.
2. **Content-addressed trust** — skills are identified by `SHA256(file_content)`. If the file changes, the hash changes and prior attestations are invalidated automatically. Malicious updates are cryptographically detectable.
3. **Private credential vault** — API keys and secrets stored as encrypted notes in the agent's PXE. Only the owner can read them. Scoped delegation via AuthWit lets a specific skill read one key without touching any other.

---

## SDK Quickstart

### Install

```bash
npm install @nullius/isnad
```

Requires Node.js 22+ and `@aztec/aztec.js` 4.0.0-devnet.2-patch.0.

### Connect to the devnet deployment

```typescript
import { IsnadSDK } from '@nullius/isnad';
import { createPXEClient, AztecAddress } from '@aztec/aztec.js';

// The IsnadRegistry is deployed on Aztec devnet at:
const CONTRACT_ADDRESS = AztecAddress.fromString(
  '0x05d66323796566fe663f938f82df1dee62ac052693c666e858a132317004ddea'
);

// Connect to the Aztec PXE (your private execution environment)
const pxe = createPXEClient('http://localhost:8080');

// Attach your wallet (see "Setting up a wallet" below)
const isnad = await IsnadSDK.connect(wallet, wallet.getAddress(), CONTRACT_ADDRESS);
```

### Check a skill's trust score (no wallet required)

Reading trust scores is public — no authentication, no proof generation, instant.

```typescript
import { IsnadSDK } from '@nullius/isnad';
import { AztecAddress, Fr } from '@aztec/aztec.js';

const isnad = await IsnadSDK.connect(wallet, wallet.getAddress(), CONTRACT_ADDRESS);

const info = await isnad.getTrustScore('0x7f3a4c9b2e8d1f5a...');
// Returns: { skillHash, trustScore: bigint, attestationCount: bigint }

console.log(`Trust score: ${info.trustScore} from ${info.attestationCount} auditors`);

// Trust level interpretation:
// attestationCount == 0 → UNSCORED  — no audit record, install at own risk
// count < 3 or score < 150  → EMERGING  — some signal, treat with caution
// count < 10 or score < 500 → TRUSTED   — community-validated
// score >= 500, count >= 10 → ESTABLISHED — strong convergence signal
```

### Compute a skill hash

The standard: `SHA256(skill_file_content_bytes)` reduced to a BN254 field element. Hash the content, not the filename or URL — if the file changes, the hash changes automatically.

```typescript
import { IsnadSDK } from '@nullius/isnad';
import { readFileSync } from 'fs';

const content = readFileSync('weather-reporter-v2.skill.md');
const skillHash = IsnadSDK.computeSkillHash(content);
// skillHash is an Fr (BN254 field element) — pass directly to attest() / getTrustScore()

console.log(skillHash.toString()); // hex string
```

---

## Attestation

### Submit an anonymous attestation

Generates a ZK proof that you examined the skill, then increments its public trust score. Your identity is never recorded on-chain. Proof generation takes 10-60 seconds depending on hardware — plan for it in your UX.

```typescript
import { IsnadSDK, ClaimType } from '@nullius/isnad';

const isnad = await IsnadSDK.connect(wallet, wallet.getAddress(), CONTRACT_ADDRESS);

const receipt = await isnad.attest({
  skillHash: '0x7f3a4c9b...',  // or pass the Fr from computeSkillHash()
  quality: 92,                   // 0-100: how safe / well-written is this skill?
  claimType: ClaimType.SANDBOXED_EXECUTION,  // optional — defaults to CODE_REVIEW
});

console.log(`Attested. Tx: ${receipt.txHash}`);
// On-chain: trust_scores[skillHash] += 92, attestation_counts[skillHash] += 1
// Your identity: never appears on-chain.
```

**claim_type encoding** (stored privately in your AttestationNote — never revealed publicly):

| Constant | Value | Meaning |
|---|---|---|
| `ClaimType.CODE_REVIEW` | `0` | Static analysis — YARA rules, linting, dependency scanning, manual review |
| `ClaimType.BEHAVIORAL` | `1` | Runtime monitoring — syscall tracing, tool-call auditing, network inspection |
| `ClaimType.SANDBOXED_EXECUTION` | `2` | Isolated sandbox execution with output verification against a test harness |

Higher values represent deeper, more costly audit methodologies. The trust score algorithm may weight them differently in future versions.

### Revoke an attestation

Use when you discover that a skill you previously attested is unsafe. Nullifies your `AttestationNote` and decrements the skill's public trust score. After revoking, you cannot re-attest the same skill — the anti-double-attestation claim is consumed on original attestation.

```typescript
const receipt = await isnad.revokeAttestation('0x7f3a4c9b...');
// trust_scores[skillHash] -= your_original_quality_score
// attestation_counts[skillHash] -= 1
```

---

## Credential Vault

### Store a credential privately

Stored as an encrypted note in your PXE — the network, sequencer, and contract see only the note hash. Nobody else can read your credentials.

Credentials support up to 128 bytes of value (4 × 31-byte chunks). Labels are truncated to 31 ASCII characters.

```typescript
const receipt = await isnad.storeCredential({
  keyId: 'openai-api-key',   // string identifier — hashed to a Field automatically
  value: 'sk-proj-...',      // the actual secret (up to 128 bytes)
  label: 'OpenAI API Key',   // display name for UIs (up to 31 chars)
});

console.log(`Stored. Tx: ${receipt.txHash}`);
```

### Retrieve a credential

Reads from your local PXE note cache — no on-chain transaction, instant.

```typescript
const cred = await isnad.getCredential('openai-api-key');
// Returns: { keyId, value, label } or null if not found

if (cred) {
  process.env.OPENAI_API_KEY = cred.value;
}
```

### Delete a credential

Permanently nullifies the `CredentialNote`. The credential becomes unreadable by anyone. For replacements, prefer `rotateCredential()` — it is atomic.

```typescript
await isnad.deleteCredential('openai-api-key');
```

### Rotate a credential

Atomically replaces a credential in a single transaction: nullifies the old `CredentialNote` and inserts a new one. Safer than `delete` + `store` because the vault is never transiently empty.

```typescript
const receipt = await isnad.rotateCredential({
  keyId: 'openai-api-key',
  newValue: 'sk-proj-new-...',
  newLabel: 'OpenAI API Key (rotated)',
});
```

---

## Delegated Access (AuthWit)

Let a specific skill read exactly one credential — nothing else. The delegation is cryptographically scoped and single-use.

### Owner: grant access to a skill

```typescript
// Grant the skill at skillAddress read access to your GitHub token.
// authwitNonce is returned — share it with the skill so it can call getCredentialForSkill.
const { authwitNonce } = await isnad.grantCredentialAccess({
  keyId: 'github-token',
  skillAddress: AztecAddress.fromString('0xSKILL_ADDRESS'),
  // nonce: optional — defaults to Date.now()
});

console.log(`Granted. Nonce: ${authwitNonce}`);
// The skill now has a single-use authorization to read 'github-token'.
// It cannot read any other credential.
```

### Skill: read a delegated credential

```typescript
// The skill calls with the AuthWit nonce the owner provided.
const cred = await isnad.getCredentialForSkill({
  owner: ownerAddress,
  keyId: 'github-token',
  authwitNonce: 123456789n,  // must match the nonce in the owner's AuthWit
});

if (cred) {
  // Use cred.value for the GitHub API call
}
```

**Owner calling directly** (no delegation needed):

```typescript
// Owner can call with authwitNonce = 0n to bypass the authorization check.
const cred = await isnad.getCredentialForSkill({
  owner: wallet.getAddress(),
  keyId: 'github-token',
  authwitNonce: 0n,
});
```

---

## Setting Up a Wallet

To call private functions (attest, store credentials, etc.) you need an Aztec wallet backed by a PXE.

### Local development (Aztec local network)

```bash
# Start a local Aztec network
aztec start --local-network

# The PXE runs at http://localhost:8080
```

```typescript
import { createPXEClient, getDeployedTestAccounts } from '@aztec/aztec.js';

const pxe = createPXEClient('http://localhost:8080');

// Use one of the pre-funded test accounts
const accounts = await getDeployedTestAccounts(pxe);
const wallet = await accounts[0].getWallet();

const isnad = await IsnadSDK.connect(wallet, wallet.getAddress(), CONTRACT_ADDRESS);
```

### Aztec devnet

```typescript
import { createPXEClient } from '@aztec/aztec.js';

// Connect to the public devnet PXE
const pxe = createPXEClient('https://rpc.aztec.network');  // devnet endpoint

// ... create or import your account, then:
const isnad = await IsnadSDK.connect(wallet, wallet.getAddress(), CONTRACT_ADDRESS);
```

For read-only calls (`getTrustScore`, `getAttestationCount`), any wallet works — the wallet address is only used for note decryption in private reads.

---

## Complete Example: Verify a Skill Before Installing

```typescript
import { IsnadSDK } from '@nullius/isnad';
import { readFileSync } from 'fs';

async function isSkillSafe(skillPath: string, isnad: IsnadSDK): Promise<boolean> {
  // Hash the skill file by its content, not its name
  const content = readFileSync(skillPath);
  const skillHash = IsnadSDK.computeSkillHash(content);

  const info = await isnad.getTrustScore(skillHash);

  if (info.attestationCount === 0n) {
    console.warn(`[isnad] ${skillPath}: UNSCORED — no audit record. Install at own risk.`);
    return false;
  }

  if (info.attestationCount < 3n || info.trustScore < 150n) {
    console.warn(
      `[isnad] ${skillPath}: EMERGING — ` +
      `score ${info.trustScore} from ${info.attestationCount} auditors`
    );
    return false;
  }

  console.log(
    `[isnad] ${skillPath}: TRUSTED — ` +
    `score ${info.trustScore} from ${info.attestationCount} auditors`
  );
  return true;
}
```

## Complete Example: Secure API Key Storage

```typescript
import { IsnadSDK } from '@nullius/isnad';

async function setupCredentials(isnad: IsnadSDK) {
  // Store your keys privately on-chain — encrypted, only you can read them
  await isnad.storeCredential({
    keyId: 'openai-api-key',
    value: process.env.OPENAI_API_KEY!,
    label: 'OpenAI API Key',
  });

  await isnad.storeCredential({
    keyId: 'github-token',
    value: process.env.GITHUB_TOKEN!,
    label: 'GitHub PAT',
  });

  // Safe to delete from environment now
  delete process.env.OPENAI_API_KEY;
  delete process.env.GITHUB_TOKEN;
}

async function useCredentials(isnad: IsnadSDK) {
  // Read from PXE cache — no on-chain transaction, instant
  const openai = await isnad.getCredential('openai-api-key');
  const github = await isnad.getCredential('github-token');

  if (!openai || !github) throw new Error('Credentials not found in vault');

  return { openaiKey: openai.value, githubToken: github.value };
}
```

---

## API Reference

### `IsnadSDK.connect(wallet, from, contractAddress)`

Static factory — creates an SDK instance connected to a deployed `IsnadRegistry`.

| Param | Type | Description |
|---|---|---|
| `wallet` | `Wallet` | Aztec wallet (PXE-backed, holds private keys) |
| `from` | `AztecAddress` | The calling agent's address (usually `wallet.getAddress()`) |
| `contractAddress` | `AztecAddress` | Deployed IsnadRegistry contract address |

### `IsnadSDK.computeSkillHash(content)`

Static helper — computes the canonical skill hash from file content bytes.

| Param | Type | Description |
|---|---|---|
| `content` | `Uint8Array` | Raw bytes of the skill file (e.g. `fs.readFileSync(path)`) |

Returns: `Fr` (BN254 field element) — pass directly to any method accepting a `skillHash`.

### `getTrustScore(skillHash)`

Read the trust score and attestation count for a skill. No auth required. Returns `SkillTrustInfo`:

```typescript
interface SkillTrustInfo {
  skillHash: string;          // hex string
  trustScore: bigint;         // cumulative quality score (sum of all auditor scores)
  attestationCount: bigint;   // unique auditor count (after revocations)
}
```

### `attest(opts)`

Submit an anonymous attestation. Returns `{ txHash: string }`.

```typescript
interface AttestOptions {
  skillHash: string | Fr;   // SHA256 of skill file content
  quality: number;          // 0-100
  claimType?: ClaimType;    // default: ClaimType.CODE_REVIEW
}
```

Throws if the caller has already attested this skill (double-attestation is prevented at the contract level).

### `revokeAttestation(skillHash)`

Revoke a prior attestation. Decrements the public trust score. Returns `{ txHash: string }`.

### `storeCredential(opts)`

Store a credential as a private note. Returns `{ txHash: string }`.

```typescript
interface StoreCredentialOptions {
  keyId: string;   // identifier (up to 31 ASCII chars, hashed to a Field)
  value: string;   // the secret (up to 128 bytes)
  label: string;   // display name (up to 31 ASCII chars)
}
```

### `getCredential(keyId)`

Retrieve a credential from your PXE note cache. No on-chain transaction. Returns `CredentialResult | null`.

### `deleteCredential(keyId)`

Permanently nullify a credential note. Returns `{ txHash: string }`.

### `rotateCredential(opts)`

Atomic replace of a credential note (delete + create in one tx). Returns `{ txHash: string }`.

```typescript
interface RotateCredentialOptions {
  keyId: string;      // existing credential to replace
  newValue: string;   // new secret (up to 128 bytes)
  newLabel: string;   // new display name (up to 31 ASCII chars)
}
```

### `grantCredentialAccess(opts)`

Create an AuthWit granting a skill contract read access to one credential. Returns `{ authwitNonce: bigint }`.

```typescript
interface GrantAccessOptions {
  keyId: string;               // credential to share
  skillAddress: AztecAddress;  // skill that receives access
  nonce?: bigint;              // optional — defaults to Date.now()
}
```

### `getCredentialForSkill(opts)`

Read a credential using an owner-issued AuthWit. Returns `CredentialResult | null`.

```typescript
interface DelegatedCredentialOptions {
  owner: AztecAddress;    // credential owner
  keyId: string;          // credential to read
  authwitNonce?: bigint;  // must match owner's AuthWit. Pass 0n if owner calls directly.
}
```

---

## Proof Times

Private functions (`attest`, `storeCredential`, `deleteCredential`, `rotateCredential`, `revokeAttestation`, `grantCredentialAccess`, `getCredentialForSkill`) require generating a ZK proof in your PXE before the transaction is submitted.

**Typical proof times on a 4-core laptop:** 15-45 seconds.
**On a server with 16+ cores:** 5-15 seconds.

`getTrustScore` and `getCredential` do not generate proofs — they read from the PXE cache or public state, and return instantly.

Design your agent's UX accordingly: show progress indicators, don't retry on timeout without checking whether the transaction was submitted.

---

## Repository Structure

```
contracts/isnad_registry/   Noir smart contract (Aztec v4 devnet)
sdk/                        @nullius/isnad — TypeScript SDK
frontend/                   Next.js trust browser + auditor dashboard + credential vault
```

## Running Tests

```bash
cd sdk
npm ci
npm test                      # 146 unit tests — no sandbox required
npm run test:integration      # integration tests — requires aztec start --local-network
```

## Deploying the Contract

The `IsnadRegistry` contract is written in [Noir](https://noir-lang.org) targeting Aztec v4 devnet.

```bash
# Install Aztec toolchain
bash -i <(curl -s https://install.aztec.network)

# Start local network
aztec start --local-network

# Compile
cd contracts/isnad_registry
aztec compile

# Generate TypeScript bindings
aztec codegen target --outdir ../../sdk/src/artifacts --force
```

Deployment is handled via the TypeScript SDK:

```typescript
import { IsnadRegistryContract } from '@nullius/isnad';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';

const feeMethod = new SponsoredFeePaymentMethod(sponsoredFPCAddress);

const contract = await IsnadRegistryContract.deploy(wallet)
  .send({ fee: { paymentMethod: feeMethod } })
  .deployed();

console.log(`IsnadRegistry deployed at: ${contract.address}`);
```

## Devnet Deployment

| Field | Value |
|---|---|
| Network | Aztec devnet (`v4.0.0-devnet.2-patch.0`) |
| Contract address | `0x05d66323796566fe663f938f82df1dee62ac052693c666e858a132317004ddea` |
| Frontend | [zac-williamson.github.io/aztec-agentic-privacy](https://zac-williamson.github.io/aztec-agentic-privacy/) |

## Contract Interface

| Function | Visibility | Description |
|---|---|---|
| `attest(skill_hash, quality, claim_type)` | private | Submit anonymous attestation; increments public trust score |
| `revoke_attestation(skill_hash)` | private | Nullify prior attestation; decrements trust score |
| `get_trust_score(skill_hash)` | public view | Read aggregate trust score (no auth required) |
| `get_attestation_count(skill_hash)` | public view | Read attestor count (no auth required) |
| `store_credential(key_id, value, label)` | private | Store secret as encrypted note |
| `get_credential(owner, key_id)` | utility | Read owned credential from PXE cache |
| `get_credential_for_skill(owner, key_id, nonce)` | private | Delegated read via AuthWit |
| `delete_credential(key_id)` | private | Nullify credential note |
| `rotate_credential(key_id, new_value, label)` | private | Atomic replace of credential note |

## Status

| Layer | Status |
|---|---|
| Noir contract | Compiled — 39/39 unit tests pass against live TXE |
| TypeScript SDK | 146/146 tests pass — real contract bindings active |
| Frontend | Live at [zac-williamson.github.io/aztec-agentic-privacy](https://zac-williamson.github.io/aztec-agentic-privacy/) |
| CI/CD | GitHub Actions — tests + deploy on every push to `main` |
| Live network | Aztec devnet (`v4.0.0-devnet.2-patch.0`) |

## License

MIT
