/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // App-chrome tokens (Dashboard, forms, settings) -- sourced from
        // brand/brand-kit.md. NOT the same as the canvas colors used inside
        // the Card/Carousel editor itself, which are always fixed regardless
        // of app theme (see app-engineer.md "Important distinction").
        bg: '#E7EFEA',
        glow: '#DBF0E2',
        surface: '#FFFFFF',
        ink: '#11221A',
        muted: '#5E7369',
        brand: {
          DEFAULT: '#12A15C',
          strong: '#0A703F',
        },
        line: '#D7EADD',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        control: '12px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};
