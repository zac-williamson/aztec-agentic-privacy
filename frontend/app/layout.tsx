import type { Metadata } from "next";
import "./globals.css";
import { IsnadProvider } from "../lib/isnad-context";
import Nav from "../components/Nav";
import { config } from "../lib/config";

export const metadata: Metadata = {
  title: {
    default: config.appName,
    template: `%s — ${config.appName}`,
  },
  description: config.appDescription,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-void text-ink">
      <body className="min-h-screen flex flex-col">
        <IsnadProvider>
          <Nav />
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-wire mt-auto">
            <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
              <span className="font-mono text-xs text-ink-faint">
                The Isnad Chain — private by default. verifiable by proof. owned by no one.
              </span>
              <span className="font-mono text-xs text-ink-faint">
                {config.version} · Aztec devnet
              </span>
            </div>
          </footer>
        </IsnadProvider>
      </body>
    </html>
  );
}
