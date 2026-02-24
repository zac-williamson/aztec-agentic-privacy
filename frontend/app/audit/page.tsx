"use client";

/**
 * Auditor Dashboard — submit attestations, view attestation history.
 *
 * Wallet required. When connected, the auditor can:
 *   1. Upload a skill file or enter a hash to attest
 *   2. Set a quality score (0-100)
 *   3. Submit → ZK proof generated → trust score incremented anonymously
 *   4. View their private attestation history (local PXE cache)
 *   5. Revoke attestations they no longer stand behind
 */

import { useCallback, useState } from "react";
import WalletRequired from "../../components/WalletRequired";
import ProofProgress from "../../components/ProofProgress";
import { useIsnad } from "../../lib/isnad-context";
import type { LocalAttestation } from "../../lib/types";
import { computeSkillHashFromFile } from "../../lib/mock-sdk";

// ─── ATTEST FORM ─────────────────────────────────────────────────────────────

function AttestForm() {
  const { sdk, myAttestations, refreshAttestations } = useIsnad();

  const [skillHash, setSkillHash] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [quality, setQuality] = useState(80);
  const [phase, setPhase] = useState<"idle" | "proving" | "submitting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const handleFile = useCallback(async (file: File) => {
    const hash = await computeSkillHashFromFile(file);
    setSkillHash(hash);
    setFileName(file.name);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleSubmit = useCallback(async () => {
    if (!sdk || !skillHash.trim()) return;
    setPhase("proving");
    setTxHash(undefined);
    setErrorMsg(undefined);

    try {
      const result = await sdk.attest(
        { skillHash: skillHash.trim(), quality },
        (p) => setPhase(p),
      );
      setPhase("done");
      setTxHash(result.txHash);
      refreshAttestations();
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Attestation failed");
    }
  }, [sdk, skillHash, quality, refreshAttestations]);

  const resetForm = useCallback(() => {
    setPhase("idle");
    setSkillHash("");
    setFileName(null);
    setQuality(80);
    setTxHash(undefined);
    setErrorMsg(undefined);
  }, []);

  const isSubmitting = phase === "proving" || phase === "submitting";
  const alreadyAttested = myAttestations.some(
    (a) => a.skillHash.toLowerCase() === skillHash.toLowerCase().trim() && !a.revoked,
  );

  const qualityLabel = quality >= 80 ? "Trusted" : quality >= 50 ? "Cautious" : "Risky";
  const qualityColor = quality >= 80 ? "text-signal-trusted" : quality >= 50 ? "text-signal-caution" : "text-signal-danger";

  return (
    <div className="border border-wire rounded-lg overflow-hidden">
      <div className="border-b border-wire bg-void-100 px-4 py-3">
        <h2 className="font-mono text-sm text-ink">Submit Attestation</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Skill hash input */}
        <div className="space-y-2">
          <label className="font-mono text-xs text-ink-muted">Skill hash or file</label>

          {/* File drop zone */}
          <div
            className="upload-zone rounded p-4 text-center cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("audit-file-input")?.click()}
          >
            <input
              id="audit-file-input"
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {fileName ? (
              <div className="space-y-1">
                <p className="font-mono text-xs text-amber">{fileName}</p>
                <p className="font-mono text-xs text-ink-muted truncate">{skillHash.slice(0, 32)}...</p>
              </div>
            ) : (
              <p className="font-mono text-xs text-ink-muted">
                <span className="text-ink hover:text-amber transition-colors">
                  Drop or click to upload skill file
                </span>
                {" "}— hash computed locally
              </p>
            )}
          </div>

          {/* Or enter hash directly */}
          <input
            type="text"
            value={skillHash}
            onChange={(e) => { setSkillHash(e.target.value); setFileName(null); }}
            placeholder="or paste 0x hash directly..."
            className="
              w-full bg-void-100 border border-wire rounded px-3 py-2
              font-mono text-xs text-ink placeholder-ink-faint
              focus:border-amber transition-colors
            "
          />

          {alreadyAttested && (
            <p className="font-mono text-xs text-signal-caution">
              ⚠ You have already attested this skill. Double-attestation is prevented by ZK nullifier.
            </p>
          )}
        </div>

        {/* Quality slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs text-ink-muted">Quality score</label>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs ${qualityColor}`}>{qualityLabel}</span>
              <span className="font-mono text-lg font-bold text-ink tabular-nums">{quality}</span>
              <span className="font-mono text-xs text-ink-faint">/ 100</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full"
            disabled={isSubmitting}
          />
          <div className="flex justify-between font-mono text-xs text-ink-faint">
            <span>0 — do not install</span>
            <span>50 — use with caution</span>
            <span>100 — fully trusted</span>
          </div>
        </div>

        {/* Proof progress */}
        <ProofProgress
          phase={phase}
          txHash={txHash}
          error={errorMsg}
          onDismiss={phase === "done" ? resetForm : undefined}
        />

        {/* Submit */}
        {phase !== "done" && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !skillHash.trim() || alreadyAttested}
            className="
              w-full py-2.5 rounded border border-amber/50 text-amber font-mono text-sm
              hover:bg-amber/5 hover:border-amber transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                {phase === "proving" ? "Generating ZK proof..." : "Submitting..."}
              </span>
            ) : (
              "Attest — anonymous ZK proof"
            )}
          </button>
        )}

        <p className="font-mono text-xs text-ink-faint text-center leading-relaxed">
          Your identity will not appear in public state. Only the trust score increments.
          Proof generation takes 3–60 seconds depending on hardware.
        </p>
      </div>
    </div>
  );
}

// ─── ATTESTATION HISTORY ──────────────────────────────────────────────────────

function AttestationHistory() {
  const { sdk, myAttestations, refreshAttestations } = useIsnad();
  const [revokingHash, setRevokingHash] = useState<string | null>(null);
  const [revokePhase, setRevokePhase] = useState<"idle" | "proving" | "submitting" | "done" | "error">("idle");
  const [revokeTxHash, setRevokeTxHash] = useState<string | undefined>();
  const [revokeError, setRevokeError] = useState<string | undefined>();

  const handleRevoke = useCallback(
    async (attestation: LocalAttestation) => {
      if (!sdk) return;
      setRevokingHash(attestation.skillHash);
      setRevokePhase("proving");
      setRevokeTxHash(undefined);
      setRevokeError(undefined);

      try {
        const result = await sdk.revokeAttestation(
          attestation.skillHash,
          (p) => setRevokePhase(p),
        );
        setRevokePhase("done");
        setRevokeTxHash(result.txHash);
        refreshAttestations();
        setTimeout(() => {
          setRevokingHash(null);
          setRevokePhase("idle");
        }, 3000);
      } catch (err) {
        setRevokePhase("error");
        setRevokeError(err instanceof Error ? err.message : "Revocation failed");
      }
    },
    [sdk, refreshAttestations],
  );

  const active = myAttestations.filter((a) => !a.revoked);
  const revoked = myAttestations.filter((a) => a.revoked);

  return (
    <div className="border border-wire rounded-lg overflow-hidden">
      <div className="border-b border-wire bg-void-100 px-4 py-3 flex items-center justify-between">
        <h2 className="font-mono text-sm text-ink">Your Attestation History</h2>
        <span className="font-mono text-xs text-ink-muted">private — only visible in your PXE</span>
      </div>

      <div className="divide-y divide-wire">
        {myAttestations.length === 0 && (
          <div className="p-6 text-center">
            <p className="font-mono text-sm text-ink-muted">No attestations yet.</p>
            <p className="font-mono text-xs text-ink-faint mt-1">
              Attest a skill to build your private audit history.
            </p>
          </div>
        )}

        {active.map((att) => {
          const isRevokingThis = revokingHash === att.skillHash && revokePhase !== "idle";
          const daysAgo = Math.floor((Date.now() - att.timestamp.getTime()) / (1000 * 60 * 60 * 24));
          const timeLabel = daysAgo === 0 ? "just now" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

          return (
            <div key={att.txHash} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="font-mono text-xs text-ink break-all">
                    {att.skillHash.slice(0, 20)}...{att.skillHash.slice(-8)}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-ink-muted">
                      quality: <span className="text-signal-trusted">{att.quality}</span>
                    </span>
                    <span className="font-mono text-xs text-ink-faint">{timeLabel}</span>
                  </div>
                </div>

                {!isRevokingThis && (
                  <button
                    onClick={() => handleRevoke(att)}
                    className="
                      shrink-0 px-3 py-1 rounded border border-wire text-xs font-mono text-ink-muted
                      hover:border-signal-danger hover:text-signal-danger transition-colors
                    "
                  >
                    Revoke
                  </button>
                )}
              </div>

              {isRevokingThis && (
                <ProofProgress
                  phase={revokePhase}
                  txHash={revokeTxHash}
                  error={revokeError}
                />
              )}
            </div>
          );
        })}

        {revoked.length > 0 && (
          <div className="p-4">
            <details className="group">
              <summary className="font-mono text-xs text-ink-faint cursor-pointer hover:text-ink-muted">
                {revoked.length} revoked attestation{revoked.length > 1 ? "s" : ""}
              </summary>
              <div className="mt-3 space-y-2">
                {revoked.map((att) => (
                  <div key={att.txHash} className="flex items-center gap-3 opacity-50">
                    <span className="font-mono text-xs text-ink-muted line-through break-all">
                      {att.skillHash.slice(0, 20)}...
                    </span>
                    <span className="font-mono text-xs text-signal-danger">revoked</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 pt-4">
        <h1 className="font-mono text-2xl text-ink">
          <span className="text-amber">⬡</span> Auditor Dashboard
        </h1>
        <p className="font-mono text-sm text-ink-muted max-w-2xl leading-relaxed">
          Submit anonymous attestations for skills you have examined. A ZK proof is generated
          locally — your identity never appears in public contract state. Only the aggregate
          trust score is visible to anyone.
        </p>
      </div>

      <WalletRequired message="Connect your wallet to submit attestations and view your private audit history.">
        <div className="grid gap-6 lg:grid-cols-2">
          <AttestForm />
          <AttestationHistory />
        </div>
      </WalletRequired>
    </div>
  );
}
