import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E85D04",
          light: "#FF7A2F",
          dark: "#C44D00",
          50: "#FFF4EE",
          100: "#FFE4CC",
          200: "#FFC499",
          500: "#E85D04",
          600: "#C44D00",
          700: "#9A3D00",
        },
        surface: {
          DEFAULT: "#FAFAFA",
          card: "#FFFFFF",
          subtle: "#F4F4F5",
          muted: "#E4E4E7",
        },
        ink: {
          DEFAULT: "#111111",
          secondary: "#52525B",
          muted: "#A1A1AA",
          disabled: "#D4D4D8",
        },
        nutri: {
          bg: "#111111",
          sidebar: "#18181B",
          border: "#27272A",
          text: "#FAFAFA",
          muted: "#A1A1AA",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "12px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08)",
        brand: "0 4px 14px rgba(232,93,4,0.3)",
      },
      animation: {
        "ring-fill": "ring-fill 1s ease-out forwards",
        "fade-up": "fade-up 0.3s ease-out",
        "pulse-brand": "pulse-brand 2s ease-in-out infinite",
        "rank-pulse": "rank-pulse 2.5s ease-in-out infinite",
      },
      keyframes: {
        "ring-fill": {
          "0%": { "stroke-dashoffset": "var(--circumference)" },
          "100%": { "stroke-dashoffset": "var(--offset)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-brand": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "rank-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
