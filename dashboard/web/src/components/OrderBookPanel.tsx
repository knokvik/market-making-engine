import { AnimatePresence, motion } from 'framer-motion'
import { GlassPanel } from './ui/GlassPanel'
import type { ReplayFrame } from '../types'

export function OrderBookPanel({ frame }: { frame: ReplayFrame | null }) {
  const ladder = frame?.book_ladder ?? []

  return (
    <GlassPanel title="Order Book" className="h-full">
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-4 gap-1 border-b border-desk-border/50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-desk-muted">
          <span>Bid Size</span>
          <span className="text-center">Price</span>
          <span>Ask Size</span>
          <span className="text-right">Vol</span>
        </div>

        <div className="flex-1 overflow-auto px-1 py-0.5">
          <AnimatePresence mode="popLayout">
            {ladder.map((row) => (
              <motion.div
                key={row.price}
                layout
                initial={{ opacity: 0.4, backgroundColor: 'rgba(59,158,255,0.15)' }}
                animate={{ opacity: 1, backgroundColor: row.executed ? 'rgba(255,176,32,0.2)' : 'transparent' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`relative mb-px grid grid-cols-4 items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] ${
                  row.executed ? 'ring-1 ring-desk-warn/50' : ''
                }`}
              >
                <div className="relative flex items-center">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-desk-profit/25 transition-all duration-300"
                    style={{ width: `${row.bid_pct * 100}%` }}
                  />
                  <span className="relative z-10 pl-1 text-desk-profit">{row.bid_size > 0 ? row.bid_size.toFixed(0) : ''}</span>
                </div>
                <span className="text-center text-white">{row.price.toFixed(4)}</span>
                <div className="relative flex items-center justify-end">
                  <div
                    className="absolute inset-y-0 right-0 rounded-sm bg-desk-loss/25 transition-all duration-300"
                    style={{ width: `${row.ask_pct * 100}%` }}
                  />
                  <span className="relative z-10 pr-1 text-desk-loss">{row.ask_size > 0 ? row.ask_size.toFixed(0) : ''}</span>
                </div>
                <div className="flex justify-end">
                  <div className="h-1.5 w-8 overflow-hidden rounded-full bg-desk-border">
                    <div
                      className="h-full bg-desk-info/30"
                      style={{ width: `${Math.max(row.bid_pct, row.ask_pct) * 100}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-4 gap-1 border-t border-desk-border/50 bg-black/20 px-2 py-1.5 text-[10px]">
          <Stat label="Best Bid" value={frame?.best_bid?.toFixed(4) ?? '—'} tone="profit" />
          <Stat label="Mid" value={frame?.mid_price?.toFixed(4) ?? '—'} tone="info" />
          <Stat label="Best Ask" value={frame?.best_ask?.toFixed(4) ?? '—'} tone="loss" />
          <Stat label="Spread" value={frame?.spread?.toFixed(4) ?? '—'} tone="warn" />
        </div>
      </div>
    </GlassPanel>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'profit' | 'loss' | 'info' | 'warn' }) {
  const colors = { profit: 'text-desk-profit', loss: 'text-desk-loss', info: 'text-desk-info', warn: 'text-desk-warn' }
  return (
    <div>
      <div className="text-[9px] uppercase text-desk-muted">{label}</div>
      <div className={`font-mono font-semibold ${colors[tone]}`}>{value}</div>
    </div>
  )
}