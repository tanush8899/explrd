/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Mirrors lib/theme.ts so className usage stays in sync with StyleSheet tokens.
      colors: {
        ink: "#0b0c0e",
        inkSecondary: "#3c3c43",
        muted: "#8e8e93",
        hairline: "#e5e5ea",
        surface: "#f2f2f7",
        fill: "#f2f2f7",
        card: "#ffffff",
        blue: "#007aff",
        gold: "#ecd393",
        danger: "#ff3b30",
        success: "#34c759",
      },
      borderRadius: {
        sheet: "44px",
      },
    },
  },
  plugins: [],
};
