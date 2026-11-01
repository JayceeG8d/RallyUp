import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pickle: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#bbf226', // Logo ball neon lime
          500: '#a3e635',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#1a2e05',
        },
        court: {
          darkBg: '#02160f',       // Deepest forest green
          darkCard: '#06261c',     // Card surface
          darkCardHover: '#0b3527',
          darkBorder: '#104433',   // Subtle green border
          darkHeader: '#031f15',
          lightBg: '#f2f7f4',      // Crisp light court bg
          lightCard: '#ffffff',
          lightBorder: '#dae5de',
          navy: '#0b2027',
          blue: '#164e63',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
