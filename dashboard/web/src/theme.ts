/**
 * Palette: #141414 #1B1B1B #333333 #44FF89
 * Green = profit / bid / LIVE only. Red = loss / ask. Blue-grey = info/neutral.
 */
export const THEME = {
  bg: '#141414',
  panel: '#1B1B1B',
  panelHover: '#222222',
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
  chart: {
    grid: '#333333',
    axis: '#888888',
    mid: '#7A8FA8',
    pnl: '#44FF89',
    bid: '#44FF89',
    ask: '#FF4D6A',
    sharpe: '#888888',
    secondary: '#555555',
    tooltipBg: '#1B1B1B',
    tooltipBorder: '#333333',
    heatmap: ['#141414', '#1B1B1B', '#3A2A2A', '#FF4D6A', '#44FF89'],
    bars: ['#7A8FA8', '#888888', '#555555', '#FF8A00', '#FF4D6A'],
  },
} as const