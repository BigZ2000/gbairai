/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fond
        base:    '#0F0A1E',
        surface: '#1A1035',
        card:    '#221445',
        border:  'rgba(255,255,255,0.07)',
        // Accents
        violet:  { DEFAULT: '#7C3AED', light: '#A855F7', glow: 'rgba(124,58,237,0.35)' },
        gold:    { DEFAULT: '#F59E0B', light: '#FBBF24', soft: 'rgba(245,158,11,0.15)' },
        emerald: { DEFAULT: '#10B981', soft: 'rgba(16,185,129,0.15)' },
        rose:    { DEFAULT: '#F43F5E', soft: 'rgba(244,63,94,0.15)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        violet: '0 0 24px rgba(124,58,237,0.4)',
        gold:   '0 0 24px rgba(245,158,11,0.35)',
        card:   '0 4px 24px rgba(0,0,0,0.4)',
        inset:  'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        pulse_glow: {
          '0%,100%': { transform: 'scale(1)',    opacity: '1'   },
          '50%':     { transform: 'scale(1.03)', opacity: '0.9' },
        },
        ripple: {
          '0%':   { transform: 'scale(0)',   opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0'   },
        },
        winner_bounce: {
          '0%,100%': { transform: 'scale(1)'    },
          '40%':     { transform: 'scale(1.3)'  },
          '60%':     { transform: 'scale(1.15)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)'  },
          '20%':     { transform: 'translateX(-4px)' },
          '40%':     { transform: 'translateX(4px)'  },
          '60%':     { transform: 'translateX(-3px)' },
          '80%':     { transform: 'translateX(3px)'  },
        },
        star_burst: {
          '0%':   { transform: 'scale(0) rotate(0deg)',   opacity: '1' },
          '100%': { transform: 'scale(1.5) rotate(180deg)', opacity: '0' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'   },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0'  },
        },
      },
      animation: {
        pulse_glow:    'pulse_glow 2s ease-in-out infinite',
        ripple:        'ripple 0.6s ease-out forwards',
        winner_bounce: 'winner_bounce 0.5s ease-in-out',
        shake:         'shake 0.4s ease-in-out',
        star_burst:    'star_burst 0.8s ease-out forwards',
        fadeIn:        'fadeIn 0.3s ease-out',
        shimmer:       'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}
