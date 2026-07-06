import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { ReactNode } from 'react'

interface GlassPanelProps {
  title?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function GlassPanel({ title, children, className, action }: GlassPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={clsx('glass-panel flex flex-col overflow-hidden', className)}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-desk-border/60 px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-desk-muted">{title}</h3>
          {action}
        </header>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </motion.section>
  )
}