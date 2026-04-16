/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#111214",
        muted: "#868c94",
        surface: "#f7f8f9",
        card: "#fafbfc",
      },
    },
  },
  plugins: [],
};
