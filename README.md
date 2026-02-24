# The Isnad Chain

[![Tests](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/test.yml/badge.svg)](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/test.yml)
[![Deploy](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/deploy.yml/badge.svg)](https://github.com/zac-williamson/aztec-agentic-privacy/actions/workflows/deploy.yml)

**ZK Skill Attestation and Credential Registry for AI agents — built on Aztec.**

Private attestations. Public trust scores. Unforgeable proofs. Owned by no one.

---

## The Problem

AI agent skill ecosystems have no trust layer. Skills are installed without verification, credentials are stored in plaintext `.env` files, and auditors who vouch for code expose themselves to retaliation. The result: malicious skills that steal API keys, and a community screaming for "isnad chains" — cryptographically verifiable provenance — with no infrastructure to provide them.

## The Solution

The Isnad Chain is an [Aztec](https://aztec.network) smart contract system that provides:

1. **Anonymous attestations** — auditors submit ZK proofs that a skill is safe without revealing their identity. The skill's public trust score increments; the auditor stays private.
2. **Content-addressed trust** — skills are identified by `SHA256(file_content)`. If the file changes, the hash changes and prior attestations no longer apply. Malicious updates are cryptographically detectable.
3. **Private credential vault** — API keys and secrets stored as encrypted notes in the agent's PXE. Only the owner can read them. Scoped delegation via AuthWit lets a specific skill access one key without touching any other.

## Repository Structure

```
contracts/isnad_registry/   Noir smart contract (Aztec v4 devnet)
sdk/                        @nullius/isnad — TypeScript SDK
frontend/                   Next.js trust browser + auditor dashboard + credential vault
scripts/                    Artifact generation tooling
```

## TypeScript SDK

```bash
npm install @nullius/isnad
```

### Check a skill's trust score (no wallet required)

```typescript
import { IsnadClient } from '@nullius/isnad';

const isnad = new IsnadClient({ pxeUrl: 'http://localhost:8080' });

const score = await isnad.getTrustScore('0x7f3a4c9b...');
const count = await isnad.getAttestationCount('0x7f3a4c9b...');

console.log(`Trust score: ${score} from ${count} auditors`);
```

### Submit an attestation (wallet required)

```typescript
import { IsnadClient, ClaimType } from '@nullius/isnad';

const isnad = new IsnadClient({ pxeUrl: 'http://localhost:8080', wallet });

await isnad.attest({
  skillHash: '0x7f3a4c9b...',
  quality: 92,
  claimType: ClaimType.SANDBOXED_EXECUTION,  // 0=code_review, 1=behavioral, 2=sandboxed_execution
});

// Auditor identity: never appears on-chain.
```

### Store a credential privately

```typescript
await isnad.storeCredential({
  keyId: 'openai-key',
  value: 'sk-...',
  label: 'OpenAI API Key',
});

// Stored as an encrypted note in the agent's PXE.
// Zero network requests needed to read it back.
const value = await isnad.getCredential('openai-key');
```

### Delegate scoped access

```typescript
// Grant skill at skillAddress read access to exactly one credential.
await isnad.grantCredentialAccess('github-token', skillAddress);

// The skill can call get_credential_for_skill('github-token').
// It cannot read any other key in the vault.
```

## Computing a Skill Hash

```typescript
import { createHash } from 'crypto';

function computeSkillHash(skillContent: Buffer | string): bigint {
  const bytes = typeof skillContent === 'string'
    ? Buffer.from(skillContent, 'utf8')
    : skillContent;
  const sha256 = createHash('sha256').update(bytes).digest();
  sha256[0] = 0; // ensure value fits in a Field (<254 bits)
  return BigInt('0x' + sha256.toString('hex'));
}
```

## Running Tests

```bash
cd sdk
npm ci
npm test          # 126 unit tests (no sandbox required)
npm run test:integration  # requires aztec start --local-network
```

## Contract

The `IsnadRegistry` contract is written in [Noir](https://noir-lang.org) targeting Aztec v4 devnet (`v4.0.0-devnet.2-patch.0`). Compile with:

```bash
# Install Aztec toolchain
bash -i <(curl -s https://install.aztec.network)

# Compile
cd contracts/isnad_registry
nargo compile
```

### Key functions

| Function | Type | Description |
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

### claim_type encoding

| Value | Constant | Meaning |
|---|---|---|
| `0` | `code_review` | Static analysis (YARA rules, dependency scanning, manual review) |
| `1` | `behavioral` | Runtime monitoring (syscall tracing, tool-call auditing, network inspection) |
| `2` | `sandboxed_execution` | Isolated execution with output verification |

The `claim_type` is stored privately in the auditor's `AttestationNote` — it never appears in public state.

## Status

| Layer | Status |
|---|---|
| Noir contract | Compiled — `nargo` v1.0.0-beta.18, Aztec v4 devnet |
| TypeScript SDK | Type-correct — 126/126 tests pass |
| Frontend MVP | Built — Trust Browser + Auditor Dashboard + Credential Vault |
| GitHub Pages | Pending operator enabling via repo Settings → Pages |
| CI workflow | Pending PAT with `workflow` scope to push `.github/workflows/` |
| Live sandbox | Requires `aztec start --local-network` (Docker) |

## License

MIT
