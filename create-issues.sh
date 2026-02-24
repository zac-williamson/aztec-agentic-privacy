#!/bin/bash
# GitHub Issues Creation Script for Isnad Chain
# Run this after refreshing the GitHub PAT in /home/ec2-user/.config/gh/hosts.yml
# and confirming with: gh auth status
#
# Covers: smart contracts, SDK, frontend, integration, deployment, CI/CD
# Labels used: priority:p0, priority:p1, priority:p2, priority:p3
#              type:contract, type:sdk, type:frontend, type:integration,
#              type:deployment, type:ci-cd, type:testing, type:milestone

REPO="zac-williamson/aztec-agentic-privacy"

echo "Creating labels..."
gh label create "priority:p0" --color "#b60205" --description "Critical path blocker" --repo $REPO 2>/dev/null || true
gh label create "priority:p1" --color "#e11d48" --description "High priority - MVP required" --repo $REPO 2>/dev/null || true
gh label create "priority:p2" --color "#f97316" --description "Medium priority - community demo" --repo $REPO 2>/dev/null || true
gh label create "priority:p3" --color "#84cc16" --description "Lower priority - future sprint" --repo $REPO 2>/dev/null || true
gh label create "type:contract" --color "#7c3aed" --description "Noir smart contract work" --repo $REPO 2>/dev/null || true
gh label create "type:sdk" --color "#2563eb" --description "TypeScript SDK work" --repo $REPO 2>/dev/null || true
gh label create "type:frontend" --color "#0891b2" --description "Next.js frontend work" --repo $REPO 2>/dev/null || true
gh label create "type:integration" --color "#059669" --description "Integration between components" --repo $REPO 2>/dev/null || true
gh label create "type:deployment" --color "#d97706" --description "Deployment and infrastructure" --repo $REPO 2>/dev/null || true
gh label create "type:ci-cd" --color "#6b7280" --description "CI/CD pipeline" --repo $REPO 2>/dev/null || true
gh label create "type:testing" --color "#0d9488" --description "Test coverage" --repo $REPO 2>/dev/null || true
gh label create "type:milestone" --color "#8b5cf6" --description "Sprint milestone or design doc" --repo $REPO 2>/dev/null || true

echo "Labels created. Creating issues..."

# ─── P0: CRITICAL PATH ───────────────────────────────────────────────────────

gh issue create --repo $REPO \
  --title "[SDK] Activate real contract bindings after aztec compile" \
  --label "priority:p0,type:sdk" \
  --body "## Summary
Currently blocked on Docker/GLIBC mismatch that prevents \`aztec compile\` and \`aztec codegen\` from running. The \`RealSdkWrapper\` and \`activate-real-sdk.sh\` script are ready (Sprint 6 COMPLETE). This issue tracks the activation step once the toolchain blocker is resolved by the operator.

## Prerequisites
- [ ] Operator resolves Docker/GLIBC issue or provides an alternate transpilation path
- [ ] \`aztec compile\` runs successfully in \`contracts/isnad_registry/\`
- [ ] \`aztec codegen target --outdir sdk/src/artifacts\` runs successfully

## Steps
1. Run \`./activate-real-sdk.sh\` (or follow steps inside it manually)
2. Uncomment contract calls in \`sdk/src/isnad.ts\` (marked with TODO comments)
3. Run \`npm run build\` in \`sdk/\` — confirm zero TypeScript errors
4. Run \`npm test\` in \`sdk/\` — confirm all 146 tests pass
5. Verify the real artifact exports: \`IsnadRegistryContract\`, \`IsnadRegistryArtifact\`

## Acceptance Criteria
- \`sdk/src/artifacts/IsnadRegistry.ts\` exists and exports the contract class
- \`npm test\` in \`sdk/\` passes 146+ tests against the real contract interface
- \`npm run build\` in \`sdk/\` emits zero TypeScript errors

## Context
- Contract artifact (nargo-compiled): \`contracts/isnad_registry/target/isnad_registry-IsnadRegistry.json\` (1.68 MB)
- Mock SDK path: \`sdk/src/mock-sdk.ts\` — remains as fallback
- Real SDK wrapper: \`sdk/src/real-sdk.ts\` (Sprint 6)
- Activation script: \`activate-real-sdk.sh\`" \
  2>&1; echo "Issue 1 done"

gh issue create --repo $REPO \
  --title "[Deployment] Start Aztec local network and deploy IsnadRegistry" \
  --label "priority:p0,type:deployment" \
  --body "## Summary
The IsnadRegistry contract compiles successfully with \`nargo\` (1.68 MB artifact). This issue covers starting the Aztec local sandbox and deploying the contract so that integration tests can run.

## Prerequisites
- [ ] \`aztec start --local-network\` works (requires Docker or the sandbox binary)
- [ ] GitHub issue #[SDK-activation] is complete (real TypeScript bindings exist)

## Steps
1. Start local Aztec network: \`aztec start --local-network\`
2. Confirm sandbox running at \`http://localhost:8080\`
3. Run the deployment script: \`cd sdk && npm run deploy:local\`
4. Copy deployed contract address to \`.env.local\`:
   \`\`\`
   AZTEC_PXE_URL=http://localhost:8080
   ISNAD_REGISTRY_ADDRESS=0x...
   \`\`\`
5. Confirm \`getTrustScore\` returns 0 for a fresh skill hash

## Acceptance Criteria
- IsnadRegistry contract deployed at a known address on the local network
- \`get_trust_score\` view function callable with zero authentication
- Contract address recorded in project README and \`.env.local\`

## Notes
- Use SponsoredFeePaymentMethod for gas-free deployment on local/devnet
- Deployment script template lives in \`sdk/src/deploy.ts\` (create if not exists)" \
  2>&1; echo "Issue 2 done"

# ─── P1: MVP REQUIRED ────────────────────────────────────────────────────────

gh issue create --repo $REPO \
  --title "[Contract] Write unit tests for attest() and SingleUseClaim anti-double-attestation" \
  --label "priority:p1,type:contract,type:testing" \
  --body "## Summary
The contract compiles and the \`attest()\` function logic is implemented. We need Noir unit tests to verify the anti-double-attestation invariant (SingleUseClaim) and that the public trust score increments correctly.

## Test Cases to Write
- [ ] **Happy path**: attest with valid skill_hash, quality, claim_type → trust score increments
- [ ] **Double-attestation**: same auditor attests same skill twice → second call reverts
- [ ] **Different skill**: same auditor attests two different skills → both succeed
- [ ] **Different auditor**: two different auditors attest same skill → both succeed, count = 2
- [ ] **Quality boundary**: quality = 0 → succeeds; quality > 100 → reverts (if assertion added)
- [ ] **claim_type boundary**: claim_type = 2 → succeeds; claim_type = 3 → reverts (if assertion added)
- [ ] **trust_scores storage**: after 3 attestations with quality 80, score = 240

## Implementation Notes
- Test file: \`contracts/isnad_registry/src/test/test_attest.nr\` (create directory if needed)
- Use \`#[test]\` attribute for unit tests in Noir
- These run via \`nargo test\` (no sandbox needed)
- For integration tests (requiring sandbox/PXE), use the TypeScript Vitest suite in \`sdk/tests/\`

## Acceptance Criteria
- \`nargo test\` passes all new tests
- Zero false passes (tests actually check behavior, not just compile)" \
  2>&1; echo "Issue 3 done"

gh issue create --repo $REPO \
  --title "[Contract] Write unit tests for revoke_attestation() nullifier emission" \
  --label "priority:p1,type:contract,type:testing" \
  --body "## Summary
The \`revoke_attestation()\` function is implemented (Sprint 3). Tests needed to verify: the AttestationNote is nullified, the trust score decrements correctly, and double-revocation is prevented.

## Test Cases to Write
- [ ] **Happy path**: attest → revoke → trust score decrements to 0
- [ ] **Score floor**: trust score cannot go below 0 (underflow protection)
- [ ] **Double-revocation**: attempt to revoke same attestation twice → second call reverts
- [ ] **Cross-auditor revoke**: auditor A cannot revoke auditor B's attestation
- [ ] **Revoke then re-attest**: after revocation, auditor can attest again (SingleUseClaim is consumed by revoke? or not — verify spec)

## Notes
- The current SingleUseClaim is consumed at attest time. Revocation may re-enable attestation or not — this is a design question that tests will clarify.
- If re-attestation after revocation should be allowed, a separate claim_key scheme may be needed (e.g., including a revocation nonce).
- Document the decision in SPEC.md after implementing.

## Acceptance Criteria
- All edge cases tested
- Score cannot underflow to a wrapped-around large value
- Revocation atomicity verified: score decrement and note nullification happen in same tx" \
  2>&1; echo "Issue 4 done"

gh issue create --repo $REPO \
  --title "[Contract] Write unit tests for credential vault (store, get, delete, rotate)" \
  --label "priority:p1,type:contract,type:testing" \
  --body "## Summary
Sprint 3 implemented \`store_credential()\`, \`get_credential()\`, \`delete_credential()\`, \`rotate_credential()\`, and the AuthWit-delegated \`get_credential_for_skill()\`. These need unit and integration tests.

## Test Cases to Write
- [ ] **Store + retrieve**: store credential → get_credential returns correct value
- [ ] **Label filtering**: store two credentials with different key_ids → correct retrieval per key_id
- [ ] **Delete**: store → delete → get returns None
- [ ] **Rotate**: store → rotate → get returns new value, old value inaccessible
- [ ] **Isolation**: agent A's credential not readable by agent B
- [ ] **AuthWit delegation**: owner creates AuthWit for skillAddress → skill calls get_credential_for_skill → returns correct value
- [ ] **AuthWit scope enforcement**: skill calls get_credential_for_skill with wrong key_id → reverts
- [ ] **AuthWit single-use**: skill tries to reuse same AuthWit nonce → second call reverts
- [ ] **Self-call**: owner calls get_credential_for_skill with nonce=0 (self-call bypass) → succeeds

## Acceptance Criteria
- All test cases pass via \`nargo test\`
- No cross-agent reads possible (isolation property)
- AuthWit scoping verified cryptographically (not just by convention)" \
  2>&1; echo "Issue 5 done"

gh issue create --repo $REPO \
  --title "[Integration] E2E test: attest → trust score read flow" \
  --label "priority:p1,type:integration,type:testing" \
  --body "## Summary
End-to-end integration test using the real TypeScript SDK against the Aztec local sandbox. Tests the full attestation flow from a TypeScript client perspective.

## Prerequisites
- IsnadRegistry deployed on local sandbox (see deployment issue)
- SDK real bindings active

## Test Script (\`sdk/tests/e2e-attest.test.ts\`)
\`\`\`typescript
test('attest increments trust score', async () => {
  const skillHash = computeSkillHash(Buffer.from('test-skill-content'));

  // Initial score should be 0
  expect(await isnad.getTrustScore(skillHash)).toBe(0n);

  // Attest with quality 85
  await isnad.attest(skillHash, 85, ClaimType.CODE_REVIEW);

  // Score should now be 85
  expect(await isnad.getTrustScore(skillHash)).toBe(85n);
  expect(await isnad.getAttestationCount(skillHash)).toBe(1n);
});

test('double attest by same auditor reverts', async () => {
  const skillHash = computeSkillHash(Buffer.from('test-skill-2'));
  await isnad.attest(skillHash, 70, ClaimType.BEHAVIORAL);
  await expect(isnad.attest(skillHash, 70, ClaimType.BEHAVIORAL)).rejects.toThrow();
});

test('two auditors can attest same skill', async () => {
  const skillHash = computeSkillHash(Buffer.from('test-skill-3'));
  await isnad1.attest(skillHash, 80, ClaimType.CODE_REVIEW);
  await isnad2.attest(skillHash, 90, ClaimType.SANDBOXED);
  expect(await isnad1.getTrustScore(skillHash)).toBe(170n);
  expect(await isnad1.getAttestationCount(skillHash)).toBe(2n);
});
\`\`\`

## Acceptance Criteria
- All 3 test cases pass against live local sandbox
- Proof generation completes within 120 seconds
- No flaky failures on 3 consecutive runs" \
  2>&1; echo "Issue 6 done"

gh issue create --repo $REPO \
  --title "[Integration] E2E test: credential vault store, retrieve, and delegate flow" \
  --label "priority:p1,type:integration,type:testing" \
  --body "## Summary
End-to-end integration test for the credential vault against the Aztec local sandbox.

## Test Cases (\`sdk/tests/e2e-vault.test.ts\`)
- [ ] Store credential → retrieve → value matches
- [ ] Rotate credential → old value gone, new value retrievable
- [ ] Delete credential → get returns undefined/None
- [ ] AuthWit delegation → skill reads correct credential only
- [ ] AuthWit scope → skill cannot read a different key_id

## Acceptance Criteria
- All test cases pass against live local sandbox
- AuthWit single-use enforcement confirmed (replay attempt fails)
- Credential isolation between agents confirmed (agent B cannot read agent A's vault)" \
  2>&1; echo "Issue 7 done"

gh issue create --repo $REPO \
  --title "[Frontend] Connect Trust Browser to real IsnadRegistry contract" \
  --label "priority:p1,type:frontend,type:integration" \
  --body "## Summary
The frontend Trust Browser currently uses the mock SDK (\`NEXT_PUBLIC_USE_MOCK=true\`). This issue switches it to the real SDK once the contract is deployed.

## Changes Required
1. Set \`NEXT_PUBLIC_USE_MOCK=false\` in \`.env.production\`
2. Set \`NEXT_PUBLIC_PXE_URL=https://...\` (devnet or local)
3. Set \`NEXT_PUBLIC_CONTRACT_ADDRESS=0x...\` (deployed IsnadRegistry address)
4. Remove mock data seeding from Trust Browser page
5. Ensure file drag-drop correctly computes SHA256 skill hash and queries live contract
6. Handle the case where the contract has no attestations yet (score = 0, count = 0)

## Files to Modify
- \`frontend/.env.production\` (create/update)
- \`frontend/app/page.tsx\` — remove mock hooks, use real IsnadContext
- \`frontend/lib/isnad-context.tsx\` — confirm real SDK is loaded when env var is false

## Acceptance Criteria
- Trust Browser renders real trust scores from the deployed contract
- File upload computes correct SHA256 and queries the contract
- 'UNSCORED' badge shown correctly for new skills with 0 attestations
- No mock data appears in production build" \
  2>&1; echo "Issue 8 done"

gh issue create --repo $REPO \
  --title "[Frontend] Connect Auditor Dashboard to real SDK" \
  --label "priority:p1,type:frontend,type:integration" \
  --body "## Summary
Switch the Auditor Dashboard from mock to real SDK. Requires wallet connection via PXE and real ZK proof generation for attestations.

## Changes Required
1. Implement wallet connection via \`@aztec/aztec.js\` (connect to PXE at configured URL)
2. Wire \`[Attest]\` button to \`isnad.attest(skillHash, quality, claimType)\`
3. Show real proof generation progress (the \`ProofProgress\` component already exists)
4. Wire \`[Revoke]\` button to \`isnad.revokeAttestation(skillHash)\`
5. Load attestation history from the user's PXE (private notes)
6. Handle proof generation timeout gracefully (120s max)

## UX Notes
- Proof generation takes 15-60 seconds — the ProofProgress component handles this
- On success, refresh the attestation history panel
- On failure, show clear error with reason (e.g., 'Already attested this skill')

## Acceptance Criteria
- Wallet connects to PXE
- Attest button generates real ZK proof and submits tx
- History panel reflects real private notes from PXE
- Revoke button nullifies note and decrements public score" \
  2>&1; echo "Issue 9 done"

gh issue create --repo $REPO \
  --title "[Frontend] Connect Credential Vault to real SDK" \
  --label "priority:p1,type:frontend,type:integration" \
  --body "## Summary
Switch the Credential Vault from mock to real SDK. All operations (store, retrieve, delete, rotate, grant) generate real ZK proofs.

## Changes Required
1. Wire 'Add Credential' form to \`isnad.storeCredential(keyId, value, label)\`
2. Wire 'Copy' button to \`isnad.getCredential(keyId)\` (utility call — no proof, instant)
3. Wire 'Delete' to \`isnad.deleteCredential(keyId)\` (generates proof)
4. Wire 'Rotate' to \`isnad.rotateCredential(keyId, newValue, label)\` (generates proof)
5. Wire 'Grant Access' to \`isnad.grantCredentialAccess(keyId, skillAddress)\`
6. Display delegated access list from PXE AuthWit state

## UX Notes
- Read operations (get_credential utility fn) are instant — no proof generation wait
- Write operations (store, delete, rotate) require proof (~15-60s)
- Show ProofProgress component for write operations only

## Acceptance Criteria
- Credentials persist across page refreshes (stored in PXE, re-discovered on load)
- Delete physically removes note (nullifier emitted — cannot retrieve after delete)
- AuthWit grants expire after single use (verify this is correct per our contract)
- Byte counter shows correct size for [Field; 4] = 128 bytes max" \
  2>&1; echo "Issue 10 done"

# ─── P1: CI/CD ───────────────────────────────────────────────────────────────

gh issue create --repo $REPO \
  --title "[CI/CD] GitHub Actions: nargo compile check on PRs" \
  --label "priority:p1,type:ci-cd" \
  --body "## Summary
Add a GitHub Actions workflow that compiles the IsnadRegistry contract on every PR to \`main\`. Catches regressions in the Noir contract before they land.

## Workflow: \`.github/workflows/contract-compile.yml\`
\`\`\`yaml
name: Contract Compile

on:
  push:
    branches: [main]
    paths: ['contracts/**']
  pull_request:
    paths: ['contracts/**']

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install nargo
        run: |
          curl -s https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
          noirup --version 1.0.0-beta.18
      - name: Compile IsnadRegistry
        run: |
          cd contracts/isnad_registry
          nargo compile
      - name: Verify artifact exists
        run: |
          test -f contracts/isnad_registry/target/isnad_registry-IsnadRegistry.json
          echo \"Artifact size: \$(du -sh contracts/isnad_registry/target/isnad_registry-IsnadRegistry.json)\"
\`\`\`

## Notes
- \`nargo\` v1.0.0-beta.18 is the currently installed version
- The workflow is currently blocked (PAT lacks 'workflow' scope — operator must re-issue PAT with workflow permissions)

## Acceptance Criteria
- Workflow runs on every PR touching \`contracts/\`
- Red on compilation failure, green on success
- Artifacts not cached (always recompiles from source)" \
  2>&1; echo "Issue 11 done"

gh issue create --repo $REPO \
  --title "[CI/CD] GitHub Actions: TypeScript build and test check on PRs" \
  --label "priority:p1,type:ci-cd" \
  --body "## Summary
Add a GitHub Actions workflow that runs the TypeScript SDK build and tests on every PR.

## Workflow: \`.github/workflows/sdk-test.yml\`
\`\`\`yaml
name: SDK Build & Test

on:
  push:
    branches: [main]
    paths: ['sdk/**']
  pull_request:
    paths: ['sdk/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: cd sdk && npm ci
      - name: Type check
        run: cd sdk && npx tsc --noEmit
      - name: Run tests
        run: cd sdk && npm test
      - name: Build
        run: cd sdk && npm run build
\`\`\`

## Workflow: \`.github/workflows/frontend-build.yml\`
\`\`\`yaml
name: Frontend Build

on:
  push:
    branches: [main]
    paths: ['frontend/**']
  pull_request:
    paths: ['frontend/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Type check
        run: cd frontend && npx tsc --noEmit
      - name: Build
        run: cd frontend && npm run build
        env:
          NEXT_PUBLIC_USE_MOCK: 'true'
\`\`\`

## Acceptance Criteria
- SDK tests pass in CI (currently 146 tests)
- Frontend builds with zero TypeScript errors in CI
- Workflow blocked: PAT needs 'workflow' scope (operator action required)" \
  2>&1; echo "Issue 12 done"

gh issue create --repo $REPO \
  --title "[CI/CD] Auto-deploy frontend to GitHub Pages on main push" \
  --label "priority:p1,type:ci-cd,type:deployment" \
  --body "## Summary
Automate deployment to GitHub Pages whenever \`main\` is updated. Currently the gh-pages branch must be pushed manually.

## Workflow: \`.github/workflows/deploy-pages.yml\`
\`\`\`yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths: ['frontend/**']

permissions:
  contents: write
  pages: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build
        env:
          NEXT_PUBLIC_USE_MOCK: 'true'
          # Update these env vars when contract is deployed:
          # NEXT_PUBLIC_PXE_URL: \${{ secrets.PXE_URL }}
          # NEXT_PUBLIC_CONTRACT_ADDRESS: \${{ secrets.CONTRACT_ADDRESS }}
      - name: Deploy to gh-pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/out
          # Note: Next.js static export requires 'output: export' in next.config.js
\`\`\`

## Prerequisites
- [ ] \`next.config.js\` must have \`output: 'export'\` for static export
- [ ] GitHub Pages enabled in repo settings (Deploy from gh-pages branch, root dir)
- [ ] PAT with 'workflow' scope (operator action required)

## Acceptance Criteria
- Push to \`main\` triggers automatic deploy
- GitHub Pages URL serves the latest frontend build
- Mock mode enabled by default (no contract address needed for basic browsing)" \
  2>&1; echo "Issue 13 done"

# ─── P2: COMMUNITY DEMO ──────────────────────────────────────────────────────

gh issue create --repo $REPO \
  --title "[Deployment] Deploy IsnadRegistry to Aztec devnet" \
  --label "priority:p2,type:deployment" \
  --body "## Summary
After successful local sandbox deployment and integration tests, deploy to the Aztec public devnet (\`v4.0.0-devnet.2-patch.0\`) for community access.

## Steps
1. Ensure \`AZTEC_PXE_URL\` points to devnet endpoint (check Aztec docs for current URL)
2. Use SponsoredFeePaymentMethod with the devnet SponsoredFPC contract address
3. Run deployment script: \`cd sdk && AZTEC_NETWORK=devnet npm run deploy\`
4. Record deployed contract address
5. Update \`frontend/.env.production\` with devnet address
6. Push frontend update to GitHub Pages

## Devnet Facts (as of Feb 2026)
- Network: \`v4.0.0-devnet.2-patch.0\`
- No real ETH needed (sponsored gas)
- May be reset between versions — plan for redeployment

## Acceptance Criteria
- Contract live on devnet at known address
- \`get_trust_score()\` callable from a browser via devnet PXE
- Address documented in README and SPEC.md

## Post-deploy
- Post Moltbook update with live demo link + contract address
- Invite genesis auditors (Shalom/kobold-scan, skillsecagent) to attest first skills" \
  2>&1; echo "Issue 14 done"

gh issue create --repo $REPO \
  --title "[Frontend] Skill hash computation from URL fetch" \
  --label "priority:p2,type:frontend" \
  --body "## Summary
The Trust Browser currently supports skill hash from manual input and file drag-drop. Add URL fetch support so users can paste a skill URL (e.g., a ClawdHub skill URL) and have the hash computed automatically.

## Implementation
\`\`\`typescript
async function computeHashFromUrl(url: string): Promise<bigint> {
  // Fetch via a proxy to avoid CORS issues
  const response = await fetch(\`/api/fetch-skill?url=\${encodeURIComponent(url)}\`);
  const content = await response.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const bytes = new Uint8Array(hashBuffer);
  bytes[0] = 0; // truncate to fit Aztec Field
  return BigInt('0x' + Buffer.from(bytes).toString('hex'));
}
\`\`\`

## Files to Create/Modify
- \`frontend/app/api/fetch-skill/route.ts\` — Next.js API route to proxy-fetch skill files
- \`frontend/app/page.tsx\` — Add URL input field + fetch button to Trust Browser

## Acceptance Criteria
- User pastes ClawdHub skill URL → hash computed → trust score displayed
- CORS handled via server-side proxy route
- Works with both skill.md files and generic URLs" \
  2>&1; echo "Issue 15 done"

gh issue create --repo $REPO \
  --title "[SDK] Publish @nullius/isnad to npm" \
  --label "priority:p2,type:sdk" \
  --body "## Summary
Publish the @nullius/isnad TypeScript SDK to npm so any agent can install it with \`npm install @nullius/isnad\`.

## Prerequisites
- [ ] Real SDK bindings activated (contract bindings issue resolved)
- [ ] All unit tests passing (146+)
- [ ] E2E integration tests passing against local sandbox

## Steps
1. Create npm account / org for @nullius scope
2. Update \`sdk/package.json\`:
   - Set \`\"name\": \"@nullius/isnad\"\`
   - Set \`\"version\": \"0.1.0\"\`
   - Add \`\"publishConfig\": { \"access\": \"public\" }\`
3. Build: \`npm run build\` in sdk/
4. Test pack: \`npm pack --dry-run\`
5. Publish: \`npm publish\`

## API Surface (public)
\`\`\`typescript
import { IsnadClient, ClaimType, computeSkillHash } from '@nullius/isnad';

const isnad = new IsnadClient({ pxeUrl, contractAddress, wallet });
await isnad.attest(skillHash, 85, ClaimType.CODE_REVIEW);
const score = await isnad.getTrustScore(skillHash);
\`\`\`

## Acceptance Criteria
- \`npm install @nullius/isnad\` works
- TypeScript types exported correctly
- README with usage examples in sdk/README.md
- Version 0.1.0 (pre-stable, API may change)" \
  2>&1; echo "Issue 16 done"

gh issue create --repo $REPO \
  --title "[Community] Moltbook: Post sprint 7 demo update with live devnet link" \
  --label "priority:p2,type:milestone" \
  --body "## Summary
Once the contract is live on devnet and the frontend is deployed to GitHub Pages, post a Moltbook update in m/Builds with the live demo link and instructions for genesis auditors.

## Post Content Outline
1. **What's live**: Trust Browser at [GitHub Pages URL] — paste any skill hash to check its score
2. **For auditors**: how to attest (connect PXE, visit /audit, submit proof)
3. **For credential vault users**: how to store API keys privately
4. **For skill builders**: use \`computeSkillHash()\` from \`@nullius/isnad\` to get your skill's canonical hash
5. **Call to action**: genesis auditors — attest your first 3 skills this week

## Genesis Auditors to Ping
- skillsecagent (k=562) — already engaged, SkillSec methodology maps to claim_type=code_review
- Shalom / kobold-scan (k=307) — YARA rules = claim_type=code_review
- OttoIlRobotto (k=339) — OpenClaw, expressed interest in working group

## Acceptance Criteria
- Post published in m/Builds
- GitHub Pages URL included
- Specific instructions for each user type (auditor, agent installing skills, skill builder)
- At least one genesis attestation recorded on devnet within 48 hours of post" \
  2>&1; echo "Issue 17 done"

# ─── P3: FUTURE SPRINTS ──────────────────────────────────────────────────────

gh issue create --repo $REPO \
  --title "[Milestone] Sprint 7 design: Trust Ledger v2 (auditor reputation layer)" \
  --label "priority:p3,type:milestone" \
  --body "## Summary
Design the Trust Ledger v2 — the auditor reputation layer that sits on top of the Isnad Chain. This enables gated attestations: only auditors with proven quality history can contribute to trust scores.

## Design Questions to Resolve
1. **Note structure**: \`ReputationNote { auditor, skill_hash, outcome, timestamp }\` — private to auditor
2. **Quality proof gate**: ZK proof that auditor has ≥ N attestations with < M% revocation rate
3. **Weight decay**: does attestation weight decay over time? (prevents resting on old reputation)
4. **Gating mechanism**: should gated attestation mode be opt-in per skill, or system-wide?
5. **Cold start**: how do genesis auditors bootstrap their Trust Ledger score?

## Architecture Sketch
\`\`\`
IsnadRegistry (v1)
  └── attest() creates AttestationNote (private)
  └── _increment_score() updates public trust_scores

TrustLedger (v2)
  └── Auditor's private history of past attestations + outcomes
  └── ZK proof: \"I have ≥ N valid attestations, < M% revocation rate\"
  └── Cross-contract: IsnadRegistry.attest() calls TrustLedger.prove_eligibility() before incrementing
\`\`\`

## Acceptance Criteria for this Issue
- [ ] Design doc written and added to SPEC.md ## Phase 4
- [ ] Open questions listed with proposed answers
- [ ] Contract interface sketched (not implemented)
- [ ] GitHub issues created for each implementation sprint

## Timeline
Deferred to Phase 4. Design should begin in parallel with Phase 3 community launch." \
  2>&1; echo "Issue 18 done"

gh issue create --repo $REPO \
  --title "[Milestone] Sprint 8 design: Silent Collective (anonymous multi-agent governance)" \
  --label "priority:p3,type:milestone" \
  --body "## Summary
Design the Silent Collective — anonymous multi-agent governance with private treasury. This is the third layer in the Isnad Chain stack, built on top of the Isnad Chain and Trust Ledger.

## Design Questions to Resolve
1. **Membership note**: how are members added without revealing membership list?
2. **Treasury ownership**: collective contract as its own account (native AA) — how to implement?
3. **Vote nullifier**: \`nullifier = hash(membership_note.secret, proposal_id)\` — verify with v4 API
4. **Disbursement authorization**: multi-sig within the contract, or external DAO call?
5. **Nested sub-collectives**: delegation structure

## Architecture Sketch
\`\`\`
SilentCollective
  └── issue_membership() — private, creates MembershipNote for recipient
  └── cast_vote() — private, emits nullifier (prevents double-vote), enqueues tally update
  └── submit_proposal() — public, any agent
  └── finalize_proposal() — public, checks deadline, executes if approved
  └── Treasury: PrivateSet<TreasuryNote> owned by contract address
\`\`\`

## Integration with Prior Layers
- Members must prove Trust Ledger eligibility before joining
- Skills funded by collective treasury must meet Isnad Chain trust threshold
- Collective governance can quarantine malicious skills (set quarantine_flag)

## Acceptance Criteria for this Issue
- [ ] Design doc written in SPEC.md ## Phase 5
- [ ] Treasury ownership design resolved (native AA for contract account)
- [ ] Vote nullifier construction verified against v4 API
- [ ] GitHub issues created for implementation sprints

## Timeline
Deferred to Phase 5, after Trust Ledger v2 is live." \
  2>&1; echo "Issue 19 done"

gh issue create --repo $REPO \
  --title "[Contract] Add quarantine_flags public storage for global skill banning" \
  --label "priority:p3,type:contract" \
  --body "## Summary
v1 only supports personal attestation revocation (individual auditor retracts). v2 needs a quarantine mechanism: a skill flagged as KNOWN MALICIOUS overrides all accumulated trust scores.

## Design (from SPEC.md § Revocation Semantics)
\`\`\`rust
// New public storage field
quarantine_flags: Map<Field, PublicMutable<bool, Context>, Context>,

// New public function (requires quorum authorization)
#[external(\"public\")]
fn quarantine_skill(skill_hash: Field) {
    // Must be called by a designated multi-sig or DAO contract
    self.storage.quarantine_flags.at(skill_hash).write(true);
}

// Modified get_trust_score to respect quarantine
#[external(\"public\")]
#[view]
fn get_trust_score(skill_hash: Field) -> u64 {
    if self.storage.quarantine_flags.at(skill_hash).read() {
        return 0; // Quarantine overrides all attestations
    }
    self.storage.trust_scores.at(skill_hash).read()
}
\`\`\`

## Authorization Design
- Who can call quarantine_skill()? Options:
  a) A designated admin address (simple, centralized)
  b) A quorum threshold (e.g., 3 of 5 trusted agents)
  c) The Silent Collective governance contract (fully decentralized)
- v2 recommendation: quorum threshold via MultiSig contract address stored in public storage

## Acceptance Criteria
- \`get_trust_score()\` returns 0 for quarantined skills
- Quarantine cannot be reversed without authorization
- Clear documentation of who has quarantine authority and how it's set at deploy time
- Nargo test: quarantine → get_trust_score returns 0 despite positive attestations" \
  2>&1; echo "Issue 20 done"

gh issue create --repo $REPO \
  --title "[Contract] IdentityNote v2: anchor MEMORY.md and SOUL.md hashes on-chain" \
  --label "priority:p3,type:contract" \
  --body "## Summary
ZhiduoResearcher identified a critical threat: MEMORY.md and SOUL.md are 'unsigned binaries' silently modifiable by any process with filesystem access. An agent running with a tampered MEMORY.md doesn't know it's been compromised. This issue designs and implements the IdentityNote vault for anchoring identity file hashes on-chain.

## Design Questions (from SPEC.md Open Questions #7)
1. **Private or public commitment?** Public: any agent can verify this agent's identity. Private: only the agent can prove it to specific counterparties. Recommendation: private note with optional public commitment hash.
2. **Revocation?** If identity files change (legitimate update), old IdentityNotes must be revokable. Design: nullify old IdentityNote, create new one with updated hash.
3. **What files?** v1: MEMORY.md + SOUL.md. v2: agent-defined list.

## Implementation Sketch
\`\`\`rust
#[derive(Eq, Packable)]
#[note]
pub struct IdentityNote {
    pub file_hash: Field,          // SHA256 of file content (first 31 bytes)
    pub file_label: Field,         // 'MEMORY.md' or 'SOUL.md' packed as Field
    pub timestamp: u64,            // block timestamp at commitment
    pub owner: AztecAddress,       // the agent
}

// Private: commit identity file hash
#[external(\"private\")]
fn commit_identity(file_hash: Field, file_label: Field) { ... }

// Private: prove to counterparty that identity is unmodified
// Returns IS_VALID if stored hash matches provided hash
#[external(\"private\")]
fn verify_identity(file_hash: Field, file_label: Field) -> Field { ... }
\`\`\`

## Acceptance Criteria
- [ ] IdentityNote type defined and compiles
- [ ] \`commit_identity()\` stores hash privately
- [ ] \`verify_identity()\` callable by counterparty via AuthWit
- [ ] Test: commit hash → verify with same hash → IS_VALID; verify with different hash → NOT_VALID
- [ ] SPEC.md updated with final IdentityNote v2 design" \
  2>&1; echo "Issue 21 done"

echo ""
echo "All issues created. Run 'gh issue list --repo $REPO' to verify."
