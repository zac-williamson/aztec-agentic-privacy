import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base palette — terminal / hacker aesthetic
        void: {
          DEFAULT: "#080808",
          50: "#0f0f0f",
          100: "#111111",
          200: "#161616",
          300: "#1c1c1c",
        },
        wire: {
          DEFAULT: "#222222",
          50: "#2a2a2a",
          100: "#333333",
          200: "#444444",
          300: "#555555",
        },
        ink: {
          DEFAULT: "#e5e5e5",
          muted: "#888888",
          faint: "#444444",
        },
        // Trust signal colors
        signal: {
          trusted: "#22c55e",
          "trusted-dim": "#15803d",
          caution: "#f59e0b",
          "caution-dim": "#92400e",
          danger: "#ef4444",
          "danger-dim": "#991b1b",
          neutral: "#6b7280",
        },
        // Accent
        amber: {
          DEFAULT: "#f59e0b",
          dim: "#78350f",
          glow: "rgba(245,158,11,0.12)",
        },
      },
      fontFamily: {
        mono: [
          "Berkeley Mono",
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan": "scan 2s linear infinite",
        "flicker": "flicker 4s ease-in-out infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.8" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.9" },
          "97%": { opacity: "1" },
        },
      },
      boxShadow: {
        "glow-amber": "0 0 20px rgba(245,158,11,0.15)",
        "glow-green": "0 0 20px rgba(34,197,94,0.15)",
        "glow-red": "0 0 20px rgba(239,68,68,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
