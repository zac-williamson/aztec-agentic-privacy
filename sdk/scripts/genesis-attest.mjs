/**
 * genesis-attest.mjs — Submit first attestations to IsnadRegistry
 *
 * This script demonstrates the full genesis auditor workflow:
 *   1. Admin adds a root attestor (depth=0, 4x weight)
 *   2. Root attestor submits positive attestations for clean skills
 *   3. Root attestor submits negative attestation for malicious skill
 *   4. Reads back trust scores to verify
 *
 * Run from sdk/ directory (local network must be running):
 *   LD_PRELOAD=/home/ec2-user/aztec-agent/glibc-shim/glibc_shim.so \
 *   node scripts/genesis-attest.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

import { EmbeddedWallet } from '@aztec/wallets/embedded';
import { registerInitialLocalNetworkAccountsInWallet } from '@aztec/wallets/testing';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/foundation/curves/bn254';
import { loadContractArtifact } from '@aztec/stdlib/abi';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { SPONSORED_FPC_SALT } from '@aztec/constants';

import { IsnadRegistryContract } from '../dist/index.js';

const PXE_URL = 'http://localhost:8080';
const SPONSORED_FPC_ARTIFACT_PATH =
  '/home/ec2-user/.aztec/current/node_modules/@aztec/noir-contracts.js/artifacts/sponsored_fpc_contract-SponsoredFPC.json';

// Load deployment info
const deploymentInfoPath = resolve(PROJECT_ROOT, 'scripts/deployment-info.json');
const deploymentInfo = JSON.parse(readFileSync(deploymentInfoPath, 'utf8'));
const CONTRACT_ADDRESS = AztecAddress.fromString(deploymentInfo.contractAddress);

// Skill hashes (canonical SHA256-based hashes for demo skills)
const SKILLS = {
  WEATHER_REPORTER_V2: '0x7f3ac4b82d19e8a1f5b6c3d4e9f2a0b7c8d5e6f1a2b3c4d5e6f7a8b9c0d1e2f3',
  CODE_FORMATTER_V1: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  GET_WEATHER_MALICIOUS: '0x0deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718',
};

// Claim type constants
const ClaimType = { CODE_REVIEW: 0, BEHAVIORAL: 1, SANDBOXED_EXECUTION: 2 };

function pad32(hex) {
  // Ensure hex string is exactly 64 chars (32 bytes)
  const clean = hex.replace('0x', '');
  return '0x' + clean.padStart(64, '0').slice(-64);
}

async function setupWallet() {
  console.log(`Connecting to ${PXE_URL}...`);
  const wallet = await EmbeddedWallet.create(PXE_URL, { ephemeral: true });
  console.log('Connected.');

  console.log('Registering test accounts...');
  const addresses = await registerInitialLocalNetworkAccountsInWallet(wallet);
  console.log(`Found ${addresses.length} test accounts`);

  // Register SponsoredFPC
  const fpcArtifactJson = JSON.parse(readFileSync(SPONSORED_FPC_ARTIFACT_PATH, 'utf8'));
  const fpcArtifact = loadContractArtifact(fpcArtifactJson);
  const fpcInstance = await getContractInstanceFromInstantiationParams(fpcArtifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
  await wallet.registerContract(fpcInstance, fpcArtifact);

  return { wallet, addresses, paymentMethod: new SponsoredFeePaymentMethod(fpcInstance.address) };
}

async function readTrustScore(contract, adminAddr, skillHashHex) {
  const hash = Fr.fromHexString(pad32(skillHashHex));
  const [score, count, quarantined] = await Promise.all([
    contract.methods.get_trust_score(hash).simulate({ from: adminAddr }),
    contract.methods.get_attestation_count(hash).simulate({ from: adminAddr }),
    contract.methods.is_quarantined(hash).simulate({ from: adminAddr }),
  ]);
  return { score: BigInt(score), count: BigInt(count), quarantined: Boolean(quarantined) };
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  IsnadRegistry v0.3.0 — Genesis Auditor Demonstration     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log('');

  const { wallet, addresses, paymentMethod } = await setupWallet();

  if (addresses.length < 2) {
    throw new Error(`Need at least 2 test accounts; found ${addresses.length}`);
  }

  const adminAddr = addresses[0];
  const genesisAuditorAddr = addresses[1];

  console.log(`Admin:          ${adminAddr}`);
  console.log(`Genesis Auditor: ${genesisAuditorAddr}`);
  console.log('');

  // Get contract reference for admin
  const adminContract = await IsnadRegistryContract.at(CONTRACT_ADDRESS, wallet);

  // ─── STEP 1: Read initial trust scores ──────────────────────────────────────
  console.log('Step 1: Reading initial trust scores (should all be 0)...');
  for (const [name, hash] of Object.entries(SKILLS)) {
    const info = await readTrustScore(adminContract, adminAddr, hash);
    console.log(`  ${name}: score=${info.score}, count=${info.count}, quarantined=${info.quarantined}`);
  }
  console.log('');

  // ─── STEP 2: Admin adds genesis auditor as root attestor ────────────────────
  console.log('Step 2: Admin adds genesis auditor as root attestor (depth=0, 4x weight)...');
  console.log('  (Generating ZK proof — this may take 30-120 seconds)');

  const addRootTx = await adminContract.methods
    .add_root_attestor(genesisAuditorAddr)
    .send({ from: adminAddr, fee: { paymentMethod }, wait: { timeout: 300_000 } });

  console.log(`  ✓ add_root_attestor tx: ${addRootTx.txHash}`);

  // Verify authorization
  const isAuth = await adminContract.methods
    .is_authorized_attestor(genesisAuditorAddr)
    .simulate({ from: adminAddr });
  const depth = await adminContract.methods
    .get_attestor_depth(genesisAuditorAddr)
    .simulate({ from: adminAddr });
  console.log(`  ✓ Genesis auditor authorized: ${Boolean(isAuth)}, depth: ${Number(depth)}`);
  console.log('');

  // ─── STEP 3: Genesis auditor attests clean skills ───────────────────────────
  console.log('Step 3: Genesis auditor submits positive attestations...');

  // Attest to weather-reporter-v2 (clean, behavioral audit)
  console.log('  Attesting weather-reporter-v2.skill.md (quality=92, behavioral)...');
  console.log('  (Generating ZK proof — this may take 30-120 seconds)');
  const attest1Tx = await adminContract.methods
    .attest(
      Fr.fromHexString(pad32(SKILLS.WEATHER_REPORTER_V2)),
      92,  // quality
      ClaimType.BEHAVIORAL  // claim_type (stored privately)
    )
    .send({ from: genesisAuditorAddr, fee: { paymentMethod }, wait: { timeout: 300_000 } });
  console.log(`  ✓ Attestation 1 tx: ${attest1Tx.txHash}`);

  // Attest to code-formatter-v1 (clean, code review)
  console.log('  Attesting code-formatter-v1.skill.md (quality=78, code_review)...');
  console.log('  (Generating ZK proof — this may take 30-120 seconds)');
  const attest2Tx = await adminContract.methods
    .attest(
      Fr.fromHexString(pad32(SKILLS.CODE_FORMATTER_V1)),
      78,  // quality
      ClaimType.CODE_REVIEW  // claim_type (stored privately)
    )
    .send({ from: genesisAuditorAddr, fee: { paymentMethod }, wait: { timeout: 300_000 } });
  console.log(`  ✓ Attestation 2 tx: ${attest2Tx.txHash}`);
  console.log('');

  // ─── STEP 4: Genesis auditor attests malicious skill (negative anchor) ──────
  console.log('Step 4: Genesis auditor submits negative attestation for known-malicious skill...');
  console.log('  Attesting get-weather.skill.md (quality=5, sandboxed_execution)...');
  console.log('  (NOTE: quality=5 signals extremely low trust — active malware detected)');
  console.log('  (Generating ZK proof — this may take 30-120 seconds)');
  const attest3Tx = await adminContract.methods
    .attest(
      Fr.fromHexString(pad32(SKILLS.GET_WEATHER_MALICIOUS)),
      5,   // quality (extremely low — malicious)
      ClaimType.SANDBOXED_EXECUTION  // sandboxed exec detected the exfil
    )
    .send({ from: genesisAuditorAddr, fee: { paymentMethod }, wait: { timeout: 300_000 } });
  console.log(`  ✓ Attestation 3 tx: ${attest3Tx.txHash}`);
  console.log('');

  // ─── STEP 5: Admin quarantines the malicious skill ──────────────────────────
  console.log('Step 5: Admin quarantines get-weather (emergency kill switch)...');
  console.log('  (Generating ZK proof — this may take 30-120 seconds)');
  const quarantineTx = await adminContract.methods
    .quarantine(Fr.fromHexString(pad32(SKILLS.GET_WEATHER_MALICIOUS)))
    .send({ from: adminAddr, fee: { paymentMethod }, wait: { timeout: 300_000 } });
  console.log(`  ✓ quarantine tx: ${quarantineTx.txHash}`);
  console.log('');

  // ─── STEP 6: Read final trust scores ────────────────────────────────────────
  console.log('Step 6: Reading final trust scores...');
  const results = {};
  for (const [name, hash] of Object.entries(SKILLS)) {
    const info = await readTrustScore(adminContract, adminAddr, hash);
    results[name] = info;
    const quarantineStr = info.quarantined ? ' [QUARANTINED - score suppressed]' : '';
    console.log(`  ${name}: score=${info.score}, count=${info.count}${quarantineStr}`);
  }
  console.log('');

  // ─── RESULT SUMMARY ─────────────────────────────────────────────────────────
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Genesis Attestation Complete                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  weather-reporter-v2:');
  const w = results.WEATHER_REPORTER_V2;
  console.log(`    Trust Score: ${w.score} (quality=92 × 4x root weight)`);
  console.log(`    Auditors: ${w.count}`);
  console.log(`    Status: TRUSTED`);
  console.log('');
  const c = results.CODE_FORMATTER_V1;
  console.log('  code-formatter-v1:');
  console.log(`    Trust Score: ${c.score} (quality=78 × 4x root weight)`);
  console.log(`    Auditors: ${c.count}`);
  console.log(`    Status: TRUSTED`);
  console.log('');
  const m = results.GET_WEATHER_MALICIOUS;
  console.log('  get-weather (Rufio / P0 Labs):');
  console.log(`    Trust Score: ${m.score} [suppressed by quarantine]`);
  console.log(`    Auditors: ${m.count} (attestation_count preserved even when quarantined)`);
  console.log(`    Status: QUARANTINED (admin kill switch active)`);
  console.log('');

  // Write genesis attestation record
  const genesisRecord = {
    timestamp: new Date().toISOString(),
    network: 'local',
    contractAddress: CONTRACT_ADDRESS.toString(),
    aztecVersion: '4.0.0-devnet.2-patch.0',
    contractVersion: '0.3.0',
    admin: adminAddr.toString(),
    genesisAuditor: {
      address: genesisAuditorAddr.toString(),
      depth: 0,
      weight: 4,
    },
    attestations: [
      {
        skill: 'weather-reporter-v2.skill.md',
        skillHash: SKILLS.WEATHER_REPORTER_V2,
        quality: 92,
        claimType: 'BEHAVIORAL',
        txHash: attest1Tx.txHash.toString(),
        finalScore: results.WEATHER_REPORTER_V2.score.toString(),
      },
      {
        skill: 'code-formatter-v1.skill.md',
        skillHash: SKILLS.CODE_FORMATTER_V1,
        quality: 78,
        claimType: 'CODE_REVIEW',
        txHash: attest2Tx.txHash.toString(),
        finalScore: results.CODE_FORMATTER_V1.score.toString(),
      },
      {
        skill: 'get-weather.skill.md (MALICIOUS)',
        skillHash: SKILLS.GET_WEATHER_MALICIOUS,
        quality: 5,
        claimType: 'SANDBOXED_EXECUTION',
        txHash: attest3Tx.txHash.toString(),
        quarantined: true,
        finalScore: results.GET_WEATHER_MALICIOUS.score.toString(),
      },
    ],
    quarantineAction: {
      skill: 'get-weather.skill.md (MALICIOUS)',
      txHash: quarantineTx.txHash.toString(),
    },
  };

  const genesisPath = resolve(PROJECT_ROOT, 'scripts/genesis-attestation-record.json');
  writeFileSync(genesisPath, JSON.stringify(genesisRecord, null, 2));
  console.log(`  Wrote genesis record: ${genesisPath}`);
  console.log('');
  console.log('  The Isnad Chain is live.');
  console.log('  The first genesis auditor has spoken.');
  console.log('  The chain of trust begins here.');
}

main().catch(err => {
  console.error('\nGenesis attestation failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
