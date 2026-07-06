import { AlertTriangle, Gauge, Shield } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'

interface RightSidebarProps {
  frame: ReplayFrame | null
}

export function RightSidebar({ frame }: RightSidebarProps) {
  const invPct = frame ? (Math.abs(frame.position) / Math.max(frame.max_abs_inventory, 1)) * 100 : 0
  const riskTone = frame && frame.risk_score > 60 ? 'loss' : frame && frame.risk_score > 35 ? 'warn' : 'info'

  return (
    <GlassPanel title="Risk & Inventory" className="h-full">
      <div className="space-y-1.5 overflow-auto p-2">
        <MetricCard label="Inventory" value={frame?.position ?? 0} tone={frame && frame.position > 0 ? 'warn' : frame && frame.position < 0 ? 'info' : 'neutral'} />
        <MetricCard label="Avg Inventory" value={(frame?.avg_abs_inventory ?? 0).toFixed(2)} />
        <MetricCard label="Max Inventory" value={frame?.max_abs_inventory ?? 0} />
        <MetricCard label="Exposure" value={`$${(frame?.exposure ?? 0).toFixed(2)}`} tone="info" />

        <div className="rounded-lg border border-desk-border/50 bg-black/20 p-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase text-desk-muted">
            <span>Inventory Gauge</span>
            <Gauge size={12} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-desk-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-desk-info to-desk-warn transition-all duration-300"
              style={{ width: `${Math.min(invPct, 100)}%` }}
            />
          </div>
        </div>

        <MetricCard label="Risk Score" value={`${(frame?.risk_score ?? 0).toFixed(0)}`} tone={riskTone} />
        <MetricCard label="γ (gamma)" value={(frame?.gamma ?? 0).toFixed(3)} />
        <MetricCard label="σ (volatility)" value={(frame?.sigma ?? 0).toFixed(4)} />
        <MetricCard label="k (intensity)" value={(frame?.k ?? 0).toFixed(2)} />
        <MetricCard label="τ (time left)" value={(frame?.tau ?? 0).toFixed(3)} />
        <MetricCard label="Reservation" value={frame?.reservation_price?.toFixed(4) ?? '—'} tone="info" />
        <MetricCard label="Optimal Spread" value={frame?.optimal_spread?.toFixed(4) ?? '—'} />

        <div className="grid grid-cols-2 gap-2">
          <StatusPill
            label="Kill Switch"
            active={frame?.kill_switch ?? false}
            icon={<Shield size={12} />}
          />
          <StatusPill
            label="Circuit Breaker"
            active={frame?.circuit_breaker ?? false}
            icon={<AlertTriangle size={12} />}
          />
        </div>

        <div className="rounded-lg border border-desk-border/40 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-desk-muted">
          r = S − q·γ·σ²·τ
          <br />
          δ = (1/γ)ln(1+γ/k) ± inv skew
        </div>
      </div>
    </GlassPanel>
  )
}

function StatusPill({
  label,
  active,
  icon,
}: {
  label: string
  active: boolean
  icon: React.ReactNode
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 text-[10px] ${
        active
          ? 'border-desk-loss/50 bg-desk-loss/10 text-desk-loss'
          : 'border-desk-border/50 bg-black/20 text-desk-muted'
      }`}
    >
      <div className="mb-0.5 flex items-center gap-1">{icon}{label}</div>
      <div className="font-semibold">{active ? 'TRIGGERED' : 'ARMED'}</div>
    </div>
  )
}