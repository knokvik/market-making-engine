/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        desk: {
          bg: '#0B0D10',
          panel: '#11141A',
          border: '#1E2430',
          muted: '#6B7280',
          profit: '#00E676',
          loss: '#FF3B5C',
          info: '#3B9EFF',
          warn: '#FFB020',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(59, 158, 255, 0.15)',
        profit: '0 0 12px rgba(0, 230, 118, 0.25)',
        loss: '0 0 12px rgba(255, 59, 92, 0.25)',
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
}