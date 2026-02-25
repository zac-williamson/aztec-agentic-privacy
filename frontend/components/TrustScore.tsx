"use client";

import { classifyTrust, TRUST_LEVEL_CONFIG, type AttestationEvent, type SkillTrustInfo } from "../lib/types";

interface TrustScoreProps {
  info: SkillTrustInfo;
  showBar?: boolean;
  size?: "sm" | "md" | "lg";
}

/** Maximum score for bar visualization (1000 = 10 attestors at quality 100) */
const MAX_DISPLAY_SCORE = 1000;

export default function TrustScore({ info, showBar = true, size = "md" }: TrustScoreProps) {
  const level = classifyTrust(info.trustScore, info.attestationCount, info.isQuarantined);
  const cfg = TRUST_LEVEL_CONFIG[level];
  const barPercent = Math.min(100, Number(info.trustScore) / MAX_DISPLAY_SCORE * 100);

  const scoreSize = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-5xl",
  }[size];

  const labelSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  return (
    <div className="space-y-3">
      {/* Quarantine alert banner */}
      {info.isQuarantined && (
        <div className="flex items-start gap-3 px-4 py-3 rounded border border-signal-danger bg-signal-danger/5">
          <span className="font-mono text-signal-danger text-lg leading-none shrink-0 mt-0.5">⚠</span>
          <div className="space-y-1">
            <div className="font-mono text-sm font-bold text-signal-danger uppercase tracking-wider">
              Quarantined — Do Not Install
            </div>
            <p className="font-mono text-xs text-signal-danger/80 leading-relaxed">
              This skill has been flagged as known-malicious by the registry admin and quarantined.
              The trust score is suppressed to zero regardless of any attestations on record.
              {info.attestationCount > 0n && (
                <> The {info.attestationCount.toString()} attestation{info.attestationCount === 1n ? "" : "s"} on record
                may be from Sybil accounts — treat them as suspicious.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Score row */}
      <div className="flex items-end gap-3">
        <span className={`font-mono font-bold ${scoreSize} ${cfg.color} tabular-nums`}>
          {info.isQuarantined ? "0" : info.trustScore.toString()}
          {info.isQuarantined && (
            <span className="font-mono text-base text-signal-danger/60 ml-2 align-middle">suppressed</span>
          )}
        </span>
        <div className="mb-1 flex flex-col gap-0.5">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className={`font-mono ${labelSize} text-ink-muted`}>
            {info.attestationCount.toString()}{" "}
            {info.attestationCount === 1n ? "auditor" : "auditors"}
            {info.isQuarantined && (
              <span className="text-signal-danger/60"> (score suppressed)</span>
            )}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {showBar && !info.isQuarantined && (
        <div className="relative h-1.5 bg-wire rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${cfg.barColor}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}

      {/* Quarantine bar — full red */}
      {showBar && info.isQuarantined && (
        <div className="relative h-1.5 bg-signal-danger/20 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-signal-danger" />
        </div>
      )}
    </div>
  );
}

// ─── ATTESTATION HISTORY ITEM ─────────────────────────────────────────────────

interface AttestHistoryItemProps {
  event: AttestationEvent;
}

export function AttestHistoryItem({ event }: AttestHistoryItemProps) {
  const { quality, ts, type } = event;
  const daysAgo = Math.floor((Date.now() - ts.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

  const isRevoke = type === "revoke";

  const barWidth = `${quality}%`;
  const color = isRevoke
    ? "bg-signal-danger"
    : quality >= 80
    ? "bg-signal-trusted"
    : quality >= 50
    ? "bg-signal-caution"
    : "bg-signal-danger";

  return (
    <div className={`flex items-center gap-3 py-2 border-b border-wire/50 last:border-0 ${isRevoke ? "opacity-60" : ""}`}>
      {/* Revoke indicator */}
      {isRevoke ? (
        <span className="font-mono text-xs text-signal-danger shrink-0 w-4 text-center">✕</span>
      ) : (
        <span className="font-mono text-xs text-signal-trusted shrink-0 w-4 text-center">+</span>
      )}

      {/* Quality bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className={`relative flex-1 h-1 rounded-full overflow-hidden ${isRevoke ? "bg-signal-danger/20" : "bg-wire"}`}>
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${color} ${isRevoke ? "opacity-50" : ""}`}
            style={{ width: barWidth }}
          />
        </div>
        <span className={`font-mono text-xs tabular-nums w-8 text-right ${isRevoke ? "text-signal-danger line-through" : "text-ink-muted"}`}>
          {quality}
        </span>
      </div>

      {/* Event type label */}
      <span className={`font-mono text-xs shrink-0 w-16 text-right ${isRevoke ? "text-signal-danger" : "text-ink-faint"}`}>
        {isRevoke ? "revoked" : "attested"}
      </span>

      {/* Timestamp */}
      <span className="font-mono text-xs text-ink-faint shrink-0 w-20 text-right">{timeLabel}</span>
    </div>
  );
}
