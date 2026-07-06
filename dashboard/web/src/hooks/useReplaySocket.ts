import { useCallback, useEffect, useRef, useState } from 'react'
import type { DatasetOption, ReplayFrame } from '../types'

function wsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  if (import.meta.env.DEV) return `${proto}://${window.location.host}/ws/replay`
  return `${proto}://${window.location.hostname}:8000/ws/replay`
}

export function useReplaySocket() {
  const [frame, setFrame] = useState<ReplayFrame | null>(null)
  const [connected, setConnected] = useState(false)
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  const socketRef = useRef<WebSocket | null>(null)

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

  useEffect(() => {
    fetch('/api/datasets')
      .then((r) => r.json())
      .then((data) => setDatasets(data.datasets ?? []))
      .catch(() => setDatasets([]))

    const ws = new WebSocket(wsUrl())
    socketRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'frame') {
        setFrame(data.frame)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  return { frame, connected, datasets, control, configure }
}