import { Activity, Signal } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import { useFrame } from '../hooks/useFrame'
import { useLiveTrader } from '../hooks/LiveTraderContext'

export function LiveMarketStatsPanel() {
  const frame = useFrame()
  const { selectedSymbol } = useLiveTrader()

  return (
    <GlassPanel title={`${selectedSymbol} Stats`} className="h-full" action={<Signal size={14} className="text-desk-info" />}>
      <div className="grid h-full grid-cols-2 gap-1.5 p-2">
        <MetricCard label="Bid" value={frame?.best_bid?.toFixed(2) ?? '—'} tone="profit" />
        <MetricCard label="Ask" value={frame?.best_ask?.toFixed(2) ?? '—'} tone="loss" />
        <MetricCard label="Mid" value={frame?.mid_price?.toFixed(2) ?? '—'} />
        <MetricCard label="Spread" value={frame?.spread?.toFixed(4) ?? '—'} />
        <MetricCard
          label="Feed"
          value={
            frame?.connection_quality === 'reconnecting'
              ? 'Reconnecting'
              : frame?.live_connected
                ? 'Live'
                : 'Sync'
          }
          tone={
            frame?.connection_quality === 'reconnecting'
              ? 'warn'
              : frame?.live_connected
                ? 'profit'
                : 'neutral'
          }
        />
        <MetricCard label="Ping" value={frame?.live_ping_ms ? `${frame.live_ping_ms.toFixed(0)}ms` : '—'} />
        <MetricCard label="Evt/s" value={frame?.events_per_sec?.toFixed(0) ?? '—'} />
        <MetricCard
          label="Regime"
          value={frame?.regime?.replace('_', ' ') ?? '—'}
          tone="neutral"
        />
      </div>
      <div className="flex items-center gap-1 border-t border-desk-border/40 px-2 py-1 text-[9px] text-desk-muted">
        <Activity size={10} />
        {frame?.exchange ?? 'Alpaca'} · view-only
      </div>
    </GlassPanel>
  )
}