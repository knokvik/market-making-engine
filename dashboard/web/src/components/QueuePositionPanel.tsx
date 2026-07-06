import { motion } from 'framer-motion'
import { ListOrdered } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'

export function QueuePositionPanel({ frame }: { frame: ReplayFrame | null }) {
  const q = frame?.queue_analytics
  const bidPos = q?.bid_position ?? 0
  const askPos = q?.ask_position ?? 0
  const bidLen = q?.bid_queue_length ?? 1
  const askLen = q?.ask_queue_length ?? 1

  return (
    <GlassPanel title="Queue Position" className="h-full" action={<ListOrdered size={14} className="text-desk-muted" />}>
      <div className="space-y-2 p-2">
        <QueueViz label="Bid Queue" position={bidPos} length={bidLen} fillProb={q?.fill_probability_bid ?? 0} color="profit" movement={q?.queue_movement} />
        <QueueViz label="Ask Queue" position={askPos} length={askLen} fillProb={q?.fill_probability_ask ?? 0} color="loss" movement={q?.queue_movement} />

        <div className="grid grid-cols-2 gap-1">
          <MetricCard label="ETF Bid" value={`${(q?.expected_time_to_fill_bid_ms ?? 0).toFixed(0)}ms`} />
          <MetricCard label="ETF Ask" value={`${(q?.expected_time_to_fill_ask_ms ?? 0).toFixed(0)}ms`} />
          <MetricCard label="Fill Prob Bid" value={`${((q?.fill_probability_bid ?? 0) * 100).toFixed(0)}%`} tone="info" />
          <MetricCard label="Fill Prob Ask" value={`${((q?.fill_probability_ask ?? 0) * 100).toFixed(0)}%`} tone="info" />
        </div>

        <div className="rounded border border-desk-border/40 bg-black/20 px-2 py-1 text-center text-[10px] uppercase text-desk-muted">
          Queue Movement: <span className="text-desk-info">{q?.queue_movement ?? '—'}</span>
        </div>
      </div>
    </GlassPanel>
  )
}

function QueueViz({
  label,
  position,
  length,
  fillProb,
  color,
  movement,
}: {
  label: string
  position: number
  length: number
  fillProb: number
  color: 'profit' | 'loss'
  movement?: string
}) {
  const barColor = color === 'profit' ? 'bg-desk-profit' : 'bg-desk-loss'
  const pct = length > 0 ? ((position ?? 0) / length) * 100 : 0

  return (
    <div className="rounded-lg border border-desk-border/40 bg-black/20 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-semibold uppercase text-desk-muted">{label}</span>
        <span className="font-mono text-desk-info">#{position ?? '—'} / {length}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-desk-border">
        <motion.div
          className={`absolute left-0 top-0 h-full ${barColor}/40`}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className={`absolute top-0 h-full w-1.5 ${barColor}`}
          animate={{ left: `${Math.min(pct, 98)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-desk-muted">
        <span>Fill prob {(fillProb * 100).toFixed(0)}%</span>
        <span>{movement === 'advancing' ? '▶ advancing' : '■ static'}</span>
      </div>
    </div>
  )
}