/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6D28D9',
        accent: '#F59E0B',
      },
      keyframes: {
        pulse_glow: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.03)', opacity: '0.9' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        winner_bounce: {
          '0%, 100%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.3)' },
          '60%': { transform: 'scale(1.15)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(3px)' },
        },
        star_burst: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(1.5) rotate(180deg)', opacity: '0' },
        },
      },
      animation: {
        pulse_glow: 'pulse_glow 2s ease-in-out infinite',
        ripple: 'ripple 0.6s ease-out forwards',
        winner_bounce: 'winner_bounce 0.5s ease-in-out',
        shake: 'shake 0.4s ease-in-out',
        star_burst: 'star_burst 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}
