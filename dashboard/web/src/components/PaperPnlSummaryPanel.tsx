import { useCallback, useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import { useFrame } from '../hooks/useFrame'
import type { TradeBookData } from '../types'

interface PaperPnlSummaryPanelProps {
  onOpenTradeBook?: () => void
}

export function PaperPnlSummaryPanel({ onOpenTradeBook }: PaperPnlSummaryPanelProps) {
  const frame = useFrame()
  const [book, setBook] = useState<TradeBookData | null>(null)

  const fetchBook = useCallback(() => {
    fetch('/api/trade-book')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setBook(d))
      .catch(() => setBook(null))
  }, [])

  useEffect(() => {
    fetchBook()
    const timer = setInterval(fetchBook, 3000)
    return () => clearInterval(timer)
  }, [fetchBook, frame?.frame_index])

  const summary = book?.summary
  const dailyPnl = summary?.daily_pnl ?? frame?.total_pnl ?? 0
  const realized = summary?.realized_pnl ?? frame?.realized_pnl ?? 0
  const unrealized = summary?.unrealized_pnl ?? frame?.unrealized_pnl ?? 0
  const fills = summary?.trade_count ?? frame?.fill_count ?? 0

  return (
    <GlassPanel
      title="Paper P&L Book"
      className="h-full"
      action={
        onOpenTradeBook ? (
          <button
            type="button"
            onClick={onOpenTradeBook}
            className="flex items-center gap-1 text-[9px] uppercase text-desk-info hover:text-desk-text"
          >
            <BookOpen size={12} /> Trade Book
          </button>
        ) : undefined
      }
    >
      <div className="grid h-full grid-cols-2 gap-1.5 p-2 sm:grid-cols-4">
        <MetricCard label="Daily PnL" value={dailyPnl.toFixed(2)} tone={dailyPnl >= 0 ? 'profit' : 'loss'} />
        <MetricCard label="Realized" value={realized.toFixed(2)} tone={realized >= 0 ? 'profit' : 'loss'} />
        <MetricCard label="Unrealized" value={unrealized.toFixed(2)} tone={unrealized >= 0 ? 'profit' : 'loss'} />
        <MetricCard label="Fills" value={String(fills)} />
        <MetricCard label="Inventory" value={String(summary?.inventory ?? frame?.position ?? 0)} />
        <MetricCard label="Fees" value={(summary?.fees ?? frame?.transaction_fees ?? 0).toFixed(2)} tone="loss" />
        <MetricCard
          label="Algo"
          value={frame?.algo_state?.active ? 'RUNNING' : 'IDLE'}
          tone={frame?.algo_state?.active ? 'profit' : 'neutral'}
        />
        <MetricCard label="Symbol" value={frame?.symbol ?? '—'} />
      </div>
    </GlassPanel>
  )
}