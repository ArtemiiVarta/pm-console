import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

// Design tokens from CLAUDE.md. Values are CSS variables (HSL channels) defined in
// src/index.css so the light/dark themes can swap them via the `dark` class.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '80rem' } },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        surface: token('surface'),
        background: token('background'),
        foreground: token('foreground'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        muted: { DEFAULT: token('muted'), foreground: token('muted') },
        success: { DEFAULT: token('success'), foreground: token('primary-foreground') },
        warning: { DEFAULT: token('warning'), foreground: token('primary-foreground') },
        danger: { DEFAULT: token('danger'), foreground: token('primary-foreground') },
        // shadcn/ui aliases mapped onto the CLAUDE.md tokens
        destructive: { DEFAULT: token('danger'), foreground: token('primary-foreground') },
        card: { DEFAULT: token('surface'), foreground: token('foreground') },
        popover: { DEFAULT: token('surface'), foreground: token('foreground') },
        secondary: { DEFAULT: token('subtle'), foreground: token('foreground') },
        accent: { DEFAULT: token('subtle'), foreground: token('foreground') },
        subtle: token('subtle'),
      },
      borderRadius: {
        xl: '0.75rem',
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config
