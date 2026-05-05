/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f5f5f7',
          100: '#e6e6ea',
          200: '#c7c7cf',
          300: '#9c9ca9',
          400: '#62626f',
          500: '#3a3a48',
          600: '#262635',
          700: '#1f1f2c',
          800: '#1a1a2e',
          900: '#11111e',
        },
        gold: {
          50:  '#fdf8e7',
          100: '#fbeec0',
          200: '#f5dc88',
          300: '#eac651',
          400: '#dfb12f',
          500: '#d4a017',  // brand gold
          600: '#a87f10',
          700: '#825f10',
          800: '#664a14',
          900: '#553e16',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
        display: ['Manrope', 'Inter', 'Arial', 'sans-serif'],
        print: ['"Arial Narrow"', 'Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
