"use client";

/**
 * IsnadContext — provides the SDK instance and wallet state to all components.
 *
 * In mock mode: creates a MockIsnadSDK with a simulated wallet address.
 * In real mode: connects to PXE, prompts wallet creation/import.
 *
 * To switch to the real SDK:
 *   1. Set NEXT_PUBLIC_USE_MOCK=false in .env.local
 *   2. Ensure aztec start --local-network is running
 *   3. Update the import below to use IsnadSDK from @nullius/isnad
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { MockIsnadSDK } from "./mock-sdk";
import { config } from "./config";
import type { LocalAttestation } from "./types";

// ─── MOCK WALLET ──────────────────────────────────────────────────────────────

/** Simulated wallet addresses for demo purposes */
const MOCK_WALLET_ADDRESSES = [
  "0x2f5e9c1a4b8d7f3e6a2c5b8d1f4e7a3c9b6e2d5f8a1c4b7e3d6a9f2c5b8e1d4",
  "0x1a3b5c7d9e2f4a6b8c0d1e3f5a7b9c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4",
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

interface IsnadContextValue {
  /** The SDK instance — null if wallet not connected */
  sdk: MockIsnadSDK | null;
  /** Whether a wallet is currently connected */
  isConnected: boolean;
  /** Short display address (first 6 + last 4 chars) */
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
  const [sdk, setSdk] = useState<MockIsnadSDK | null>(null);
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
        // Mock: use a consistent address derived from session
        const addr = MOCK_WALLET_ADDRESSES[0];
        await new Promise((r) => setTimeout(r, 800)); // Simulate connection delay
        const mockSdk = new MockIsnadSDK(addr);
        setSdk(mockSdk);
        setWalletAddress(addr);
      } else {
        // Real: connect to PXE
        // TODO: import and use real IsnadSDK when aztec compile is unblocked
        throw new Error("Real SDK not yet activated. Set NEXT_PUBLIC_USE_MOCK=false only after codegen step.");
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
