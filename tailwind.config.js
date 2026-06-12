/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Web design system tokens (kept as `navy.*` for backward compatibility
        // with the existing component classNames). Values updated to match the
        // GitHub-dark inspired palette: bg #0d1117, card #161b22, accent #00bcd4.
        navy: {
          975: '#08090d', // extra deep for inset wells
          950: '#0d1117', // App background
          900: '#161b22', // Card background
          850: '#1f242c', // Subtle separator / hover surface
          800: '#262d36', // Border on cards
          750: '#3a414b',
          700: '#525a64', // Tertiary text
          100: '#c9d1d9', // Soft secondary text
          50:  '#f0f6fc', // Primary text (white-ish)
        },
        accent: {
          DEFAULT: '#00bcd4', // Cyan/teal
          light:   '#5ce1f0',
          dark:    '#0097a7',
        },
        success: {
          DEFAULT: '#10b981',
          light:   '#d1fae5',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Outfit"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'elder-sm':   '1rem',
        'elder-base': '1.125rem',
        'elder-lg':   '1.375rem',
        'elder-xl':   '1.75rem',
        'elder-2xl':  '2.25rem',
      },
      maxWidth: {
        '8xl': '88rem',
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
  plugins: [],
}
