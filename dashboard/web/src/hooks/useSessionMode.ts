import { useMemo } from 'react'
import type { DataMode, ReplayFrame } from '../types'

export function useSessionMode(frame: ReplayFrame | null): DataMode {
  return useMemo(() => {
    if (!frame) return 'replay'
    if (frame.live_mode) return 'live'
    if (frame.feed_type === 'paper_trading') return 'paper'
    return 'replay'
  }, [frame?.live_mode, frame?.feed_type])
}

export function isLiveSession(mode: DataMode): boolean {
  return mode === 'live' || mode === 'paper'
}