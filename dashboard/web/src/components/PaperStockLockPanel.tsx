import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lock, Unlock } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import type { InstrumentOption, ReplayFrame } from '../types'

const LOCK_KEY = 'mm-paper-locked-symbol'
const CHANGE_PASSWORD = 'knokvik'

interface PaperStockLockPanelProps {
  frame: ReplayFrame | null
  onConnect: (instrument: InstrumentOption) => void
}

export function PaperStockLockPanel({ frame, onConnect }: PaperStockLockPanelProps) {
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [selected, setSelected] = useState<InstrumentOption | null>(null)
  const [lockedSymbol, setLockedSymbol] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCK_KEY)
    } catch {
      return null
    }
  })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    fetch('/api/instruments?asset_class=stock')
      .then((r) => r.json())
      .then((d) => setInstruments(d.instruments ?? []))
      .catch(() => setInstruments([]))
  }, [])

  useEffect(() => {
    if (!instruments.length) return
    if (lockedSymbol) {
      const match = instruments.find((i) => i.symbol === lockedSymbol)
      if (match) setSelected(match)
      return
    }
    const nvda = instruments.find((i) => i.symbol === 'NVDA') ?? instruments[0]
    setSelected(nvda)
  }, [lockedSymbol, instruments])

  const connectStock = useCallback(
    (inst: InstrumentOption) => {
      onConnect(inst)
      setLockedSymbol(inst.symbol)
      localStorage.setItem(LOCK_KEY, inst.symbol)
      setSelected(inst)
    },
    [onConnect],
  )

  const handleConnect = () => {
    if (!selected) return
    if (lockedSymbol && lockedSymbol !== selected.symbol) {
      setShowPasswordModal(true)
      return
    }
    connectStock(selected)
  }

  const confirmPasswordChange = () => {
    if (password !== CHANGE_PASSWORD) {
      setPasswordError('Incorrect password')
      return
    }
    if (selected) connectStock(selected)
    setPassword('')
    setPasswordError('')
    setShowPasswordModal(false)
  }

  const isLocked = Boolean(lockedSymbol)
  const activeSymbol = frame?.feed_type === 'paper_trading' ? frame.symbol : lockedSymbol

  return (
    <>
      <GlassPanel
        title="Paper Stock Lock"
        className="h-full"
        action={isLocked ? <Lock size={14} className="text-desk-warn" /> : <Unlock size={14} className="text-desk-muted" />}
      >
        <div className="flex h-full flex-col gap-2 p-2 text-xs">
          {isLocked && (
            <div className="rounded border border-desk-warn/30 bg-desk-warn/5 px-2 py-1.5 text-[10px] text-desk-warn">
              Locked to <span className="font-semibold">{lockedSymbol}</span> — password required to change
            </div>
          )}

          {activeSymbol && frame?.algo_state?.active && (
            <div className="rounded border border-desk-profit/30 bg-desk-profit/5 px-2 py-1 text-[10px] font-semibold text-desk-profit">
              ALGO RUNNING · {activeSymbol}
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-0.5 overflow-auto">
            {instruments.map((inst) => (
              <button
                key={inst.symbol}
                type="button"
                onClick={() => setSelected(inst)}
                className={`w-full rounded border px-2 py-1 text-left text-[10px] ${
                  selected?.symbol === inst.symbol
                    ? 'border-desk-warn/50 bg-desk-warn/10 text-desk-warn'
                    : 'border-desk-border/40 text-desk-muted hover:text-desk-text'
                }`}
              >
                {inst.label}
                {lockedSymbol === inst.symbol && (
                  <span className="ml-1 text-[8px] uppercase text-desk-profit">active</span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={!selected}
            className="toolbar-btn w-full justify-center border-desk-warn/40 bg-desk-warn/10 text-desk-warn disabled:opacity-40"
          >
            {isLocked && lockedSymbol !== selected?.symbol ? 'Unlock & Switch' : 'Connect & Start Algo'}
          </button>

          <p className="text-[9px] text-desk-muted">
            US stocks only · connect starts MM algo (~1 sim fill/sec) recorded in Trade Book
          </p>
        </div>
      </GlassPanel>

      {showPasswordModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setShowPasswordModal(false)}
          >
            <div
              className="glass-panel w-full max-w-sm p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-desk-text">Change locked stock</h3>
              <p className="mt-1 text-[10px] text-desk-muted">
                Enter password to switch from {lockedSymbol} to {selected?.symbol}
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                placeholder="Password"
                className="mt-3 w-full rounded border border-desk-border bg-black/30 px-2 py-1.5 text-xs text-white outline-none"
                onKeyDown={(e) => e.key === 'Enter' && confirmPasswordChange()}
              />
              {passwordError && <p className="mt-1 text-[10px] text-desk-loss">{passwordError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="toolbar-btn" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="button" className="toolbar-btn border-desk-warn/40 text-desk-warn" onClick={confirmPasswordChange}>
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}