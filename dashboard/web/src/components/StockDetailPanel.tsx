import { useEffect } from 'react'
import { BarChart3, ChevronDown } from 'lucide-react'
import { LivePriceChart } from './LivePriceChart'
import { GlassPanel } from './ui/GlassPanel'
import { useFrame } from '../hooks/useFrame'
import { useLiveTrader } from '../hooks/LiveTraderContext'

interface StockDetailPanelProps {
  onViewStock?: (symbol: string) => void
}

export function StockDetailPanel({ onViewStock }: StockDetailPanelProps) {
  const frame = useFrame()
  const { selectedSymbol, setPickerOpen, chartType } = useLiveTrader()

  useEffect(() => {
    onViewStock?.(selectedSymbol)
  }, [selectedSymbol, onViewStock])

  return (
    <GlassPanel
      title={
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="panel-no-drag flex items-center gap-1 text-sm font-semibold text-desk-text hover:text-desk-info"
        >
          {selectedSymbol}
          <ChevronDown size={12} className="text-desk-muted" />
        </button>
      }
      className="h-full"
      action={<BarChart3 size={14} className="text-desk-info" />}
      badge="live"
    >
      <LivePriceChart frame={frame} chartType={chartType} symbol={selectedSymbol} />
    </GlassPanel>
  )
}