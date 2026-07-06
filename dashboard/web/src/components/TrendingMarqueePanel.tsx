import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { useLiveTrader } from '../hooks/LiveTraderContext'
import type { TrendingStock } from '../types'

interface TrendingMarqueePanelProps {
  onSelectStock?: (symbol: string) => void
}

export function TrendingMarqueePanel({ onSelectStock }: TrendingMarqueePanelProps) {
  const { setSelectedSymbol } = useLiveTrader()
  const [stocks, setStocks] = useState<TrendingStock[]>([])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/trending-stocks')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setStocks(d.stocks ?? [])
        })
        .catch(() => {
          if (!cancelled) setStocks([])
        })
    }
    load()
    const timer = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const items = stocks.length ? [...stocks, ...stocks] : []

  return (
    <GlassPanel title="Live Ticker" className="h-full" action={<Activity size={14} className="text-desk-loss" />}>
      <div className="relative h-full overflow-hidden">
        {items.length === 0 ? (
          <p className="p-2 text-[10px] text-desk-muted">Loading market tape…</p>
        ) : (
          <div className="marquee-track flex h-full items-center gap-6 whitespace-nowrap px-2 text-[11px]">
            {items.map((s, i) => (
              <button
                key={`${s.symbol}-${i}`}
                type="button"
                onClick={() => {
                  setSelectedSymbol(s.symbol)
                  onSelectStock?.(s.symbol)
                }}
                className="inline-flex shrink-0 items-center gap-2 rounded border border-desk-border/40 px-2 py-0.5 hover:border-desk-info/40"
              >
                <span className="font-semibold text-desk-text">{s.symbol}</span>
                <span className="text-desk-muted">${s.price.toFixed(2)}</span>
                <span className={s.change_pct >= 0 ? 'text-desk-profit' : 'text-desk-loss'}>
                  {s.change_pct >= 0 ? '+' : ''}
                  {s.change_pct.toFixed(2)}%
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  )
}