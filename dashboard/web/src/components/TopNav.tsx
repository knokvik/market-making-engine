import { Activity, CircleHelp, Cpu, HardDrive, RotateCcw, Settings, Timer } from 'lucide-react'
import { motion } from 'framer-motion'
import { Logo } from './ui/Logo'
import type { ReplayFrame } from '../types'
import { formatLatencyMs } from '../utils/latencyFormat'

interface TopNavProps {
  frame: ReplayFrame | null
  connected: boolean
  onSettings: () => void
  onResetLayout?: () => void
  showResetLayout?: boolean
  onHelp?: () => void
}

const statusColor: Record<string, string> = {
  healthy: 'text-desk-profit',
  warning: 'text-desk-warn',
  critical: 'text-desk-loss',
}

export function TopNav({ frame, connected, onSettings, onResetLayout, showResetLayout, onHelp }: TopNavProps) {
  const isLive = frame?.live_mode ?? frame?.mode === 'LIVE'
  const isPaper = frame?.feed_type === 'paper_trading' || frame?.mode === 'PAPER'
  const mode = isLive ? 'LIVE' : isPaper ? 'PAPER' : (frame?.mode ?? 'REPLAY')

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-desk-border bg-desk-panel px-2 py-1.5 sm:h-12 sm:flex-nowrap sm:gap-y-0 sm:px-4 sm:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <Logo size={24} showText className="[&_span:last-child]:hidden sm:[&_span:last-child]:inline" />

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

      <div className="flex shrink-0 items-center gap-2 text-[10px] font-mono text-desk-muted sm:gap-4 sm:text-[11px]">
        <div className="hidden md:flex items-center gap-4">
          <Stat icon={<Activity size={12} />} label="evt/s" value={frame?.events_per_sec != null ? frame.events_per_sec.toFixed(0) : '—'} />
          <Stat icon={<Timer size={12} />} label="latency" value={frame?.end_to_end_latency_ms != null ? formatLatencyMs(frame.end_to_end_latency_ms) : '—'} />
        </div>
        <div className="hidden lg:flex items-center gap-4">
          <Stat icon={<Cpu size={12} />} label="cpu" value={frame?.cpu_percent != null ? `${frame.cpu_percent.toFixed(0)}%` : '—'} />
          <Stat icon={<HardDrive size={12} />} label="mem" value={frame?.memory_mb != null ? `${frame.memory_mb.toFixed(0)}MB` : '—'} />
        </div>
        {showResetLayout && onHelp && (
          <button
            type="button"
            onClick={onHelp}
            title="How to use"
            className="rounded-lg border border-desk-border p-1.5 text-desk-muted transition hover:border-desk-info/40 hover:text-desk-info"
          >
            <CircleHelp size={14} />
          </button>
        )}
        {showResetLayout && onResetLayout && (
          <button
            type="button"
            onClick={onResetLayout}
            title="Reset layout"
            className="rounded-lg border border-desk-border p-1.5 text-desk-muted transition hover:border-desk-profit/40 hover:text-desk-profit"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onSettings}
          title="Settings"
          className="rounded-lg border border-desk-border p-1.5 text-desk-muted transition hover:border-desk-info/40 hover:text-desk-info"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  )
}

function NavChip({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="hidden xl:flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-desk-muted">{label}</span>
      <span className={`text-xs font-medium ${className ?? 'text-desk-text'}`}>{value}</span>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
      <span className="text-desk-text">{value}</span>
    </div>
  )
}

function formatStrategy(strategy?: string) {
  if (!strategy) return '—'
  if (strategy === 'avellaneda_stoikov') return 'Avellaneda-Stoikov'
  if (strategy === 'symmetric') return 'Symmetric'
  if (strategy === 'glft') return 'GLFT'
  return strategy
}