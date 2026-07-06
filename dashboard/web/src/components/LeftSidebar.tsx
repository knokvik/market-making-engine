import clsx from 'clsx'
import { Layers } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { Logo } from './ui/Logo'
import { OVERLAY_OPTIONS, type OverlayKey } from '../types'

interface LeftSidebarProps {
  overlays: Record<OverlayKey, boolean>
  onToggle: (key: OverlayKey) => void
  onCollapse?: () => void
}

export function LeftSidebar({ overlays, onToggle, onCollapse }: LeftSidebarProps) {
  return (
    <GlassPanel
      title="Strategy Layers"
      className="h-full"
      action={
        <div className="flex items-center gap-2">
          {onCollapse && (
            <button onClick={onCollapse} className="text-[10px] text-desk-muted hover:text-white">←</button>
          )}
          <Layers size={14} className="text-desk-muted" />
        </div>
      }
    >
      <div className="border-b border-desk-border/40 px-2 py-1.5">
        <Logo size={20} />
      </div>
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