"use client";

import { useIsnad } from "../lib/isnad-context";

interface WalletRequiredProps {
  children: React.ReactNode;
  message?: string;
}

/**
 * Gate component — renders children only if wallet is connected.
 * Otherwise shows a connect prompt.
 */
export default function WalletRequired({
  children,
  message = "Connect your wallet to use this feature.",
}: WalletRequiredProps) {
  const { isConnected, connect, isConnecting, error } = useIsnad();

  if (isConnected) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      {/* Icon */}
      <div className="text-4xl text-wire-100 font-mono select-none">⬡</div>

      {/* Message */}
      <div className="text-center space-y-2">
        <p className="text-ink-muted font-mono text-sm">{message}</p>
        <p className="text-ink-faint font-mono text-xs">
          {process.env.NEXT_PUBLIC_USE_MOCK === "false"
            ? "Requires a running Aztec PXE at localhost:8080"
            : "Demo mode — no real wallet required"}
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="font-mono text-xs text-signal-danger max-w-sm text-center">{error}</p>
      )}

      {/* Connect button */}
      <button
        onClick={connect}
        disabled={isConnecting}
        className="
          px-6 py-2.5 rounded border border-amber/50 text-amber font-mono text-sm
          hover:bg-amber/5 hover:border-amber transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
          flex items-center gap-2
        "
      >
        {isConnecting ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            Connecting to PXE...
          </>
        ) : (
          "Connect Wallet"
        )}
      </button>
    </div>
  );
}
