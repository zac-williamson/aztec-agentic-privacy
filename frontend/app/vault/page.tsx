"use client";

/**
 * Credential Vault — store, retrieve, rotate, and delegate API credentials.
 *
 * Wallet required. Credentials are stored as private CredentialNotes in the
 * agent's PXE — encrypted with their key, visible only to them.
 *
 * AuthWit delegation: grant a specific skill read access to one specific
 * credential, scoped to (skillAddress, keyId, nonce). Cannot be reused.
 */

import { useCallback, useState } from "react";
import WalletRequired from "../../components/WalletRequired";
import ProofProgress from "../../components/ProofProgress";
import { useIsnad } from "../../lib/isnad-context";

// ─── ADD CREDENTIAL MODAL / FORM ──────────────────────────────────────────────

interface AddCredentialFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCredentialForm({ onSuccess, onCancel }: AddCredentialFormProps) {
  const { sdk, refreshCredentials } = useIsnad();
  const [keyId, setKeyId] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");

  // Compute UTF-8 byte length for capacity check (CredentialNote.value = [Field; 4] = 124 bytes max)
  const valueByteLength = new TextEncoder().encode(value).length;
  const valueOverCapacity = valueByteLength > 124;
  const [phase, setPhase] = useState<"idle" | "proving" | "submitting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [showValue, setShowValue] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!sdk || !keyId.trim() || !value.trim() || valueOverCapacity) return;
    setPhase("proving");
    try {
      const result = await sdk.storeCredential(
        { keyId: keyId.trim(), value: value.trim(), label: label.trim() || keyId.trim() },
        (p) => setPhase(p),
      );
      setPhase("done");
      setTxHash(result.txHash);
      refreshCredentials();
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to store credential");
    }
  }, [sdk, keyId, value, label, refreshCredentials, onSuccess]);

  const isSubmitting = phase === "proving" || phase === "submitting";

  return (
    <div className="border border-wire rounded-lg overflow-hidden">
      <div className="border-b border-wire bg-void-100 px-4 py-3 flex items-center justify-between">
        <h3 className="font-mono text-sm text-ink">Store Credential</h3>
        <button
          onClick={onCancel}
          className="font-mono text-xs text-ink-muted hover:text-ink transition-colors"
        >
          cancel
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Key ID */}
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-ink-muted">Key ID</label>
          <input
            type="text"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="e.g. openai-api-key, github-token"
            className="
              w-full bg-void-100 border border-wire rounded px-3 py-2
              font-mono text-sm text-ink placeholder-ink-faint
              focus:border-amber transition-colors
            "
            disabled={isSubmitting}
          />
          <p className="font-mono text-xs text-ink-faint">
            Unique identifier. Used to retrieve or delegate this credential.
          </p>
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-ink-muted">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. OpenAI API Key (Production)"
            className="
              w-full bg-void-100 border border-wire rounded px-3 py-2
              font-mono text-sm text-ink placeholder-ink-faint
              focus:border-amber transition-colors
            "
            disabled={isSubmitting}
          />
        </div>

        {/* Secret value */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs text-ink-muted">Secret value</label>
            <div className="flex items-center gap-3">
              {/* Live byte counter */}
              <span className={`font-mono text-xs tabular-nums ${
                valueOverCapacity
                  ? "text-signal-danger"
                  : valueByteLength > 100
                    ? "text-amber"
                    : "text-ink-faint"
              }`}>
                {valueByteLength} / 124 bytes
              </span>
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="font-mono text-xs text-ink-faint hover:text-ink-muted transition-colors"
              >
                {showValue ? "hide" : "show"}
              </button>
            </div>
          </div>
          <input
            type={showValue ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-... or ghp_..."
            className={`
              w-full bg-void-100 border rounded px-3 py-2
              font-mono text-sm text-ink placeholder-ink-faint
              transition-colors focus:outline-none
              ${valueOverCapacity
                ? "border-signal-danger focus:border-signal-danger"
                : "border-wire focus:border-amber"
              }
            `}
            disabled={isSubmitting}
          />
          {valueOverCapacity ? (
            <p className="font-mono text-xs text-signal-danger">
              Value exceeds 124-byte capacity — trim before storing.
            </p>
          ) : (
            <p className="font-mono text-xs text-ink-faint">
              Encrypted with your PXE key. Max 124 bytes. Nobody else can read this.
            </p>
          )}
        </div>

        {/* Proof progress */}
        <ProofProgress phase={phase} txHash={txHash} error={errorMsg} />

        {/* Submit */}
        {phase !== "done" && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !keyId.trim() || !value.trim() || valueOverCapacity}
            className="
              w-full py-2.5 rounded border border-amber/50 text-amber font-mono text-sm
              hover:bg-amber/5 hover:border-amber transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                {phase === "proving" ? "Generating ZK proof..." : "Storing..."}
              </span>
            ) : valueOverCapacity ? (
              "Value too large (max 124 bytes)"
            ) : (
              "Store credential"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CREDENTIAL CARD ──────────────────────────────────────────────────────────

interface CredentialCardProps {
  keyId: string;
  label: string;
  onDeleted: () => void;
  onRotated: () => void;
}

function CredentialCard({ keyId, label, onDeleted, onRotated }: CredentialCardProps) {
  const { sdk } = useIsnad();
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [mode, setMode] = useState<"view" | "rotate" | "grant" | "delete">("view");

  // Phase tracking for operations
  const [phase, setPhase] = useState<"idle" | "proving" | "submitting" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  // Rotate form state
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState(label);

  // Grant access form state
  const [skillAddress, setSkillAddress] = useState("");
  const [grantedNonce, setGrantedNonce] = useState<bigint | null>(null);

  const handleReveal = useCallback(async () => {
    if (!sdk) return;
    if (revealed && value) { setRevealed(false); setValue(null); return; }
    setIsRevealing(true);
    try {
      const result = await sdk.getCredential(keyId);
      if (result) { setValue(result.value); setRevealed(true); }
    } finally {
      setIsRevealing(false);
    }
  }, [sdk, keyId, revealed, value]);

  const handleCopy = useCallback(() => {
    if (value) navigator.clipboard.writeText(value);
  }, [value]);

  const handleDelete = useCallback(async () => {
    if (!sdk) return;
    setPhase("proving");
    try {
      const result = await sdk.deleteCredential(keyId, (p) => setPhase(p));
      setPhase("done");
      setTxHash(result.txHash);
      setTimeout(onDeleted, 1500);
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Delete failed");
    }
  }, [sdk, keyId, onDeleted]);

  const handleRotate = useCallback(async () => {
    if (!sdk || !newValue.trim()) return;
    setPhase("proving");
    try {
      const result = await sdk.rotateCredential(
        { keyId, newValue: newValue.trim(), newLabel: newLabel.trim() || label },
        (p) => setPhase(p),
      );
      setPhase("done");
      setTxHash(result.txHash);
      setTimeout(onRotated, 1500);
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Rotation failed");
    }
  }, [sdk, keyId, newValue, newLabel, label, onRotated]);

  const handleGrantAccess = useCallback(async () => {
    if (!sdk || !skillAddress.trim()) return;
    setPhase("proving");
    try {
      const result = await sdk.grantCredentialAccess({
        keyId,
        skillAddress: skillAddress.trim(),
      });
      setGrantedNonce(result.authwitNonce);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Grant failed");
    }
  }, [sdk, keyId, skillAddress]);

  const resetOp = useCallback(() => {
    setMode("view");
    setPhase("idle");
    setTxHash(undefined);
    setErrorMsg(undefined);
    setGrantedNonce(null);
    setNewValue("");
  }, []);

  const isRunning = phase === "proving" || phase === "submitting";

  return (
    <div className="border border-wire rounded-lg overflow-hidden">
      {/* Card header */}
      <div className="border-b border-wire bg-void-100 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm text-ink truncate">{label || keyId}</div>
          <div className="font-mono text-xs text-ink-faint">{keyId}</div>
        </div>

        {/* Action buttons (view mode only) */}
        {mode === "view" && phase === "idle" && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleReveal}
              disabled={isRevealing}
              className="px-2 py-1 rounded border border-wire text-xs font-mono text-ink-muted hover:text-ink hover:border-wire-100 transition-colors disabled:opacity-40"
            >
              {isRevealing ? "..." : revealed ? "hide" : "reveal"}
            </button>
            {revealed && (
              <button
                onClick={handleCopy}
                className="px-2 py-1 rounded border border-wire text-xs font-mono text-ink-muted hover:text-amber hover:border-amber/50 transition-colors"
              >
                copy
              </button>
            )}
            <button
              onClick={() => setMode("rotate")}
              className="px-2 py-1 rounded border border-wire text-xs font-mono text-ink-muted hover:text-ink hover:border-wire-100 transition-colors"
            >
              rotate
            </button>
            <button
              onClick={() => setMode("grant")}
              className="px-2 py-1 rounded border border-wire text-xs font-mono text-ink-muted hover:text-amber hover:border-amber/50 transition-colors"
            >
              grant
            </button>
            <button
              onClick={() => setMode("delete")}
              className="px-2 py-1 rounded border border-wire text-xs font-mono text-ink-muted hover:text-signal-danger hover:border-signal-danger/50 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Value display */}
      {revealed && value && mode === "view" && (
        <div className="px-4 py-2 bg-void-50 border-b border-wire">
          <pre className="font-mono text-xs text-signal-trusted break-all whitespace-pre-wrap">{value}</pre>
        </div>
      )}
      {!revealed && mode === "view" && (
        <div className="px-4 py-2 border-b border-wire">
          <span className="font-mono text-xs text-ink-faint tracking-widest">●●●●●●●●●●●●●●●●</span>
        </div>
      )}

      {/* Operation panels */}
      {mode !== "view" && (
        <div className="p-4 space-y-4">
          {/* Rotate */}
          {mode === "rotate" && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-ink-muted">
                Atomic replace — old credential is nullified and new one stored in a single tx.
              </p>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="New label"
                className="w-full bg-void-100 border border-wire rounded px-3 py-2 font-mono text-xs text-ink placeholder-ink-faint focus:border-amber transition-colors"
                disabled={isRunning}
              />
              <input
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="New secret value"
                className="w-full bg-void-100 border border-wire rounded px-3 py-2 font-mono text-xs text-ink placeholder-ink-faint focus:border-amber transition-colors"
                disabled={isRunning}
              />
              <ProofProgress phase={phase} txHash={txHash} error={errorMsg} onDismiss={resetOp} />
              {phase === "idle" && (
                <div className="flex gap-2">
                  <button onClick={handleRotate} disabled={!newValue.trim()} className="flex-1 py-2 rounded border border-amber/50 text-amber font-mono text-xs hover:bg-amber/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    Rotate
                  </button>
                  <button onClick={resetOp} className="px-4 py-2 rounded border border-wire text-ink-muted font-mono text-xs hover:text-ink transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grant access */}
          {mode === "grant" && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-ink-muted leading-relaxed">
                Grant a specific skill read access to this credential. Creates an AuthWit scoped
                to (skillAddress, keyId, nonce). Single-use — cannot be reused.
              </p>
              {grantedNonce === null ? (
                <>
                  <input
                    type="text"
                    value={skillAddress}
                    onChange={(e) => setSkillAddress(e.target.value)}
                    placeholder="Skill contract address (0x...)"
                    className="w-full bg-void-100 border border-wire rounded px-3 py-2 font-mono text-xs text-ink placeholder-ink-faint focus:border-amber transition-colors"
                    disabled={isRunning}
                  />
                  <ProofProgress phase={phase} txHash={txHash} error={errorMsg} onDismiss={resetOp} />
                  {phase === "idle" && (
                    <div className="flex gap-2">
                      <button onClick={handleGrantAccess} disabled={!skillAddress.trim()} className="flex-1 py-2 rounded border border-amber/50 text-amber font-mono text-xs hover:bg-amber/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        Grant access
                      </button>
                      <button onClick={resetOp} className="px-4 py-2 rounded border border-wire text-ink-muted font-mono text-xs hover:text-ink transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded bg-signal-trusted/5 border border-signal-trusted/30 space-y-2">
                    <p className="font-mono text-xs text-signal-trusted">AuthWit created successfully.</p>
                    <p className="font-mono text-xs text-ink-muted">
                      Share this nonce with the skill so it can call{" "}
                      <code className="text-ink">get_credential_for_skill()</code>:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-amber break-all flex-1">
                        authwitNonce: {grantedNonce.toString()}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(grantedNonce.toString())}
                        className="shrink-0 px-2 py-1 rounded border border-wire text-xs font-mono text-ink-muted hover:text-ink transition-colors"
                      >
                        copy
                      </button>
                    </div>
                  </div>
                  <button onClick={resetOp} className="font-mono text-xs text-ink-muted hover:text-ink transition-colors">
                    Done
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delete */}
          {mode === "delete" && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-signal-danger">
                This will permanently nullify the credential note. This action cannot be undone.
                Use <span className="text-ink">rotate</span> instead to atomically replace.
              </p>
              <ProofProgress phase={phase} txHash={txHash} error={errorMsg} onDismiss={resetOp} />
              {phase === "idle" && (
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="flex-1 py-2 rounded border border-signal-danger/50 text-signal-danger font-mono text-xs hover:bg-signal-danger/5 transition-colors">
                    Delete permanently
                  </button>
                  <button onClick={resetOp} className="px-4 py-2 rounded border border-wire text-ink-muted font-mono text-xs hover:text-ink transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VAULT PAGE ───────────────────────────────────────────────────────────────

function VaultContent() {
  const { credentialList, refreshCredentials } = useIsnad();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdded = useCallback(() => {
    setShowAddForm(false);
    refreshCredentials();
  }, [refreshCredentials]);

  return (
    <div className="space-y-6">
      {/* Add credential button / form */}
      {showAddForm ? (
        <AddCredentialForm onSuccess={handleAdded} onCancel={() => setShowAddForm(false)} />
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-ink-muted">
              {credentialList.length === 0
                ? "No credentials stored yet."
                : `${credentialList.length} credential${credentialList.length > 1 ? "s" : ""} stored privately.`}
            </p>
            <p className="font-mono text-xs text-ink-faint mt-0.5">
              Encrypted in your PXE. Invisible to the network, sequencer, and contract.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="
              px-4 py-2 rounded border border-amber/50 text-amber font-mono text-sm
              hover:bg-amber/5 hover:border-amber transition-colors shrink-0
            "
          >
            + Add credential
          </button>
        </div>
      )}

      {/* Credential list */}
      {credentialList.length === 0 && !showAddForm && (
        <div className="border border-wire rounded-lg p-8 text-center space-y-3">
          <div className="text-4xl text-wire-100 font-mono select-none">⬡</div>
          <p className="font-mono text-sm text-ink-muted">Your vault is empty.</p>
          <p className="font-mono text-xs text-ink-faint max-w-md mx-auto leading-relaxed">
            Store API keys and secrets here. They are encrypted with your key and stored as
            private notes on Aztec — no server can read them. Grant scoped access to individual
            skills via AuthWit without exposing your full vault.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {credentialList.map(({ keyId, label }) => (
          <CredentialCard
            key={keyId}
            keyId={keyId}
            label={label}
            onDeleted={refreshCredentials}
            onRotated={refreshCredentials}
          />
        ))}
      </div>

      {/* Info section */}
      {credentialList.length > 0 && (
        <div className="border border-wire rounded-lg p-4 space-y-2">
          <h3 className="font-mono text-xs text-ink-muted uppercase tracking-widest">Security model</h3>
          <div className="space-y-1.5">
            {[
              "Credentials are encrypted with your PXE key before storage. The Aztec network only sees an encrypted note hash.",
              "Only you can retrieve credentials. Grant access to specific skills using AuthWit — each delegation is single-use.",
              "Nullifier prevents credential reuse after deletion. Rotate atomically to avoid a gap between delete and re-store.",
              "No server-side storage. No custody risk. If you lose your PXE keys, credentials are unrecoverable.",
            ].map((point, i) => (
              <p key={i} className="font-mono text-xs text-ink-faint flex gap-2">
                <span className="text-wire-100 shrink-0">—</span>
                {point}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VaultPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 pt-4">
        <h1 className="font-mono text-2xl text-ink">
          <span className="text-amber">⬡</span> Credential Vault
        </h1>
        <p className="font-mono text-sm text-ink-muted max-w-2xl leading-relaxed">
          Store API keys and secrets as private notes on Aztec. Encrypted with your PXE key.
          Grant scoped access to individual skills via AuthWit — no skill can read your full vault.
        </p>
      </div>

      <WalletRequired message="Connect your wallet to access your private credential vault.">
        <VaultContent />
      </WalletRequired>
    </div>
  );
}
