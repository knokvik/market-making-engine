import { Search } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import type { ReplayFrame } from '../types'

export function EventInspectorPanel({ frame }: { frame: ReplayFrame | null }) {
  const insp = frame?.event_inspector ?? {}

  const sections = [
    { title: 'Market State', keys: ['best_bid', 'best_ask', 'mid_price', 'spread', 'regime'] },
    { title: 'Strategy', keys: ['reservation_price', 'fair_value', 'our_bid', 'our_ask', 'optimal_spread'] },
    { title: 'Inventory & Risk', keys: ['position', 'exposure', 'risk_score', 'gamma', 'sigma'] },
    { title: 'PnL Snapshot', keys: ['total_pnl', 'realized_pnl', 'unrealized_pnl', 'spread_capture'] },
    { title: 'Execution', keys: ['fill_count', 'queue_position_bid', 'queue_position_ask', 'fill_probability_bid'] },
  ]

  return (
    <GlassPanel title="Event Inspector" className="h-full" action={<Search size={14} className="text-desk-muted" />}>
      <div className="overflow-auto p-2 text-[10px] leading-relaxed">
        <div className="mb-2 rounded border border-desk-info/30 bg-desk-info/5 px-2 py-1 font-mono text-desk-info">
          Frame {frame?.frame_index ?? 0} · {frame?.replay_time_display ?? '—'} · Event #{(frame?.frame_index ?? 0) + 1}
        </div>

        {sections.map((sec) => (
          <div key={sec.title} className="mb-2">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-desk-muted">{sec.title}</div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {sec.keys.map((key) => (
                <div key={key} className="rounded border border-desk-border/30 bg-black/20 px-1.5 py-1">
                  <div className="text-[8px] uppercase text-desk-muted">{key.replace(/_/g, ' ')}</div>
                  <div className="font-mono text-white">
                    {formatValue(insp[key] ?? getFrameField(frame, key))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {typeof insp.decision_reasoning === 'string' && (
          <div className="rounded border border-desk-border/40 bg-black/30 p-2">
            <div className="mb-1 text-[9px] uppercase text-desk-muted">Decision Explanation</div>
            <p className="text-desk-muted">{insp.decision_reasoning}</p>
          </div>
        )}
      </div>
    </GlassPanel>
  )
}

function getFrameField(frame: ReplayFrame | null, key: string): unknown {
  if (!frame) return undefined
  return (frame as unknown as Record<string, unknown>)[key]
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  if (typeof v === 'boolean') return v ? 'YES' : 'NO'
  return String(v)
}