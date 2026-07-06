import { Brain } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'

export function QuoteDecisionPanel({ frame }: { frame: ReplayFrame | null }) {
  const q = frame?.quote_decision

  return (
    <GlassPanel title="Quote Decision" className="h-full" action={<Brain size={14} className="text-desk-muted" />}>
      <div className="space-y-1.5 p-2">
        <div className="grid grid-cols-2 gap-1">
          <MetricCard label="Mid Price" value={q?.mid_price?.toFixed(4) ?? '—'} />
          <MetricCard label="Reservation" value={q?.reservation_price?.toFixed(4) ?? '—'} tone="info" />
          <MetricCard label="Fair Value" value={q?.fair_value?.toFixed(4) ?? '—'} />
          <MetricCard label="Inventory" value={q?.inventory ?? 0} tone={q && q.inventory > 0 ? 'warn' : q && q.inventory < 0 ? 'info' : 'neutral'} />
          <MetricCard label="Volatility σ" value={(q?.volatility ?? 0).toFixed(4)} />
          <MetricCard label="Gamma γ" value={(q?.gamma ?? 0).toFixed(3)} />
          <MetricCard label="Intensity k" value={(q?.k ?? 0).toFixed(2)} />
          <MetricCard label="Half Spread" value={q?.optimal_half_spread?.toFixed(4) ?? '—'} />
          <MetricCard label="Optimal Bid" value={q?.optimal_bid?.toFixed(4) ?? '—'} tone="profit" />
          <MetricCard label="Optimal Ask" value={q?.optimal_ask?.toFixed(4) ?? '—'} tone="loss" />
        </div>

        <div className="rounded-lg border border-desk-border/50 bg-black/20 px-2 py-1.5">
          <div className="mb-1 text-[10px] uppercase text-desk-muted">Market Regime</div>
          <div className="text-xs font-semibold uppercase text-desk-muted">{q?.regime?.replace('_', ' ') ?? '—'}</div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <MetricCard label="Fill Prob Bid" value={`${((q?.fill_probability_bid ?? 0) * 100).toFixed(0)}%`} />
          <MetricCard label="Fill Prob Ask" value={`${((q?.fill_probability_ask ?? 0) * 100).toFixed(0)}%`} />
        </div>

        <div className="rounded-lg border border-desk-border/40 bg-black/30 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-desk-muted">Reasoning</div>
          <ul className="space-y-1 text-[10px] leading-relaxed text-desk-muted">
            {(q?.reasoning ?? ['Awaiting market data…']).map((line, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-desk-muted">›</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </GlassPanel>
  )
}