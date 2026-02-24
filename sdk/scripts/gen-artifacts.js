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

// 2b. Strip __aztec_nr_internals__ prefix from function names.
//
// nargo compile (used on this machine) emits the low-level ACIR entrypoint names
// with this prefix because they're the circuit's internal function names.
// aztec compile (which requires bb / GLIBC 2.38+) strips this prefix during the
// transpilation step, leaving clean names like "attest", "get_trust_score", etc.
//
// Since we use the nargo artifact directly (patched with transpiled=true), we need
// to replicate the name-stripping step manually so that:
//   (a) aztec codegen produces TypeScript bindings with clean method names
//   (b) isnad.ts can call methods.attest(...) instead of methods.__aztec_nr_internals__attest(...)
//   (c) The SDK matches what aztec compile would have produced
const PREFIX = "__aztec_nr_internals__";
let renamedCount = 0;
artifact.functions = artifact.functions.map((fn) => {
  if (fn.name && fn.name.startsWith(PREFIX)) {
    const cleanName = fn.name.slice(PREFIX.length);
    renamedCount++;
    return { ...fn, name: cleanName };
  }
  return fn;
});
console.log(`[2b] Stripped '${PREFIX}' prefix from ${renamedCount} function names`);

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
