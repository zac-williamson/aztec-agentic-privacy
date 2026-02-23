/**
 * Isnad Chain Frontend Configuration
 *
 * Toggle between mock SDK (for development) and real SDK (requires live network)
 * by setting the NEXT_PUBLIC_USE_MOCK env variable or the constant below.
 */

export const config = {
  /**
   * Use the mock SDK (in-memory, no network needed).
   * Set to false when:
   *   1. aztec compile + codegen are unblocked (GLIBC upgrade done)
   *   2. aztec start --local-network is running at pxeUrl
   *   3. Contract is deployed at contractAddress
   */
  useMock: process.env.NEXT_PUBLIC_USE_MOCK !== "false",

  /**
   * PXE endpoint for the real SDK.
   * Default: local network. Change to devnet URL for public deployment.
   */
  pxeUrl: process.env.NEXT_PUBLIC_PXE_URL ?? "http://localhost:8080",

  /**
   * Deployed IsnadRegistry contract address.
   * Placeholder — will be updated after first successful deploy.
   */
  contractAddress:
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
    "0x0000000000000000000000000000000000000000000000000000000000000000",

  /**
   * App metadata
   */
  appName: "The Isnad Chain",
  appDescription: "ZK Skill Attestation & Credential Registry for AI Agents",
  version: "0.1.0-devnet",
} as const;
