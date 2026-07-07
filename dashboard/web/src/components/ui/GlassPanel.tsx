import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { ReactNode } from 'react'

interface GlassPanelProps {
  title?: string
  children: ReactNode
  className?: string
  action?: ReactNode
  draggable?: boolean
}

export function GlassPanel({ title, children, className, action, draggable = true }: GlassPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={clsx('glass-panel flex h-full flex-col overflow-hidden', className)}
    >
      {title && (
        <header
          className={clsx(
            'flex items-center justify-between border-b border-desk-border/60 px-3 py-2',
            draggable && 'panel-drag-handle cursor-grab active:cursor-grabbing',
          )}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-desk-muted">{title}</h3>
          {action}
        </header>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </motion.section>
  )
}