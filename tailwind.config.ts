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
        ink:           "#1A1F2E",
        canvas:        "#F8F6F1",
        surface:       "#FFFFFF",
        accent:        "#0F4C81",
        profit:        "#1D9E75",
        loss:          "#C0392B",
        muted:         "#888780",
        border:        "#E5E2D9",
        "border-strong": "#D3D1C7",
      },
      fontFamily: {
        sans:    ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        display: ["var(--font-dm-serif)", "DM Serif Display", "Georgia", "serif"],
        mono:    ["var(--font-dm-mono)", "DM Mono", "Courier New", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4", letterSpacing: "0.06em" }],
        xs:    ["11px", { lineHeight: "1.5" }],
        sm:    ["13px", { lineHeight: "1.6" }],
        base:  ["14px", { lineHeight: "1.7" }],
        md:    ["15px", { lineHeight: "1.4" }],
        lg:    ["20px", { lineHeight: "1.3" }],
        xl:    ["28px", { lineHeight: "1.2" }],
        "2xl": ["40px", { lineHeight: "1.1" }],
      },
      fontWeight: {
        // Enforce max weight 500 per spec
        normal: "400",
        medium: "500",
      },
      borderRadius: {
        sm:   "4px",
        md:   "6px",
        DEFAULT: "8px",
        lg:   "10px",
        xl:   "12px",
      },
      borderWidth: {
        DEFAULT: "0.5px",
        "1":     "1px",
      },
      spacing: {
        "4.5": "18px",
        "13":  "52px",  // nav height
        "15":  "60px",
        "18":  "72px",
        "22":  "88px",
      },
      maxWidth: {
        page: "1200px",
        narrow: "820px",
      },
      boxShadow: {
        card:   "0 2px 12px rgba(26,31,46,.06)",
        sm:     "0 1px 3px rgba(26,31,46,.04)",
        focus:  "0 0 0 3px rgba(15,76,129,.10)",
        "focus-danger": "0 0 0 3px rgba(192,57,43,.10)",
      },
    },
  },
  plugins: [],
};

export default config;
