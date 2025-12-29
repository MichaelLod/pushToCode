import type { Config } from "tailwindcss";

/**
 * Tailwind CSS v4 Configuration
 *
 * Note: Tailwind v4 uses CSS-based configuration via @theme directive in globals.css
 * This file is provided for tooling compatibility (IDE extensions, etc.)
 * The actual design tokens are defined in src/app/globals.css
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // iOS Terminal Theme colors (reference only - actual config in globals.css)
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        success: "var(--status-success)",
        error: "var(--status-error)",
        warning: "var(--status-warning)",
        info: "var(--status-info)",
        border: "var(--border)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
