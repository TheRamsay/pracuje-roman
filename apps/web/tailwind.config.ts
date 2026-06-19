import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#050816",
        panel: "#0d1325",
        panelMuted: "#111a31",
        line: "#21304f",
        text: "#f5f7fb",
        muted: "#92a0bf",
        ok: "#34d399",
        danger: "#f87171",
        accent: "#6ee7f9"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.45)"
      },
      backgroundImage: {
        grid:
          "linear-gradient(to right, rgba(146,160,191,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(146,160,191,0.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
