import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { DataMode } from '../types'

const HINT_DAY_KEY = 'mm-engine-welcome-dismissed-day'

const MESSAGES: Record<DataMode, string> = {
  replay: 'Welcome — load a dataset below, press Space to play, ←/→ to step. Your last session summary appears above when idle.',
  paper: 'Paper desk — NVDA runs by default. Algo auto-starts. Use Trade Book for live output. Password knokvik to change stock.',
  live: 'Live terminal — full-width ticker on top. Click trending stocks or the symbol box to switch. View-only, no orders.',
}

interface WelcomeHintProps {
  deskMode: DataMode
}

export function WelcomeHint({ deskMode }: WelcomeHintProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const dismissedDay = localStorage.getItem(HINT_DAY_KEY)
      if (dismissedDay !== today) setVisible(true)
      else setVisible(false)
    } catch {
      setVisible(true)
    }
  }, [deskMode])

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(HINT_DAY_KEY, new Date().toISOString().slice(0, 10))
    } catch { /* ignore */ }
    setVisible(false)
  }

  return (
    <div className="mx-2 mt-1 shrink-0 flex items-start gap-2 rounded border border-desk-info/30 bg-desk-info/5 px-3 py-2 text-[10px] text-desk-muted">
      <span className="flex-1 leading-relaxed">{MESSAGES[deskMode]}</span>
      <button type="button" onClick={dismiss} className="shrink-0 text-desk-muted hover:text-desk-text" title="Dismiss">
        <X size={12} />
      </button>
    </div>
  )
}