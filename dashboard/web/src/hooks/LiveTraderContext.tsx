import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ChartDisplayType, LiveChartRange } from '../types'
import { DEFAULT_CHART_RANGE } from '../types'

export const DEFAULT_LIVE_SYMBOL = 'NVDA'

interface LiveTraderContextValue {
  selectedSymbol: string
  setSelectedSymbol: (symbol: string) => void
  assetClass: 'stock' | 'crypto'
  setAssetClass: (ac: 'stock' | 'crypto') => void
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  chartType: ChartDisplayType
  setChartType: (type: ChartDisplayType) => void
  chartRange: LiveChartRange
  setChartRange: (range: LiveChartRange) => void
}

const LiveTraderContext = createContext<LiveTraderContextValue | null>(null)

export function LiveTraderProvider({ children }: { children: ReactNode }) {
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_LIVE_SYMBOL)
  const [assetClass, setAssetClass] = useState<'stock' | 'crypto'>('stock')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [chartType, setChartType] = useState<ChartDisplayType>('mountain')
  const [chartRange, setChartRange] = useState<LiveChartRange>(DEFAULT_CHART_RANGE)
  return (
    <LiveTraderContext.Provider
      value={{
        selectedSymbol,
        setSelectedSymbol,
        assetClass,
        setAssetClass,
        pickerOpen,
        setPickerOpen,
        chartType,
        setChartType,
        chartRange,
        setChartRange,
      }}
    >
      {children}
    </LiveTraderContext.Provider>
  )
}

export function useLiveTrader() {
  const ctx = useContext(LiveTraderContext)
  if (!ctx) throw new Error('useLiveTrader must be used within LiveTraderProvider')
  return ctx
}