import type { Config } from "tailwindcss";

const organizationBrandPalette = {
  50: "rgb(var(--brand-50) / <alpha-value>)",
  100: "rgb(var(--brand-100) / <alpha-value>)",
  200: "rgb(var(--brand-200) / <alpha-value>)",
  300: "rgb(var(--brand-300) / <alpha-value>)",
  400: "rgb(var(--brand-400) / <alpha-value>)",
  500: "rgb(var(--brand-500) / <alpha-value>)",
  600: "rgb(var(--brand-600) / <alpha-value>)",
  700: "rgb(var(--brand-700) / <alpha-value>)",
  800: "rgb(var(--brand-800) / <alpha-value>)",
  900: "rgb(var(--brand-900) / <alpha-value>)",
  950: "rgb(var(--brand-950) / <alpha-value>)",
  DEFAULT: "rgb(var(--brand-600) / <alpha-value>)",
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: organizationBrandPalette,
        // Legacy screens used several fixed accent palettes. Pointing them to
        // the tenant palette makes every branded surface follow the company
        // color while semantic success, warning, and error colors stay intact.
        purple: organizationBrandPalette,
        violet: organizationBrandPalette,
        indigo: organizationBrandPalette,
        cyan: organizationBrandPalette,
        sky: organizationBrandPalette,
        teal: organizationBrandPalette,
        charcoal: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Sticky note colors
        sticky: {
          yellow: "#fef08a",
          "yellow-dark": "#ca8a04",
          blue: "#bae6fd",
          "blue-dark": "#0284c7",
          green: "#bbf7d0",
          "green-dark": "#16a34a",
          pink: "#fbcfe8",
          "pink-dark": "#db2777",
          purple: "#e9d5ff",
          "purple-dark": "#9333ea",
          orange: "#fed7aa",
          "orange-dark": "#ea580c",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        arabic: ["var(--font-arabic)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
