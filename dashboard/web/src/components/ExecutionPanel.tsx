import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'
import { formatLatencyMs } from '../utils/latencyFormat'

export function ExecutionPanel({ frame }: { frame: ReplayFrame | null }) {
  return (
    <GlassPanel title="Execution Analytics" className="h-full">
      <div className="grid grid-cols-2 gap-1.5 p-2">
        <MetricCard label="Queue Bid" value={frame?.queue_position_bid ?? '—'} tone="info" />
        <MetricCard label="Queue Ask" value={frame?.queue_position_ask ?? '—'} tone="info" />
        <MetricCard
          label="Fill Prob Bid"
          value={`${((frame?.fill_probability_bid ?? 0) * 100).toFixed(0)}%`}
        />
        <MetricCard
          label="Fill Prob Ask"
          value={`${((frame?.fill_probability_ask ?? 0) * 100).toFixed(0)}%`}
        />
        <MetricCard
          label="Exec Latency"
          value={`${(frame?.execution_latency_us ?? 0).toFixed(0)}µs`}
        />
        <MetricCard label="E2E Latency" value={formatLatencyMs(frame?.end_to_end_latency_ms ?? 0)} />
        <MetricCard label="Quote Lifetime" value={`${(frame?.quote_lifetime_ms ?? 0).toFixed(0)}ms`} />
        <MetricCard label="Cancel Rate" value={`${((frame?.cancel_rate ?? 0) * 100).toFixed(0)}%`} />
        <MetricCard label="Fill Efficiency" value={`${((frame?.fill_efficiency ?? 0) * 100).toFixed(0)}%`} />
        <MetricCard label="Fills" value={frame?.fill_count ?? 0} />
        <MetricCard label="Avg Trade PnL" value={(frame?.avg_trade_profit ?? 0).toFixed(4)} />
        <MetricCard label="Slippage Est." value={(frame?.adverse_selection_cost ?? 0).toFixed(4)} tone="warn" />
      </div>
    </GlassPanel>
  )
}