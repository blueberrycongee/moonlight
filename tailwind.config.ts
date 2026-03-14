import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0071e3",
          hover: "#0051a2",
        },
        surface: {
          dark: "#1d1d1f",
          light: "#fbfbfd",
        },
        border: {
          DEFAULT: "#e5e5e7",
        },
        text: {
          primary: "#1d1d1f",
          secondary: "#6e6e73",
          inverse: "#f5f5f7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
