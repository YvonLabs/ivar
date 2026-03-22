/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#1B2A4A',
          800: '#243660',
          700: '#2D4275',
        },
        accent: '#2D6BE4',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
}
