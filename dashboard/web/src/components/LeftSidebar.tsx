import clsx from 'clsx'
import { Layers } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { OVERLAY_OPTIONS, type OverlayKey } from '../types'

interface LeftSidebarProps {
  overlays: Record<OverlayKey, boolean>
  onToggle: (key: OverlayKey) => void
}

export function LeftSidebar({ overlays, onToggle }: LeftSidebarProps) {
  return (
    <GlassPanel title="Strategy Layers" className="h-full w-56 shrink-0" action={<Layers size={14} className="text-desk-muted" />}>
      <div className="space-y-1 p-2">
        {OVERLAY_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onToggle(option.key)}
            className={clsx('sidebar-toggle w-full justify-between', overlays[option.key] && 'active')}
          >
            <span>{option.label}</span>
            <span className="text-[10px] opacity-60">{overlays[option.key] ? 'ON' : 'OFF'}</span>
          </button>
        ))}
      </div>
    </GlassPanel>
  )
}