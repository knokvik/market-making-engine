import { Activity, Cpu, HardDrive, Settings, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReplayFrame } from '../types'

interface TopNavProps {
  frame: ReplayFrame | null
  connected: boolean
  onSettings: () => void
}

const statusColor: Record<string, string> = {
  healthy: 'text-desk-profit',
  warning: 'text-desk-warn',
  critical: 'text-desk-loss',
}

export function TopNav({ frame, connected, onSettings }: TopNavProps) {
  const mode = frame?.mode ?? 'REPLAY'
  const isLive = mode === 'LIVE'

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-desk-border/80 bg-desk-panel/80 px-4 backdrop-blur-glass">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-desk-info/20 text-desk-info">
            <Zap size={14} />
          </div>
          <span className="text-sm font-semibold tracking-tight">Market Making Engine</span>
        </div>

        <motion.div
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ repeat: Infinity, duration: isLive ? 1.2 : 0 }}
          className="flex items-center gap-1.5 rounded-full border border-desk-border px-2 py-0.5 text-[10px] font-semibold uppercase"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-desk-profit' : 'bg-desk-loss'}`} />
          {mode}
        </motion.div>

        <NavChip label="Exchange" value={frame?.exchange ?? '—'} />
        <NavChip label="Symbol" value={frame?.symbol ?? '—'} />
        <NavChip label="Strategy" value={formatStrategy(frame?.strategy)} />
        <NavChip
          label="Status"
          value={frame?.system_status ?? '—'}
          className={statusColor[frame?.system_status ?? ''] ?? 'text-desk-muted'}
        />
      </div>

      <div className="flex items-center gap-4 text-[11px] font-mono text-desk-muted">
        <Stat icon={<Activity size={12} />} label="evt/s" value={frame?.events_per_sec.toFixed(0) ?? '—'} />
        <Stat icon={<Zap size={12} />} label="latency" value={`${frame?.end_to_end_latency_ms.toFixed(1) ?? '—'}ms`} />
        <Stat icon={<Cpu size={12} />} label="cpu" value={`${frame?.cpu_percent.toFixed(0) ?? '—'}%`} />
        <Stat icon={<HardDrive size={12} />} label="mem" value={`${frame?.memory_mb.toFixed(0) ?? '—'}MB`} />
        <button
          onClick={onSettings}
          className="rounded-lg border border-desk-border p-1.5 text-desk-muted transition hover:border-desk-info/40 hover:text-white"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  )
}

function NavChip({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="hidden lg:flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-desk-muted">{label}</span>
      <span className={`text-xs font-medium ${className ?? 'text-white'}`}>{value}</span>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}

function formatStrategy(strategy?: string) {
  if (!strategy) return '—'
  if (strategy === 'avellaneda_stoikov') return 'Avellaneda-Stoikov'
  if (strategy === 'symmetric') return 'Symmetric'
  return strategy
}