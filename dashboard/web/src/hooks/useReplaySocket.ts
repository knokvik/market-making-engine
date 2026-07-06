import { useCallback, useEffect, useRef, useState } from 'react'
import type { BenchmarkData, DataSource, DatasetOption, ReplayFrame, StressLabRow } from '../types'
import { normalizeFrame } from './normalizeFrame'

function wsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/replay`
}

const RECONNECT_MS = 2000
const LIVE_UI_THROTTLE_MS = 100

function closeSocket(ws: WebSocket | null) {
  if (!ws) return
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close()
    return
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.close()
  }
}

export function useReplaySocket() {
  const [frame, setFrame] = useState<ReplayFrame | null>(null)
  const [connected, setConnected] = useState(false)
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  const [dataSources, setDataSources] = useState<{ historical: DataSource[]; paper: DataSource[]; live: DataSource[] }>({ historical: [], paper: [], live: [] })
  const [stressResults, setStressResults] = useState<StressLabRow[]>([])
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [stressLoading, setStressLoading] = useState(false)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveThrottleRef = useRef({ lastEmit: 0, timer: null as ReturnType<typeof setTimeout> | null, pending: null as ReplayFrame | null })

  const send = useCallback((payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const control = useCallback(
    (action: string, extra: Record<string, unknown> = {}) => {
      send({ action, ...extra })
    },
    [send],
  )

  const configure = useCallback(
    (config: Record<string, unknown>) => {
      send({ action: 'configure', config })
    },
    [send],
  )

  const fetchStressLab = useCallback(() => {
    setStressLoading(true)
    fetch('/api/stress-lab')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setStressResults(data.results ?? []))
      .catch(() => setStressResults([]))
      .finally(() => setStressLoading(false))
  }, [])

  const fetchBenchmark = useCallback(() => {
    setBenchmarkLoading(true)
    fetch('/api/benchmark')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setBenchmark(data))
      .catch(() => setBenchmark(null))
      .finally(() => setBenchmarkLoading(false))
  }, [])

  const fetchDataSources = useCallback(() => {
    fetch('/api/data-sources')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setDataSources({ historical: data.historical ?? [], paper: data.paper ?? [], live: data.live ?? [] }))
      .catch(() => setDataSources({ historical: [], paper: [], live: [] }))
  }, [])

  useEffect(() => {
    fetch('/api/datasets')
      .then((r) => r.json())
      .then((data) => setDatasets(data.datasets ?? []))
      .catch(() => setDatasets([]))

    fetchDataSources()

    let cancelled = false

    function connect() {
      if (cancelled) return
      const ws = new WebSocket(wsUrl())
      socketRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setConnected(true)
      }

      ws.onclose = () => {
        setConnected(false)
        if (!cancelled) {
          retryTimerRef.current = setTimeout(connect, RECONNECT_MS)
        }
      }

      ws.onerror = () => {
        setConnected(false)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type !== 'frame') return

          const next = normalizeFrame(data.frame)
          const isLive = Boolean(next?.live_mode || next?.feed_type === 'paper_trading')

          if (isLive) {
            const throttle = liveThrottleRef.current
            throttle.pending = next
            const now = Date.now()
            const elapsed = now - throttle.lastEmit

            const flush = () => {
              throttle.timer = null
              throttle.lastEmit = Date.now()
              if (throttle.pending) setFrame(throttle.pending)
              throttle.pending = null
            }

            if (elapsed >= LIVE_UI_THROTTLE_MS) {
              if (throttle.timer) clearTimeout(throttle.timer)
              flush()
            } else if (!throttle.timer) {
              throttle.timer = setTimeout(flush, LIVE_UI_THROTTLE_MS - elapsed)
            }
            return
          }

          if (next?.playing) {
            setFrame(next)
            return
          }

          setFrame((prev) => {
            if (
              prev &&
              next &&
              !next.playing &&
              next.replay_complete &&
              prev.frame_index === next.frame_index &&
              prev.playing === next.playing
            ) {
              return prev
            }
            return next
          })
        } catch {
          /* ignore malformed frames */
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (liveThrottleRef.current.timer) clearTimeout(liveThrottleRef.current.timer)
      closeSocket(socketRef.current)
      socketRef.current = null
    }
  }, [fetchDataSources])

  return {
    frame,
    connected,
    datasets,
    dataSources,
    stressResults,
    benchmark,
    stressLoading,
    benchmarkLoading,
    control,
    configure,
    fetchStressLab,
    fetchBenchmark,
    fetchDataSources,
  }
}