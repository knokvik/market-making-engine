/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        desk: {
          bg: '#141414',
          panel: '#1B1B1B',
          'panel-hover': '#222222',
          border: '#333333',
          text: '#E6E6E6',
          muted: '#888888',
          profit: '#44FF89',
          bid: '#44FF89',
          loss: '#FF4D6A',
          ask: '#FF4D6A',
          warn: '#FF8A00',
          info: '#7A8FA8',
          cyan: '#5BA4B8',
          purple: '#9B7FD4',
        },
      },
      fontFamily: {
        sans: ['SF Mono', 'Space Mono', 'ui-monospace', 'monospace'],
        mono: ['SF Mono', 'Space Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 3px rgba(0, 0, 0, 0.35)',
      },
      borderRadius: {
        panel: '6px',
      },
    },
  },
  plugins: [],
}