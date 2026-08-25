/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  // Neutral Manrope + CSS-variable tokens for light/dark.
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        blush: "rgb(var(--color-blush) / <alpha-value>)",
        peach: "rgb(var(--color-peach) / <alpha-value>)",
        lavender: "rgb(var(--color-lavender) / <alpha-value>)",
        mist: "rgb(var(--color-mist) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)",
        plum: "rgb(var(--color-plum) / <alpha-value>)",
        charcoal: "rgb(var(--color-charcoal) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        inner: "var(--shadow-inner)",
      },
    },
  },
  plugins: [],
};
