import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { useLiveTrader } from '../hooks/LiveTraderContext'
import type { TrendingStock } from '../types'

interface TrendingStocksPanelProps {
  onSelectStock?: (symbol: string) => void
}

export function TrendingStocksPanel({ onSelectStock }: TrendingStocksPanelProps) {
  const { selectedSymbol, setSelectedSymbol, setAssetClass, setPickerOpen } = useLiveTrader()
  const [stocks, setStocks] = useState<TrendingStock[]>([])
  const [loading, setLoading] = useState(true)

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
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    load()
    const timer = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const handleSelect = (symbol: string) => {
    setSelectedSymbol(symbol)
    setAssetClass('stock')
    onSelectStock?.(symbol)
  }

  const openPicker = () => setPickerOpen(true)

  return (
    <GlassPanel
      title="Trending US Stocks"
      className="h-full"
      action={
        <button
          type="button"
          onClick={openPicker}
          className="flex items-center gap-1 rounded border border-desk-border px-1.5 py-0.5 text-[9px] uppercase text-desk-info hover:border-desk-info/40"
        >
          <Search size={10} /> Symbol
        </button>
      }
    >
      <div className="h-full overflow-auto p-2">
        {loading && <p className="text-[10px] text-desk-muted">Loading movers…</p>}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-4">
          {stocks.map((s) => {
            const active = selectedSymbol === s.symbol
            return (
              <button
                key={s.symbol}
                type="button"
                onClick={() => handleSelect(s.symbol)}
                className={`rounded border px-2 py-2 text-left text-[10px] transition ${
                  active
                    ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                    : 'border-desk-border/40 text-desk-muted hover:border-desk-border hover:text-desk-text'
                }`}
              >
                <div className="font-semibold">{s.symbol}</div>
                <div className="text-[9px]">${s.price.toFixed(2)}</div>
                <div className={`text-[9px] ${s.change_pct >= 0 ? 'text-desk-profit' : 'text-desk-loss'}`}>
                  {s.change_pct >= 0 ? '+' : ''}
                  {s.change_pct.toFixed(2)}%
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </GlassPanel>
  )
}