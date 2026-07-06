import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { DataMode } from '../types'

interface HelpModalProps {
  open: boolean
  onClose: () => void
  deskMode: DataMode
}

const HELP: Record<DataMode, string[]> = {
  replay: [
    'Pick a dataset in Data Source, then press Space to play/pause.',
    'Use ← / → to step frame-by-frame, R to reset.',
    'Drag panel headers to swap layout; resize panel edges.',
    'Strategy comparison and P&L panels update as replay runs.',
  ],
  paper: [
    'Select one US stock — default is NVDA. Algo starts automatically.',
    'Password knokvik required to change locked stock.',
    'Trade Book tab shows live paper fills and P&L (auto-refreshes).',
    'Use Algo Automation to tune γ, k, σ or stop/start the engine.',
  ],
  live: [
    'View-only terminal: ticker, chart, news, and trending stocks.',
    'Click any stock or use the symbol picker to switch instrument.',
    'Full-width ticker scrolls top movers; chart updates below.',
    'No orders placed in Live — switch to Paper for algo trading.',
  ],
}

export function HelpModal({ open, onClose, deskMode }: HelpModalProps) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-desk-text">How to use</h3>
          <button type="button" onClick={onClose} className="rounded border border-desk-border p-1 text-desk-muted">
            <X size={14} />
          </button>
        </div>
        <ul className="space-y-2 text-[11px] leading-relaxed text-desk-muted">
          {HELP[deskMode].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-desk-info">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-desk-border/50 pt-3 text-center text-[10px] text-desk-muted">
          Made by{' '}
          <a
            href="https://github.com/knokvik"
            target="_blank"
            rel="noopener noreferrer"
            className="text-desk-profit hover:underline"
          >
            knokvik
          </a>
        </p>
      </div>
    </div>,
    document.body,
  )
}