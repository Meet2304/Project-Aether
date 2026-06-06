import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme palette from the design requirements.
        background: "#0a0a0a",
        surface: "#1a1a1a",
        accent: "#3B82F6",
        marker: {
          in: "#22c55e", // green IN marker
          out: "#ef4444", // red OUT marker
        },
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.85)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        toastIn: {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1s ease-in-out infinite",
        slideUp: "slideUp 0.25s ease-out",
        toastIn: "toastIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
