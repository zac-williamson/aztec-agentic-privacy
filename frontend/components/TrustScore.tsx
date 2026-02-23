"use client";

import { classifyTrust, TRUST_LEVEL_CONFIG, type SkillTrustInfo } from "../lib/types";

interface TrustScoreProps {
  info: SkillTrustInfo;
  showBar?: boolean;
  size?: "sm" | "md" | "lg";
}

/** Maximum score for bar visualization (1000 = 10 attestors at quality 100) */
const MAX_DISPLAY_SCORE = 1000;

export default function TrustScore({ info, showBar = true, size = "md" }: TrustScoreProps) {
  const level = classifyTrust(info.trustScore, info.attestationCount);
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
      {/* Score row */}
      <div className="flex items-end gap-3">
        <span className={`font-mono font-bold ${scoreSize} ${cfg.color} tabular-nums`}>
          {info.trustScore.toString()}
        </span>
        <div className="mb-1 flex flex-col gap-0.5">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className={`font-mono ${labelSize} text-ink-muted`}>
            {info.attestationCount.toString()}{" "}
            {info.attestationCount === 1n ? "auditor" : "auditors"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {showBar && (
        <div className="relative h-1.5 bg-wire rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${cfg.barColor}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── ATTESTATION HISTORY ITEM ─────────────────────────────────────────────────

interface AttestHistoryItemProps {
  quality: number;
  ts: Date;
}

export function AttestHistoryItem({ quality, ts }: AttestHistoryItemProps) {
  const daysAgo = Math.floor((Date.now() - ts.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

  const barWidth = `${quality}%`;
  const color = quality >= 80 ? "bg-signal-trusted" : quality >= 50 ? "bg-signal-caution" : "bg-signal-danger";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-wire/50 last:border-0">
      {/* Quality bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="relative flex-1 h-1 bg-wire rounded-full overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: barWidth }} />
        </div>
        <span className="font-mono text-xs text-ink-muted tabular-nums w-8 text-right">
          {quality}
        </span>
      </div>
      {/* Timestamp */}
      <span className="font-mono text-xs text-ink-faint shrink-0 w-20 text-right">{timeLabel}</span>
    </div>
  );
}
