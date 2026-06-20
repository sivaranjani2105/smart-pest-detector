/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agrogreen: {
          50: '#f2f9f4',
          100: '#e1f0e4',
          200: '#c5e2cb',
          300: '#9ccaab',
          400: '#6eac82',
          500: '#4c9062',
          600: '#3a754e',
          700: '#305e40',
          800: '#274b34',
          900: '#213f2d',
          950: '#0b1610',
        },
        slateblack: {
          50: '#f6f8f6',
          100: '#eef2ee',
          200: '#dbe3dc',
          300: '#bdccc0',
          400: '#97ab9b',
          500: '#758c7a',
          600: '#5c7261',
          700: '#4a5b4e',
          800: '#3d4c41',
          900: '#344037',
          950: '#0e1310',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(76, 144, 98, 0.2)',
      }
    },
  },
  plugins: [],
}
