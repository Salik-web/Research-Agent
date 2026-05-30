import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Maroon + Beige palette (raw)
        "maroon-dark": "#62191C",
        maroon: "#873632",
        taupe: "#9E7161",
        beige: "#CAAE9F",
        "beige-light": "#E0CFC2",

        // Semantic surfaces (light beige theme)
        surface: {
          DEFAULT: "#E0CFC2", // beige — main background
          raised: "#F2EAE3", // light cream — cards / assistant bubbles
          sidebar: "#D4C0B1", // slightly deeper beige — sidebar
          border: "#BFA593", // visible border on beige
        },
        // Text ("ink") — dark, readable on beige
        ink: {
          DEFAULT: "#3A211B", // primary text (dark brown)
          muted: "#7A5848", // secondary / muted text
        },
        // Maroon accent
        accent: {
          DEFAULT: "#873632", // maroon — primary actions / avatars
          dark: "#62191C", // maroon-dark — hover / user bubble
          fg: "#F5ECE5", // text on accent
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "cursor-blink": "cursor-blink 1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
