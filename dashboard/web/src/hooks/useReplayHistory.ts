import { useCallback, useEffect, useState } from 'react'
import type { ReplayFrame } from '../types'

const HISTORY_KEY = 'mm-engine-replay-history'

export interface ReplayHistoryEntry {
  dataset_name: string
  exchange: string
  symbol: string
  total_pnl: number
  fill_count: number
  sharpe_ratio: number | null
  progress_pct: number
  replay_time_display: string
  saved_at: string
}

export function useReplayHistory(frame: ReplayFrame | null, deskMode: string) {
  const [history, setHistory] = useState<ReplayHistoryEntry | null>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      return raw ? (JSON.parse(raw) as ReplayHistoryEntry) : null
    } catch {
      return null
    }
  })

  const saveHistory = useCallback((f: ReplayFrame) => {
    if (f.feed_type !== 'historical_replay' && !f.dataset_name) return
    const entry: ReplayHistoryEntry = {
      dataset_name: f.dataset_name || 'Replay session',
      exchange: f.exchange,
      symbol: f.symbol,
      total_pnl: f.total_pnl,
      fill_count: f.fill_count,
      sharpe_ratio: f.sharpe_ratio,
      progress_pct: f.progress_pct,
      replay_time_display: f.replay_time_display,
      saved_at: new Date().toISOString(),
    }
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entry))
      setHistory(entry)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (deskMode !== 'replay' || !frame) return
    if (frame.progress_pct >= 5 || frame.fill_count > 0 || frame.frame_index > 0) {
      saveHistory(frame)
    }
  }, [deskMode, frame, saveHistory])

  const isFreshSession =
    deskMode === 'replay' &&
    frame != null &&
    frame.frame_index <= 1 &&
    frame.progress_pct < 2 &&
    frame.fill_count === 0

  return { history, isFreshSession }
}