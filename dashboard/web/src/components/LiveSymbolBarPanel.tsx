import { ChevronDown, Search } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { useLiveTrader } from '../hooks/LiveTraderContext'
import type { ChartDisplayType, LiveChartRange } from '../types'

const CHART_TYPES: { id: ChartDisplayType; label: string }[] = [
  { id: 'line', label: 'Line' },
  { id: 'candlestick', label: 'Candles' },
  { id: 'area', label: 'Area' },
  { id: 'mountain', label: 'Mountain' },
]

const CHART_RANGES: { id: LiveChartRange; label: string }[] = [
  { id: '1D', label: '1D' },
  { id: '5D', label: '5D' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: '1Y', label: '1Y' },
  { id: '5Y', label: '5Y' },
  { id: 'MAX', label: 'Max' },
]

export function LiveSymbolBarPanel() {
  const { selectedSymbol, setPickerOpen, chartType, setChartType, chartRange, setChartRange } = useLiveTrader()

  return (
    <GlassPanel title="Symbol & Chart" className="h-full" draggable={false}>
      <div className="flex h-full flex-wrap items-center gap-2 px-2 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded border border-desk-info/40 bg-desk-info/10 px-3 py-1.5 text-[11px] font-semibold text-desk-info hover:border-desk-info/60"
        >
          <Search size={12} />
          {selectedSymbol}
          <ChevronDown size={12} />
        </button>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] uppercase text-desk-muted">Range</span>
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setChartRange(r.id)}
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
                chartRange === r.id
                  ? 'border-desk-info/50 bg-desk-info/10 text-desk-info'
                  : 'border-desk-border/50 text-desk-muted hover:text-desk-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span className="text-[9px] uppercase text-desk-muted">Chart</span>
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => setChartType(ct.id)}
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase transition ${
                chartType === ct.id
                  ? 'border-desk-profit/50 bg-desk-profit/10 text-desk-profit'
                  : 'border-desk-border/50 text-desk-muted hover:text-desk-text'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>
    </GlassPanel>
  )
}