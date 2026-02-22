/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ilayaraja: {
          bg: '#1a1510',
          card: '#2d2419',
          accent: '#c9a227',
          muted: '#8b7355',
          gold: '#d4af37',
        },
        arrahman: {
          bg: '#0a1219',
          card: '#0f1c28',
          accent: '#0d9488',
          muted: '#5eead4',
          teal: '#14b8a6',
        },
      },
      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
