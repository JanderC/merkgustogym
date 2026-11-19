/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Grafito industrial
        ink: {
          950: '#0B0C0E',
          900: '#111316',
          850: '#16191D',
          800: '#1C2025',
          700: '#262B32',
          600: '#333A43',
          500: '#4A525D',
        },
        // Acero del logo
        steel: {
          100: '#EEF0F3',
          200: '#D9DDE3',
          300: '#BABFC8',
          400: '#9AA1AC',
          500: '#7B8390',
        },
        // Naranja Merkgusto
        flame: {
          300: '#FFB866',
          400: '#FFA03A',
          500: '#FF8A10',
          600: '#E67400',
          700: '#B85C00',
        },
        ok: '#3DDC97',
        bad: '#FF5A5F',
        warn: '#FFC542',
      },
      fontFamily: {
        display: ['"Archivo Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Manrope Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,138,16,.35), 0 8px 30px -8px rgba(255,138,16,.45)',
        card: '0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px -15px rgba(0,0,0,.6)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        slidein: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
      },
      animation: {
        pop: 'pop .18s ease-out',
        rise: 'rise .25s ease-out both',
        slidein: 'slidein .22s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
