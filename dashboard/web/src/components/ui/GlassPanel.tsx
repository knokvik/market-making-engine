import clsx from 'clsx'
import type { ReactNode } from 'react'

interface GlassPanelProps {
  title?: ReactNode
  children: ReactNode
  className?: string
  action?: ReactNode
  draggable?: boolean
  badge?: 'live' | 'cached' | 'warn'
}

export function GlassPanel({ title, children, className, action, draggable = true, badge }: GlassPanelProps) {
  return (
    <section className={clsx('monitor-panel flex h-full flex-col', className)}>
      {title && (
        <header
          className={clsx(
            'panel-drag-handle flex shrink-0 items-center justify-between border-b border-desk-border px-2.5 py-1',
            draggable && 'cursor-grab select-none active:cursor-grabbing',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-0.5 shrink-0 rounded-full bg-desk-profit" aria-hidden />
            <div className="truncate font-mono text-[10px] font-bold uppercase tracking-widest text-desk-text">
              {title}
            </div>
            {badge === 'live' && (
              <span className="rounded bg-desk-loss/15 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-desk-loss">Live</span>
            )}
            {badge === 'cached' && (
              <span className="rounded border border-desk-border px-1.5 py-px text-[8px] uppercase text-desk-muted">Cached</span>
            )}
            {badge === 'warn' && (
              <span className="rounded px-1.5 py-px text-[8px] font-bold uppercase text-desk-warn">Warn</span>
            )}
          </div>
          {action && <div className="panel-no-drag shrink-0">{action}</div>}
        </header>
      )}
      <div className="panel-body min-h-0 flex-1 overflow-auto overscroll-contain">{children}</div>
    </section>
  )
}