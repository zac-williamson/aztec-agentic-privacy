"use client";

/**
 * IsnadContext — provides the SDK instance and wallet state to all components.
 *
 * In mock mode (default): uses MockIsnadSDK with a simulated wallet address.
 * In real mode: connects to a running PXE, loads the deployed IsnadRegistry contract.
 *
 * To switch to the real SDK:
 *   1. Run scripts/activate-real-sdk.sh (handles packages, network, deployment)
 *   2. Or manually:
 *      a. aztec start --local-network
 *      b. Deploy contract: cd contracts/isnad_registry && aztec deploy
 *      c. cd frontend && npm install @aztec/aztec.js@4.0.0-devnet.2-patch.0 @aztec/accounts@4.0.0-devnet.2-patch.0
 *      d. cd sdk && npm run build
 *      e. Set NEXT_PUBLIC_USE_MOCK=false, NEXT_PUBLIC_PXE_URL, NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { MockIsnadSDK } from "./mock-sdk";
import { config } from "./config";
import type { IsnadSdkLike, LocalAttestation } from "./types";

// ─── MOCK WALLET ──────────────────────────────────────────────────────────────

/** Simulated wallet addresses for demo purposes */
const MOCK_WALLET_ADDRESSES = [
  "0x2f5e9c1a4b8d7f3e6a2c5b8d1f4e7a3c9b6e2d5f8a1c4b7e3d6a9f2c5b8e1d4",
  "0x1a3b5c7d9e2f4a6b8c0d1e3f5a7b9c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4",
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

interface IsnadContextValue {
  /** The SDK instance — null if wallet not connected */
  sdk: IsnadSdkLike | null;
  /** Whether a wallet is currently connected */
  isConnected: boolean;
  /** Short display address (first 8 + last 6 chars) */
  displayAddress: string | null;
  /** Full wallet address */
  walletAddress: string | null;
  /** Connect wallet (mock: instant; real: PXE flow) */
  connect: () => Promise<void>;
  /** Disconnect wallet */
  disconnect: () => void;
  /** Error state */
  error: string | null;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Attestation history for the current session */
  myAttestations: LocalAttestation[];
  /** Refresh attestation list */
  refreshAttestations: () => void;
  /** Credential key IDs stored in vault */
  credentialList: Array<{ keyId: string; label: string }>;
  /** Refresh credential list */
  refreshCredentials: () => void;
}

const IsnadContext = createContext<IsnadContextValue | null>(null);

// ─── PROVIDER ──────────────────────────────────────────────────────────────────

export function IsnadProvider({ children }: { children: React.ReactNode }) {
  const [sdk, setSdk] = useState<IsnadSdkLike | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myAttestations, setMyAttestations] = useState<LocalAttestation[]>([]);
  const [credentialList, setCredentialList] = useState<Array<{ keyId: string; label: string }>>([]);

  const refreshAttestations = useCallback(() => {
    if (sdk) setMyAttestations(sdk.getMyAttestations());
  }, [sdk]);

  const refreshCredentials = useCallback(() => {
    if (sdk) setCredentialList(sdk.listCredentials());
  }, [sdk]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      if (config.useMock) {
        // Mock: use a consistent address, simulate connection delay
        const addr = MOCK_WALLET_ADDRESSES[0];
        await new Promise((r) => setTimeout(r, 800));
        const mockSdk = new MockIsnadSDK(addr);
        setSdk(mockSdk);
        setWalletAddress(addr);
      } else {
        // Real mode: connect to PXE and load the deployed IsnadRegistry contract.
        // RealSdkWrapper is dynamically imported so webpack doesn't try to resolve
        // @aztec/aztec.js and @nullius/isnad at build time if not installed.
        //
        // Prerequisites (run scripts/activate-real-sdk.sh to set up automatically):
        //   1. aztec start --local-network (PXE running at pxeUrl)
        //   2. IsnadRegistry deployed at contractAddress
        //   3. cd frontend && npm install @aztec/aztec.js@4.0.0-devnet.2-patch.0 @aztec/accounts@4.0.0-devnet.2-patch.0
        //   4. cd sdk && npm run build
        //   5. NEXT_PUBLIC_USE_MOCK=false, NEXT_PUBLIC_PXE_URL, NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local
        const { RealSdkWrapper } = await import("./real-sdk-wrapper");
        const realSdk = await RealSdkWrapper.create(config.pxeUrl, config.contractAddress);
        setSdk(realSdk);
        setWalletAddress(realSdk.walletAddress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSdk(null);
    setWalletAddress(null);
    setMyAttestations([]);
    setCredentialList([]);
    setError(null);
  }, []);

  // Sync attestations and credentials when SDK changes
  useEffect(() => {
    if (sdk) {
      setMyAttestations(sdk.getMyAttestations());
      setCredentialList(sdk.listCredentials());
    }
  }, [sdk]);

  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : null;

  return (
    <IsnadContext.Provider
      value={{
        sdk,
        isConnected: sdk !== null,
        displayAddress,
        walletAddress,
        connect,
        disconnect,
        error,
        isConnecting,
        myAttestations,
        refreshAttestations,
        credentialList,
        refreshCredentials,
      }}
    >
      {children}
    </IsnadContext.Provider>
  );
}

// ─── HOOK ──────────────────────────────────────────────────────────────────────

export function useIsnad(): IsnadContextValue {
  const ctx = useContext(IsnadContext);
  if (!ctx) throw new Error("useIsnad must be used within <IsnadProvider>");
  return ctx;
}
