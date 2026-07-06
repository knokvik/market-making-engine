import { useCallback, useEffect, useState } from 'react'
import { Search, Wifi } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import type { DataMode, InstrumentOption, ReplayFrame } from '../types'

interface InstrumentPickerPanelProps {
  frame: ReplayFrame | null
  sessionMode: DataMode
  onConnect: (instrument: InstrumentOption, mode: DataMode) => void
}

export function InstrumentPickerPanel({ frame, sessionMode, onConnect }: InstrumentPickerPanelProps) {
  const [assetClass, setAssetClass] = useState<'crypto' | 'stock'>('crypto')
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InstrumentOption | null>(null)

  useEffect(() => {
    fetch(`/api/instruments?asset_class=${assetClass}`)
      .then((r) => r.json())
      .then((d) => setInstruments(d.instruments ?? []))
      .catch(() => setInstruments([]))
  }, [assetClass])

  const filtered = instruments.filter(
    (i) =>
      i.symbol.toLowerCase().includes(search.toLowerCase()) ||
      i.label.toLowerCase().includes(search.toLowerCase()),
  )

  const handleConnect = useCallback(() => {
    if (!selected) return
    onConnect(selected, sessionMode)
  }, [selected, sessionMode, onConnect])

  return (
    <GlassPanel title="Instrument Picker" className="h-full">
      <div className="flex h-full flex-col gap-2 p-2 text-xs">
        <div className="flex gap-1">
          {(['crypto', 'stock'] as const).map((ac) => (
            <button
              key={ac}
              onClick={() => setAssetClass(ac)}
              className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase ${
                assetClass === ac
                  ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                  : 'border-desk-border text-desk-muted'
              }`}
            >
              {ac === 'crypto' ? 'Crypto' : 'Stocks'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded border border-desk-border bg-black/20 px-2 py-1">
          <Search size={12} className="text-desk-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol…"
            className="w-full bg-transparent text-[10px] outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-auto">
          {filtered.map((inst) => (
            <button
              key={`${inst.symbol}-${inst.exchange}`}
              onClick={() => setSelected(inst)}
              className={`w-full rounded border px-2 py-1 text-left text-[10px] ${
                selected?.symbol === inst.symbol && selected?.exchange === inst.exchange
                  ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                  : 'border-desk-border/40 text-desk-muted hover:text-desk-text'
              }`}
            >
              {inst.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleConnect}
          disabled={!selected}
          className="toolbar-btn w-full justify-center border-desk-info/40 bg-desk-info/10 text-desk-info disabled:opacity-40"
        >
          <Wifi size={11} /> Connect {selected?.symbol ?? '…'}
        </button>

        {frame && (
          <div className="rounded border border-desk-warn/30 bg-desk-warn/5 px-2 py-1 text-[9px] text-desk-warn">
            PAPER SIM — real market data, simulated orders only
          </div>
        )}
      </div>
    </GlassPanel>
  )
}