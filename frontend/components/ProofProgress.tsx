"use client";

import { useEffect, useState } from "react";

interface ProofProgressProps {
  phase: "idle" | "proving" | "submitting" | "done" | "error";
  txHash?: string;
  error?: string;
  onDismiss?: () => void;
}

const PHASE_CONFIG = {
  idle: {
    label: "",
    detail: "",
    color: "bg-amber",
    pulse: false,
  },
  proving: {
    label: "Generating ZK proof",
    detail: "This takes 3–60 seconds depending on hardware. Your identity is never revealed.",
    color: "bg-amber",
    pulse: true,
  },
  submitting: {
    label: "Proof verified — submitting transaction",
    detail: "Broadcasting to the Aztec network...",
    color: "bg-signal-caution",
    pulse: true,
  },
  done: {
    label: "Transaction confirmed",
    detail: "",
    color: "bg-signal-trusted",
    pulse: false,
  },
  error: {
    label: "Transaction failed",
    detail: "",
    color: "bg-signal-danger",
    pulse: false,
  },
} as const;

export default function ProofProgress({ phase, txHash, error, onDismiss }: ProofProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  // Track elapsed time during proving
  useEffect(() => {
    if (phase !== "proving") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  if (phase === "idle") return null;

  const cfg = PHASE_CONFIG[phase];

  return (
    <div className={`
      rounded border p-4 space-y-3
      ${phase === "done" ? "border-signal-trusted/30 bg-signal-trusted/5" : ""}
      ${phase === "error" ? "border-signal-danger/30 bg-signal-danger/5" : ""}
      ${phase === "proving" || phase === "submitting" ? "border-amber/30 bg-amber/5" : ""}
    `}>
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <span
          className={`
            w-2 h-2 rounded-full shrink-0
            ${cfg.color}
            ${cfg.pulse ? "animate-pulse" : ""}
          `}
        />
        <span className="font-mono text-sm text-ink">{cfg.label}</span>

        {/* Elapsed time */}
        {phase === "proving" && (
          <span className="font-mono text-xs text-ink-muted ml-auto">
            {elapsed}s
          </span>
        )}

        {/* Dismiss button */}
        {(phase === "done" || phase === "error") && onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto text-ink-muted hover:text-ink text-xs font-mono"
          >
            dismiss
          </button>
        )}
      </div>

      {/* Detail text */}
      {cfg.detail && (
        <p className="text-xs text-ink-muted font-mono">{cfg.detail}</p>
      )}

      {/* Proof generation scanline animation */}
      {(phase === "proving" || phase === "submitting") && (
        <div className="relative h-0.5 bg-wire overflow-hidden rounded-full">
          <div className="absolute inset-y-0 w-1/3 bg-amber/60 scanline rounded-full" />
        </div>
      )}

      {/* Tx hash on success */}
      {phase === "done" && txHash && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-ink-muted font-mono">tx:</span>
          <a
            href="#"
            className="font-mono text-xs text-signal-trusted hover:underline break-all"
            title={txHash}
          >
            {txHash.slice(0, 18)}...{txHash.slice(-8)}
          </a>
        </div>
      )}

      {/* Error message */}
      {phase === "error" && error && (
        <p className="text-xs text-signal-danger font-mono">{error}</p>
      )}

      {/* ZK privacy reminder during proof */}
      {phase === "proving" && (
        <p className="text-xs text-ink-faint font-mono border-t border-wire pt-2">
          ⬡ Your identity will not appear in public state. Only the trust score increments.
        </p>
      )}
    </div>
  );
}
