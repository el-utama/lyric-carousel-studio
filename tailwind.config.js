/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0B',
        panel: '#141414',
        panelSoft: '#191919',
        hairline: '#2A2A2A',
        paper: '#F5F0E8',
        muted: '#8F897E',
        accent: '#E07A5F',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.25em',
      },
    },
  },
  plugins: [],
};
