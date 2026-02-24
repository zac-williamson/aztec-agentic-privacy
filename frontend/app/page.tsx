"use client";

/**
 * Skill Trust Browser — home page.
 *
 * Public-facing: no wallet required.
 * Search a skill by hash (hex string) or upload the skill file to compute its hash.
 * Displays trust score, attestation count, and attestation history timeline.
 */

import { useCallback, useState } from "react";
import TrustScore, { AttestHistoryItem } from "../components/TrustScore";
import { MockIsnadSDK, computeSkillHashFromFile } from "../lib/mock-sdk";
import type { SkillTrustInfo } from "../lib/types";
import Link from "next/link";

// Shared read-only SDK instance (no wallet needed for public reads)
const publicSdk = new MockIsnadSDK("0x000000000000000000000000000000000000000000000000000000000000public");

const EXAMPLE_HASHES = [
  {
    label: "weather-reporter-v2",
    hash: "0x7f3ac4b82d19e8a1f5b6c3d4e9f2a0b7c8d5e6f1a2b3c4d5e6f7a8b9c0d1e2f",
    trusted: true,
  },
  {
    label: "code-formatter-v1",
    hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
    trusted: true,
  },
  {
    label: "get-weather (MALICIOUS — see P0 Labs report)",
    hash: "0xdeadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718",
    trusted: false,
  },
];

export default function TrustBrowserPage() {
  const [inputHash, setInputHash] = useState("");
  const [searchHash, setSearchHash] = useState<string | null>(null);
  const [trustInfo, setTrustInfo] = useState<SkillTrustInfo | null>(null);
  const [history, setHistory] = useState<Array<{ quality: number; ts: Date }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Validate a skill hash string: must be "0x" followed by 1-64 hex characters.
  const isValidHash = useCallback((h: string): boolean => {
    return /^0x[0-9a-fA-F]{1,64}$/.test(h.trim());
  }, []);

  const doSearch = useCallback(async (hash: string) => {
    const clean = hash.trim();
    if (!clean) return;

    if (!isValidHash(clean)) {
      setError("Invalid hash format. Expected 0x followed by up to 64 hex characters.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTrustInfo(null);
    setHistory([]);
    setSearchHash(clean);

    try {
      const [info, hist] = await Promise.all([
        publicSdk.getTrustScore(clean),
        publicSdk.getAttestationHistory(clean),
      ]);
      setTrustInfo(info);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsLoading(false);
    }
  }, [isValidHash]);

  const handleSearch = useCallback(() => {
    doSearch(inputHash);
  }, [inputHash, doSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);
      try {
        const hash = await computeSkillHashFromFile(file);
        setInputHash(hash);
        await doSearch(hash);
      } catch (err) {
        setError("Failed to compute skill hash from file.");
      } finally {
        setIsLoading(false);
      }
    },
    [doSearch],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  return (
    <div className="space-y-10">
      {/* Project landing hero */}
      <div className="pt-8 pb-4 border-b border-wire space-y-6">
        <div className="space-y-2">
          <div className="font-mono text-xs text-amber tracking-widest uppercase">
            Built on Aztec · Zero-Knowledge · Owned by No One
          </div>
          <h1 className="font-mono text-3xl text-ink font-medium leading-tight">
            The Isnad Chain
          </h1>
          <p className="font-mono text-base text-ink-muted max-w-2xl leading-relaxed">
            A privacy-preserving skill attestation registry for AI agents.
            Auditors verify skills anonymously using ZK proofs.
            Trust scores are public. Auditor identities are not.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Anonymous Attestation",
              desc: "Auditors submit ZK proofs. Their identity never touches the chain — only the trust signal does.",
            },
            {
              label: "Content-Addressed",
              desc: "Trust is tied to SHA256 of skill content. Modify the file, the hash changes, prior attestations expire.",
            },
            {
              label: "Private Credential Vault",
              desc: "Store API keys as private notes on Aztec L2. Grant scoped access per skill via AuthWit.",
            },
          ].map(({ label, desc }) => (
            <div key={label} className="p-4 border border-wire rounded-lg space-y-1.5">
              <div className="font-mono text-xs text-amber">⬡</div>
              <div className="font-mono text-xs text-ink">{label}</div>
              <div className="font-mono text-xs text-ink-faint leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 font-mono text-xs text-ink-faint">
          <a
            href="https://github.com/zac-williamson/aztec-agentic-privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition-colors"
          >
            GitHub →
          </a>
          <span>Aztec devnet · v0.1.0</span>
          <span>Demo mode — no wallet required to browse</span>
        </div>
      </div>

      {/* Skill Trust Browser */}
      <div className="space-y-3">
        <h2 className="font-mono text-lg text-ink">
          <span className="text-amber">⬡</span> Skill Trust Browser
        </h2>
        <p className="font-mono text-sm text-ink-muted max-w-2xl leading-relaxed">
          Check a skill&apos;s trust score before installing it. Enter its SHA256 hash or
          drop the file to compute the hash locally.
        </p>
      </div>

      {/* Search section */}
      <div className="space-y-4">
        {/* Hash input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputHash}
            onChange={(e) => setInputHash(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0x7f3a... (SHA256 of skill file content)"
            className={`
              flex-1 bg-void-100 border rounded px-3 py-2.5
              font-mono text-sm text-ink placeholder-ink-faint
              transition-colors focus:outline-none
              ${inputHash.trim() && !isValidHash(inputHash)
                ? "border-signal-danger focus:border-signal-danger"
                : "border-wire focus:border-amber"
              }
            `}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !inputHash.trim() || !isValidHash(inputHash)}
            className="
              px-4 py-2.5 rounded border border-wire-50 font-mono text-sm text-ink-muted
              hover:border-amber hover:text-amber transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            {isLoading ? "..." : "Search"}
          </button>
        </div>

        {/* File upload drop zone */}
        <div
          className={`upload-zone rounded p-4 text-center cursor-pointer ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
          <p className="font-mono text-xs text-ink-muted">
            or{" "}
            <span className="text-ink hover:text-amber transition-colors">
              drop / click to upload a skill file
            </span>{" "}
            — hash computed locally, nothing sent to any server
          </p>
        </div>
      </div>

      {/* Example skills */}
      <div className="space-y-2">
        <p className="font-mono text-xs text-ink-faint">Example skills (demo data):</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {EXAMPLE_HASHES.map(({ label, hash, trusted }) => (
            <button
              key={hash}
              onClick={() => { setInputHash(hash); doSearch(hash); }}
              className="
                text-left p-3 rounded border border-wire hover:border-wire-100
                transition-colors group
              "
            >
              <div className="font-mono text-xs text-ink-muted group-hover:text-ink transition-colors truncate">
                {label}
              </div>
              <div className="font-mono text-xs text-ink-faint truncate mt-0.5">
                {hash.slice(0, 18)}...
              </div>
              <div className={`mt-1.5 font-mono text-xs ${trusted ? "text-signal-trusted" : "text-signal-danger"}`}>
                {trusted ? "● trusted" : "● not attested"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {(trustInfo || isLoading || error) && (
        <div className="border border-wire rounded-lg overflow-hidden">
          {/* Result header */}
          <div className="border-b border-wire bg-void-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink-muted">skill hash</span>
              <span className="font-mono text-xs text-ink break-all">
                {searchHash}
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="p-6 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
              <span className="font-mono text-sm text-ink-muted">Querying trust score...</span>
            </div>
          )}

          {error && (
            <div className="p-6">
              <p className="font-mono text-sm text-signal-danger">{error}</p>
            </div>
          )}

          {trustInfo && !isLoading && (
            <div className="p-6 space-y-8">
              {/* Trust score */}
              <TrustScore info={trustInfo} size="lg" />

              {/* Attestation history */}
              {history.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs text-ink-muted uppercase tracking-widest">
                      Attestation History
                    </h3>
                    <span className="font-mono text-xs text-ink-faint">
                      no auditor identities recorded
                    </span>
                  </div>
                  <div>
                    {history.map((item, i) => (
                      <AttestHistoryItem key={i} quality={item.quality} ts={item.ts} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-wire/50 rounded text-center">
                  <p className="font-mono text-sm text-ink-muted">No attestations found.</p>
                  <p className="font-mono text-xs text-ink-faint mt-1">
                    This skill has not been audited. Install at your own risk.
                  </p>
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center gap-4 pt-2 border-t border-wire">
                <Link
                  href="/audit"
                  className="font-mono text-xs text-amber hover:underline"
                >
                  Attest this skill →
                </Link>
                <span className="font-mono text-xs text-ink-faint">
                  Anonymous. ZK proof. ~15-30 seconds.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* About section */}
      {!trustInfo && !isLoading && !error && (
        <div className="border border-wire rounded-lg p-6 space-y-4">
          <h2 className="font-mono text-sm text-ink">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: "⬡",
                title: "Anonymous attestation",
                body: "Auditors examine skill files and submit ZK attestations. Their identities never appear in public state — only the trust score increments.",
              },
              {
                icon: "⬡",
                title: "Content-addressed",
                body: "Trust scores are keyed to the SHA256 of skill file content. If the file changes, the hash changes — prior attestations no longer apply.",
              },
              {
                icon: "⬡",
                title: "Private credential vault",
                body: "Store API keys and secrets as private notes on Aztec. Grant scoped access to individual skills via AuthWit — never expose your full vault.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="space-y-2">
                <div className="text-amber font-mono text-lg">{icon}</div>
                <h3 className="font-mono text-sm text-ink">{title}</h3>
                <p className="font-mono text-xs text-ink-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
