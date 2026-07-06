import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import type { InstrumentOption } from '../types'

interface SymbolPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (instrument: InstrumentOption) => void
  currentSymbol?: string
}

export function SymbolPickerModal({ open, onClose, onSelect, currentSymbol }: SymbolPickerModalProps) {
  const [assetClass, setAssetClass] = useState<'stock' | 'crypto'>('stock')
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    fetch(`/api/instruments?asset_class=${assetClass}`)
      .then((r) => r.json())
      .then((d) => setInstruments(d.instruments ?? []))
      .catch(() => setInstruments([]))
  }, [open, assetClass])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const filtered = instruments.filter(
    (i) =>
      i.symbol.toLowerCase().includes(search.toLowerCase()) ||
      i.label.toLowerCase().includes(search.toLowerCase()),
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-panel flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-desk-border px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-desk-text">Choose symbol</h3>
            {currentSymbol && (
              <p className="text-[10px] text-desk-muted">Current: {currentSymbol}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded border border-desk-border p-1 text-desk-muted">
            <X size={14} />
          </button>
        </header>

        <div className="flex gap-1 border-b border-desk-border/50 p-2">
          {(['stock', 'crypto'] as const).map((ac) => (
            <button
              key={ac}
              type="button"
              onClick={() => setAssetClass(ac)}
              className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase ${
                assetClass === ac
                  ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                  : 'border-desk-border text-desk-muted'
              }`}
            >
              {ac === 'stock' ? 'US Stocks' : 'Crypto'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border-b border-desk-border/50 px-2 py-1.5">
          <Search size={12} className="text-desk-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-transparent text-[10px] outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {filtered.map((inst) => (
              <button
                key={`${inst.symbol}-${inst.exchange}`}
                type="button"
                onClick={() => {
                  onSelect(inst)
                  onClose()
                }}
                className={`rounded border px-2 py-1.5 text-left text-[10px] ${
                  currentSymbol === inst.symbol
                    ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                    : 'border-desk-border/40 text-desk-muted hover:text-desk-text'
                }`}
              >
                <div className="font-semibold">{inst.symbol}</div>
                <div className="truncate text-[8px] text-desk-muted">{inst.exchange}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}