import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { SideDrawer } from './SideDrawer'
import type { InstrumentOption } from '../types'

interface SymbolPickerDrawerProps {
  open: boolean
  onClose: () => void
  onSelect: (instrument: InstrumentOption) => void
  currentSymbol?: string
}

export function SymbolPickerDrawer({ open, onClose, onSelect, currentSymbol }: SymbolPickerDrawerProps) {
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

  const filtered = instruments.filter(
    (i) =>
      i.symbol.toLowerCase().includes(search.toLowerCase()) ||
      i.label.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <SideDrawer open={open} onClose={onClose} title="Select symbol" width="min(420px, 38vw)">
      <div className="flex h-full min-h-0 flex-col text-xs">
        <div className="flex gap-1 border-b border-desk-border/50 p-3">
          {(['stock', 'crypto'] as const).map((ac) => (
            <button
              key={ac}
              type="button"
              onClick={() => setAssetClass(ac)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase ${
                assetClass === ac
                  ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                  : 'border-desk-border text-desk-muted'
              }`}
            >
              {ac === 'stock' ? 'US Stocks' : 'Crypto'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border-b border-desk-border/50 px-3 py-2">
          <Search size={12} className="text-desk-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol…"
            className="w-full bg-transparent text-[11px] outline-none"
          />
        </div>

        {currentSymbol && (
          <p className="px-3 py-1.5 text-[10px] text-desk-muted">
            Active: <span className="text-desk-info">{currentSymbol}</span>
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((inst) => (
              <button
                key={`${inst.symbol}-${inst.exchange}`}
                type="button"
                onClick={() => {
                  onSelect(inst)
                  onClose()
                }}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  currentSymbol === inst.symbol
                    ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                    : 'border-desk-border/50 text-desk-muted hover:border-desk-border hover:text-desk-text'
                }`}
              >
                <div className="text-[12px] font-semibold">{inst.symbol}</div>
                <div className="truncate text-[9px] text-desk-muted">{inst.exchange}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}