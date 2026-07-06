/** Format latency values for workstation displays — no raw float noise. */
export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms === 0) return '0'
  if (ms < 0.01) return `${Math.round(ms * 1000)}µs`
  if (ms < 1) return `${Math.round(ms * 1000)}µs`
  if (ms < 10) return `${ms.toFixed(2)}ms`
  return `${ms.toFixed(1)}ms`
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}

export function latencyStats(values: number[]) {
  if (!values.length) {
    return { current: 0, avg: 0, min: 0, max: 0, p95: 0 }
  }
  const current = values[values.length - 1]
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    current,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    p95: percentile(values, 95),
  }
}

export function niceAxisMax(maxVal: number): number {
  if (maxVal <= 0) return 1
  const padded = maxVal * 1.18
  if (padded < 0.1) return Math.ceil(padded * 1000) / 1000
  if (padded < 1) return Math.ceil(padded * 100) / 100
  if (padded < 10) return Math.ceil(padded * 10) / 10
  return Math.ceil(padded)
}