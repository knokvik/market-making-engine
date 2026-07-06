import { SymbolPickerDrawer } from './SymbolPickerDrawer'
import { useLiveTrader } from '../hooks/LiveTraderContext'
import type { InstrumentOption } from '../types'

interface LiveDeskExtrasProps {
  onSelectInstrument: (instrument: InstrumentOption) => void
}

export function LiveDeskExtras({ onSelectInstrument }: LiveDeskExtrasProps) {
  const { selectedSymbol, setSelectedSymbol, setAssetClass, pickerOpen, setPickerOpen } = useLiveTrader()

  return (
    <div
      className={`absolute inset-0 z-[55] ${pickerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!pickerOpen}
    >
      <SymbolPickerDrawer
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      currentSymbol={selectedSymbol}
      onSelect={(inst) => {
        setSelectedSymbol(inst.symbol)
        setAssetClass(inst.asset_class === 'crypto' ? 'crypto' : 'stock')
        onSelectInstrument(inst)
      }}
    />
    </div>
  )
}