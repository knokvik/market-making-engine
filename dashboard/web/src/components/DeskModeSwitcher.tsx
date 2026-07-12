import { Database, ScrollText, Wifi } from 'lucide-react'
import type { DataMode } from '../types'

const MODES: { id: DataMode; label: string; icon: (isActive: boolean) => React.ReactNode }[] = [
  { id: 'replay', label: 'Replay', icon: () => <Database size={12} /> },
  { id: 'paper', label: 'Paper', icon: () => <ScrollText size={12} /> },
  { id: 'live', label: 'Live', icon: (isActive) => <Wifi size={12} className={isActive ? 'animate-pulse' : ''} /> },
]

interface DeskModeSwitcherProps {
  mode: DataMode
  onChange: (mode: DataMode) => void
}

export function DeskModeSwitcher({ mode, onChange }: DeskModeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-desk-border bg-desk-panel/60 p-0.5 font-mono sm:gap-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-0.5 rounded px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide transition sm:gap-1 sm:px-2 sm:text-[10px] ${
            mode === m.id
              ? m.id === 'live'
                ? 'bg-desk-loss/15 text-desk-loss'
                : m.id === 'paper'
                  ? 'bg-desk-profit/15 text-desk-profit'
                  : 'bg-desk-warn/15 text-desk-warn'
              : 'text-desk-muted hover:text-desk-text'
          }`}
        >
          {m.icon(mode === m.id)}
          <span className="hidden min-[400px]:inline">{m.label}</span>
        </button>
      ))}
    </div>
  )
}