/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        rift: {
          bg: '#08090c',
          card: '#0e0f14',
          cardHover: '#15161e',
          border: 'rgba(255,255,255,0.06)',
          borderHover: 'rgba(255,255,255,0.12)',
          accent: '#00b8ff',
          accent2: '#7c3aed',
          accent3: '#00ffa3',
        }
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0,184,255,0.15)' },
          '100%': { boxShadow: '0 0 40px rgba(0,184,255,0.3)' },
        }
      }
    },
  },
  plugins: [],
}
