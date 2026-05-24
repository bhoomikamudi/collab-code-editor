/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        panel: "0 24px 70px rgba(0, 0, 0, 0.38)"
      }
    }
  },
  plugins: []
};
