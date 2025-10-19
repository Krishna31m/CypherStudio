/** @type {import('tailwindcss').Config} */
module.exports = {
  // Ensure Tailwind scans your React component files (.jsx)
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class', // Enables dark mode based on the 'dark' class
  theme: {
    extend: {},
  },
  plugins: [],
}
