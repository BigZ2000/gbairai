/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#0E0E12',
        surface:      '#141418',
        card:         '#1C1C22',
        'card-hover': '#222228',
        stroke:       'rgba(255,255,255,0.07)',
        'stroke-strong': 'rgba(255,255,255,0.12)',
        t1: '#ECECF0',
        t2: '#9090A0',
        t3: '#5A5A6E',
        indigo: {
          DEFAULT: '#6366F1',
          hover:   '#4F46E5',
          light:   '#818CF8',
          subtle:  'rgba(99,102,241,0.12)',
          glow:    'rgba(99,102,241,0.35)',
        },
        green:  { DEFAULT: '#22C55E', subtle: 'rgba(34,197,94,0.12)'  },
        amber:  { DEFAULT: '#F59E0B', subtle: 'rgba(245,158,11,0.12)' },
        red:    { DEFAULT: '#EF4444', subtle: 'rgba(239,68,68,0.12)'  },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        xs:           '0 1px 2px rgba(0,0,0,0.3)',
        sm:           '0 2px 8px rgba(0,0,0,0.4)',
        md:           '0 4px 16px rgba(0,0,0,0.5)',
        lg:           '0 8px 32px rgba(0,0,0,0.6)',
        indigo:       '0 0 0 3px rgba(99,102,241,0.25)',
        'indigo-glow':'0 4px 24px rgba(99,102,241,0.35)',
        'green-glow': '0 4px 20px rgba(34,197,94,0.3)',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'   },
        },
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)'    },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0'  },
        },
        pulse_glow: {
          '0%,100%': { transform: 'scale(1)',    opacity: '1'    },
          '50%':     { transform: 'scale(1.04)', opacity: '0.85' },
        },
        ripple: {
          '0%':   { transform: 'scale(0)',   opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0'   },
        },
        winner_bounce: {
          '0%,100%': { transform: 'scale(1)'    },
          '40%':     { transform: 'scale(1.25)' },
          '60%':     { transform: 'scale(1.1)'  },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)'   },
          '20%':     { transform: 'translateX(-4px)' },
          '40%':     { transform: 'translateX(4px)'  },
          '60%':     { transform: 'translateX(-3px)' },
          '80%':     { transform: 'translateX(3px)'  },
        },
      },
      animation: {
        fadeUp:        'fadeUp 0.25s ease-out',
        fadeIn:        'fadeIn 0.2s ease-out',
        scaleIn:       'scaleIn 0.2s ease-out',
        shimmer:       'shimmer 1.5s linear infinite',
        pulse_glow:    'pulse_glow 2s ease-in-out infinite',
        ripple:        'ripple 0.6s ease-out forwards',
        winner_bounce: 'winner_bounce 0.5s ease-in-out',
        shake:         'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
}
