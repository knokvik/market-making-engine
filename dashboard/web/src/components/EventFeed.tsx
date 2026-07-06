import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from './ui/GlassPanel'
import type { LogEvent } from '../types'

const severityStyle: Record<string, string> = {
  info: 'border-l-desk-info text-desk-info',
  success: 'border-l-desk-profit text-desk-profit',
  warning: 'border-l-desk-warn text-desk-warn',
  danger: 'border-l-desk-loss text-desk-loss',
}

export function EventFeed({ events }: { events: LogEvent[] }) {
  return (
    <GlassPanel title="Live Event Feed" className="h-full">
      <div className="max-h-44 space-y-1 overflow-y-auto p-2 font-mono text-[10px]">
        <AnimatePresence initial={false}>
          {events.slice().reverse().map((event, idx) => (
            <motion.div
              key={`${event.timestamp}-${idx}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`border-l-2 bg-black/20 px-2 py-1 ${severityStyle[event.severity] ?? severityStyle.info}`}
            >
              <span className="text-desk-muted">{event.timestamp}</span>{' '}
              <span className="uppercase">[{event.category}]</span> {event.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </GlassPanel>
  )
}