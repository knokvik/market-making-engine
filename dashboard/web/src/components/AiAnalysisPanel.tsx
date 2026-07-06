import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import type { ReplayFrame } from '../types'

export function AiAnalysisPanel({ frame }: { frame: ReplayFrame | null }) {
  const summary = frame?.ai_summary ?? 'Run a simulation to generate an automatic strategy analysis summary.'

  return (
    <GlassPanel title="AI Analysis" className="h-full" action={<Sparkles size={14} className="text-desk-warn" />}>
      <motion.div
        key={summary.slice(0, 40)}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 text-xs leading-relaxed text-desk-muted"
      >
        <p className="italic text-white/90">&ldquo;{summary}&rdquo;</p>
        {frame && (
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <Tag label="Strategy" value={frame.strategy} />
            <Tag label="Regime" value={frame.regime} />
            <Tag label="Fills" value={String(frame.fill_count)} />
            <Tag label="Toxicity" value={`${(frame.toxicity * 100).toFixed(0)}%`} />
          </div>
        )}
      </motion.div>
    </GlassPanel>
  )
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded border border-desk-border/50 bg-black/20 px-2 py-0.5">
      <span className="text-desk-muted">{label}: </span>
      <span className="text-desk-info">{value}</span>
    </span>
  )
}