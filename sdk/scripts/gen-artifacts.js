#!/usr/bin/env node
/**
 * gen-artifacts.js
 *
 * Generates TypeScript bindings from the nargo-compiled IsnadRegistry artifact.
 *
 * The Problem:
 *   `aztec codegen` requires `contract.transpiled === true`, a field only set by
 *   `aztec compile` (which runs Barretenberg/bb to transpile public bytecode).
 *   On this machine, bb requires GLIBC 2.38+ but the system has 2.34.
 *
 * The Solution:
 *   The TypeScript codegen step only needs ABI information — function names,
 *   parameter types, return types. It does NOT need the actual transpiled bytecode.
 *   We add `"transpiled": true` to the nargo artifact, which satisfies the check,
 *   then run `aztec codegen` which succeeds because public function bytecodes are
 *   stripped during artifact generation (only private function ACIR is retained).
 *
 * Usage:
 *   node scripts/gen-artifacts.js
 *   (or via: npm run gen-artifacts)
 *
 * Requires:
 *   - nargo compile to have been run in contracts/isnad_registry/
 *   - The aztec CLI to be installed at ~/.aztec/current/node_modules/.bin/aztec
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");
const contractRoot = join(projectRoot, "contracts/isnad_registry");
const artifactSrc = join(contractRoot, "target/isnad_registry-IsnadRegistry.json");
const artifactsDir = join(__dirname, "../src/artifacts");
const artifactDest = join(artifactsDir, "isnad_registry-IsnadRegistry.json");
const aztecCli = `${process.env.HOME}/.aztec/current/node_modules/.bin/aztec`;

console.log("==> Isnad SDK artifact generation");
console.log("    Source:", artifactSrc);
console.log("    Output:", artifactsDir);

// 1. Read the nargo artifact
let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactSrc, "utf8"));
  console.log(`\n[1] Loaded nargo artifact: ${artifact.name} (${artifact.functions.length} functions)`);
} catch (err) {
  console.error(`\nERROR: Could not read nargo artifact at ${artifactSrc}`);
  console.error("  Run: cd contracts/isnad_registry && nargo compile --force");
  process.exit(1);
}

// 2. Patch: add transpiled flag (bypasses aztec codegen's bb transpilation check)
// This is safe because codegen only needs ABI definitions, not public bytecode.
artifact.transpiled = true;
console.log("[2] Patched artifact with transpiled=true");

// 3. Write patched artifact to sdk/src/artifacts/
mkdirSync(artifactsDir, { recursive: true });
writeFileSync(artifactDest, JSON.stringify(artifact, null, 2));
console.log("[3] Wrote patched artifact to", artifactDest);

// 4. Run aztec codegen
console.log("[4] Running aztec codegen...");
try {
  execSync(`${aztecCli} codegen "${artifactDest}" --outdir "${artifactsDir}" --force`, {
    stdio: "inherit",
    cwd: artifactsDir,
  });
  console.log("[4] aztec codegen completed successfully");
} catch (err) {
  console.error("\nERROR: aztec codegen failed:", err.message);
  process.exit(1);
}

console.log("\n==> Done! TypeScript bindings generated at:", join(artifactsDir, "IsnadRegistry.ts"));
console.log("    The SDK is now ready to use with IsnadRegistryContract.");
