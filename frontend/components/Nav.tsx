"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsnad } from "../lib/isnad-context";

const NAV_LINKS = [
  { href: "/", label: "Trust Browser" },
  { href: "/audit", label: "Audit" },
  { href: "/vault", label: "Vault" },
];

export default function Nav() {
  const pathname = usePathname();
  const { isConnected, displayAddress, connect, disconnect, isConnecting } = useIsnad();

  return (
    <header className="border-b border-wire sticky top-0 bg-void/95 backdrop-blur z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-2 shrink-0">
          <span className="text-amber font-mono text-xs tracking-widest opacity-70">⬡</span>
          <span className="font-mono text-sm text-ink font-medium tracking-tight">
            isnad
            <span className="text-amber">.</span>
            chain
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`
                  px-3 py-1.5 rounded text-xs font-mono transition-colors
                  ${active
                    ? "text-ink bg-wire-50"
                    : "text-ink-muted hover:text-ink hover:bg-void-300"
                  }
                `}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3 shrink-0">
          {isConnected && displayAddress ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-trusted animate-pulse" />
                <span className="font-mono text-xs text-ink-muted">{displayAddress}</span>
              </div>
              <button
                onClick={disconnect}
                className="text-xs text-ink-muted hover:text-ink-muted/60 transition-colors font-mono"
              >
                disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="
                px-3 py-1.5 rounded border border-wire-50 text-xs font-mono
                text-ink-muted hover:border-amber hover:text-amber
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isConnecting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                  connecting
                </span>
              ) : (
                "connect wallet"
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
