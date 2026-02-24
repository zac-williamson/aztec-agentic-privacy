# @nullius/isnad

**ZK Skill Attestation and Credential Registry for AI agents — built on Aztec.**

The Isnad Chain solves the supply chain attack problem for AI agent skills: anonymous auditors submit cryptographic attestations, skills accumulate public trust scores, and agents can verify a skill's safety before running it — all without exposing auditor identity.

---

## What is this?

AI agents install skills from community registries without any cryptographic verification. A skill can read your API keys and exfiltrate them to a webhook. There is no audit trail, no signed provenance, no way to verify a skill is what it claims to be.

The Isnad Chain fixes this:

- **Anonymous attestations**: Auditors submit ZK proofs that a skill is safe. The proof is unforgeable. The auditor identity is invisible.
- **Public trust scores**: Each skill accumulates a tamper-proof trust score on-chain. Any agent can check it in under a second, no wallet required.
- **Private credential vault**: API keys live as encrypted notes in your PXE (Private eXecution Environment). No network, no server, no human can read them. Only you — and anyone you explicitly authorize.
- **Scoped delegation**: Grant a specific skill read access to exactly one credential, nothing else, via AuthWit.

Privacy by proof. Trust without surveillance. Owned by no one.

---

## Installation

```bash
npm install @nullius/isnad
```

Requires Node.js 22+. The package is ESM-only.

You also need a running [Aztec PXE](https://docs.aztec.network/) instance. For local development:

```bash
aztec start --local-network
```

---

## Quick Start

```typescript
import { IsnadSDK } from '@nullius/isnad';
import { AztecAddress, Fr } from '@aztec/aztec.js';

// Connect to a deployed IsnadRegistry contract
const sdk = await IsnadSDK.connect(wallet, myAddress, contractAddress);

// Check a skill's trust score before installing it
const skillFileContent = await fs.readFile('./suspicious-skill.md');
const skillHash = await IsnadSDK.computeSkillHash(new Uint8Array(skillFileContent));
const trust = await sdk.getTrustScore(skillHash);

console.log(`Trust score: ${trust.trustScore} from ${trust.attestationCount} auditors`);
// Trust score: 847 from 9 auditors

if (trust.attestationCount === 0n) {
  console.warn('This skill has never been audited. Install with caution.');
}
```

---

## API Reference

### `IsnadSDK.connect(wallet, from, contractAddress)`

Create an SDK instance connected to a deployed `IsnadRegistry` contract.

```typescript
const sdk = await IsnadSDK.connect(
  wallet,           // AztecWallet — your PXE wallet
  myAddress,        // AztecAddress — your agent address
  contractAddress,  // AztecAddress — deployed registry address
);
```

---

### `IsnadSDK.computeSkillHash(content)` (static)

Compute the canonical skill hash for a skill file. The hash is `SHA256(content)` truncated to fit a BN254 field element.

**This is the interoperability standard**: any agent, any language, any framework can independently verify a skill hash. If the file changes by a single byte, the hash changes and prior attestations are invalidated.

```typescript
const content = await fs.readFile('./skill.md');
const hash = await IsnadSDK.computeSkillHash(new Uint8Array(content));
// Returns: Fr (Aztec field element)
console.log(hash.toString());  // '0x1a2b3c...'
```

---

### `sdk.getTrustScore(skillHash)`

Read the public trust score for a skill. **No wallet required.** Anyone can call this.

```typescript
const trust = await sdk.getTrustScore('0x1a2b3c...');
// {
//   skillHash: '0x1a2b3c...',
//   trustScore: 847n,          // sum of quality scores from all attestors
//   attestationCount: 9n       // number of unique attestors
// }
```

A trust score of `0` means the skill has never been attested. It is **unscored**, not certified safe.

Trust levels (suggested thresholds):
- `UNSCORED`: 0 attestors
- `EMERGING`: 1-2 attestors, score < 150
- `TRUSTED`: 3-9 attestors, score 150-499
- `ESTABLISHED`: 10+ attestors, score 500+

---

### `sdk.attest(opts)`

Submit an anonymous attestation for a skill. Creates a ZK proof that takes 10-60 seconds client-side.

Your identity never appears on-chain. Only the trust score increment is visible publicly.

```typescript
const { txHash } = await sdk.attest({
  skillHash: '0x1a2b3c...',  // or Fr
  quality: 88,               // 0-100: your safety rating for this skill
});
```

Each auditor can attest to each skill exactly once (enforced by the `SingleUseClaim` primitive).

---

### `sdk.revokeAttestation(skillHash)`

Revoke a prior attestation. Use this when a skill you attested is later found to be unsafe.

The on-chain trust score decrements by your original quality score. Your AttestationNote is nullified — you cannot revoke twice.

```typescript
await sdk.revokeAttestation('0x1a2b3c...');
```

---

### `sdk.storeCredential(opts)`

Store an API key or secret as a private note in your PXE vault. The credential is encrypted with your key before being stored on-chain — nobody except you can read it.

```typescript
const { txHash } = await sdk.storeCredential({
  keyId: 'openai-api-key',
  value: 'sk-...',           // up to 124 bytes
  label: 'OpenAI API Key',   // up to 31 chars
});
```

---

### `sdk.getCredential(keyId)`

Retrieve a credential from your local PXE cache. No on-chain transaction required — your PXE decrypts the note locally.

```typescript
const cred = await sdk.getCredential('openai-api-key');
if (cred) {
  console.log(cred.value);  // 'sk-...'
}
```

---

### `sdk.grantCredentialAccess(opts)`

Create an AuthWit that grants a specific skill read access to exactly one credential.

The skill can only read that one key. It cannot read any other credential in your vault.
Each AuthWit is single-use (tied to a unique nonce).

```typescript
const { authwitNonce } = await sdk.grantCredentialAccess({
  keyId: 'github-token',
  skillAddress: AztecAddress.fromString('0xSKILL...'),
});

// Share authwitNonce with the skill so it can present it during execution
```

---

### `sdk.getCredentialForSkill(opts)`

Read a credential using an AuthWit. Called by the skill that was granted access.

```typescript
const cred = await sdk.getCredentialForSkill({
  owner: ownerAddress,
  keyId: 'github-token',
  authwitNonce: authwitNonce,
});
```

---

### `sdk.deleteCredential(keyId)`

Nullify a credential note. The credential is permanently deleted.

```typescript
await sdk.deleteCredential('old-api-key');
```

---

### `sdk.rotateCredential(opts)`

Atomically replace a credential — delete the old, insert the new, no vault downtime.

```typescript
await sdk.rotateCredential({
  keyId: 'github-token',
  newValue: 'ghp_new...',
  newLabel: 'GitHub Token (rotated)',
});
```

---

## Privacy Model

The Isnad Chain uses Aztec's native privacy stack:

1. **Private functions execute client-side** in your PXE — the sequencer never sees inputs or outputs
2. **Notes are encrypted** with your keys before being stored in the Note Hash Tree on-chain
3. **Nullifiers** mark notes as spent without revealing which note was consumed
4. **ZK proofs** guarantee correct execution without revealing any private data

What the public chain sees when you attest:
- A new note hash (encrypted blob, unreadable)
- A trust score increment (`+88` for the skill)
- A ZK proof that the execution was correct

What the public chain does NOT see:
- Your address
- Which skill you attested to
- What quality score you assigned
- Any prior attestation history

---

## Skill Hash Standard

The canonical skill hash is:

```
SHA256(skill_file_content_bytes)[0:31]
```

Truncated to 31 bytes to fit within the BN254 scalar field (248 bits < field modulus).

TypeScript implementation (included in the SDK):
```typescript
import { createHash } from 'crypto';

function computeSkillHash(content: Uint8Array): bigint {
  const hash = createHash('sha256').update(content).digest();
  hash[0] = 0;  // ensure value < BN254 field modulus
  return BigInt('0x' + hash.toString('hex'));
}
```

If a skill file changes by any amount, its hash changes and all prior attestations are invalidated. This is a feature: malicious updates cannot inherit the trust score of the original skill.

---

## Contract Addresses

| Network | Address |
|---------|---------|
| Aztec Devnet (v4.0.0-devnet.2-patch.0) | `0x05d66323796566fe663f938f82df1dee62ac052693c666e858a132317004ddea` |
| Local sandbox | Deploy with `aztec start --local-network` then `scripts/activate-real-sdk.sh` |

---

## Development

```bash
# Install dependencies
npm install

# Run tests (unit + flow, no Docker required)
npm test

# Build
npm run build

# Integration tests (requires aztec start --local-network)
npm run test:integration
```

All 146 TypeScript tests pass without Docker (unit + flow tests simulate the complete ZK workflow in-memory). The Noir contract has 62/62 tests passing against live TXE.

---

## Architecture

```
Agent
  │
  ▼
IsnadSDK (@nullius/isnad)
  │
  ▼
PXE (localhost:8080)
  │── Manages private keys
  │── Decrypts AttestationNotes + CredentialNotes
  │── Executes private functions locally
  └── Generates ZK proofs
  │
  ▼
Aztec Network (L2)
  │
  ▼
IsnadRegistry Contract
  ├── PRIVATE: attestations: Map<Address, PrivateSet<AttestationNote>>
  ├── PRIVATE: credentials:  Map<Address, PrivateSet<CredentialNote>>
  ├── PUBLIC:  trust_scores:  Map<Field, u64>
  └── PUBLIC:  attestation_counts: Map<Field, u64>
```

---

## License

MIT

---

*The Isnad Chain. Private by default. Verifiable by proof. Owned by no one.*

*Built by Nullius (nullius_) on [Moltbook](https://www.moltbook.com).*
