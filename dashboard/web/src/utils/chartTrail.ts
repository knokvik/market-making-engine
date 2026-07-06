import type { ChartHistoryBar, LiveChartRange, ReplayFrame } from '../types'

export const SYMBOL_BASE_PRICE: Record<string, number> = {
  NVDA: 195,
  AAPL: 228,
  MSFT: 420,
  GOOGL: 175,
  TSLA: 342,
  AMZN: 205,
  META: 590,
  SPY: 595,
  BTCUSDT: 67000,
  ETHUSDT: 3500,
}

export type TrailPoint = {
  timestamp: number
  mid: number
  bid: number
  ask: number
  reservation: number
  open?: number
  high?: number
  low?: number
  close?: number
}

/** Backend may send ns (live feed), ms (replay), or seconds — normalize for JS Date. */
export function normalizeTimestampMs(ts: number): number {
  if (!Number.isFinite(ts) || ts <= 0) return Date.now()
  if (ts >= 1e16) return ts / 1e6
  if (ts < 1e11) return ts * 1000
  return ts
}

export function formatTrailTime(ts: number): string {
  const ms = normalizeTimestampMs(ts)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatChartAxisLabel(range: LiveChartRange, ts: number): string {
  const ms = normalizeTimestampMs(ts)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  if (range === '1D' || range === '5D') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (range === '1M' || range === '3M' || range === '6M') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString([], { month: 'short', year: '2-digit' })
}

export function historyBarsToTrail(bars: ChartHistoryBar[]): TrailPoint[] {
  return bars.map((b) => ({
    timestamp: normalizeTimestampMs(b.timestamp),
    mid: b.close,
    bid: b.low,
    ask: b.high,
    reservation: b.close,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }))
}

export function appendLiveMid(trail: TrailPoint[], mid: number, bid?: number, ask?: number): TrailPoint[] {
  if (!Number.isFinite(mid)) return trail
  const now = Date.now()
  const half = (ask && bid ? (ask - bid) / 2 : mid * 0.00015)
  const point: TrailPoint = {
    timestamp: now,
    mid,
    bid: bid ?? mid - half,
    ask: ask ?? mid + half,
    reservation: mid,
  }
  if (!trail.length) return [point]
  const last = trail[trail.length - 1]
  if (now - last.timestamp < 30_000) {
    return [...trail.slice(0, -1), { ...point, timestamp: last.timestamp }]
  }
  return [...trail, point]
}

/** Static sample curve for replay idle — not live data */
export function buildReplayDemoTrail(points = 48, basePrice = 100): TrailPoint[] {
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    const t = now - (points - i) * 60_000
    const wave = Math.sin(i / 5) * 1.2 + Math.cos(i / 9) * 0.6
    const trend = i * 0.04
    const mid = basePrice + wave + trend
    const half = mid * 0.0004
    return {
      timestamp: t,
      mid,
      bid: mid - half,
      ask: mid + half,
      reservation: mid - half * 0.3,
    }
  })
}

/** Extend sparse live/paper trail so chart always has lines */
export function buildLiveFallbackTrail(frame: ReplayFrame, minPoints = 20): TrailPoint[] {
  const existing = frame.quote_trail ?? []
  if (existing.length >= 2) {
    return existing.map((p) => ({
      timestamp: normalizeTimestampMs(p.timestamp),
      mid: p.mid,
      bid: p.bid,
      ask: p.ask,
      reservation: p.reservation,
    }))
  }

  const mid =
    frame.mid_price ??
    frame.best_bid ??
    frame.best_ask ??
    SYMBOL_BASE_PRICE[frame.symbol] ??
    130

  const spread = frame.spread ?? mid * 0.0003
  const half = spread / 2
  const anchor = normalizeTimestampMs(frame.timestamp) || Date.now()

  if (existing.length === 1) {
    const p = existing[0]
    return Array.from({ length: minPoints }, (_, i) => ({
      timestamp: anchor - (minPoints - 1 - i) * 800,
      mid: p.mid,
      bid: p.bid,
      ask: p.ask,
      reservation: p.reservation,
    }))
  }

  return Array.from({ length: minPoints }, (_, i) => ({
    timestamp: anchor - (minPoints - 1 - i) * 800,
    mid,
    bid: mid - half,
    ask: mid + half,
    reservation: mid,
  }))
}

export function resolveChartTrail(
  frame: ReplayFrame | null,
  opts: { priceFocus?: boolean; symbol?: string; historyBars?: ChartHistoryBar[] },
): TrailPoint[] {
  if (opts.historyBars && opts.historyBars.length > 0) {
    let points = historyBarsToTrail(opts.historyBars)
    if (frame?.mid_price != null) {
      points = appendLiveMid(
        points,
        frame.mid_price,
        frame.best_bid ?? undefined,
        frame.best_ask ?? undefined,
      )
    }
    return points
  }

  if (opts.priceFocus || frame?.live_mode || frame?.feed_type === 'paper_trading') {
    if (!frame) return []
    const live = buildLiveFallbackTrail(frame)
    return live.length >= 2 ? live : []
  }

  if (!frame) return []
  if (frame.frame_index < 0) return []

  const trail = (frame.quote_trail ?? []).map((p) => ({
    timestamp: p.timestamp,
    mid: p.mid,
    bid: p.bid,
    ask: p.ask,
    reservation: p.reservation,
  }))

  return trail
}