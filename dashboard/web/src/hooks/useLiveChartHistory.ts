import { useEffect, useState } from 'react'
import type { ChartHistoryBar, LiveChartRange } from '../types'

export function useLiveChartHistory(
  symbol: string,
  assetClass: 'stock' | 'crypto',
  range: LiveChartRange,
) {
  const [bars, setBars] = useState<ChartHistoryBar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!symbol) {
      setBars([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      symbol,
      asset_class: assetClass,
      range,
    })

    fetch(`/api/chart-history?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setBars(data.bars ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setBars([])
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, assetClass, range])

  return { bars, loading, error }
}