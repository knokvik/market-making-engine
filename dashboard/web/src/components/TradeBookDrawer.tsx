import { SideDrawer } from './SideDrawer'
import { TradeBookPage } from '../pages/TradeBookPage'

interface TradeBookDrawerProps {
  open: boolean
  onClose: () => void
  frameIndex?: number
  symbol?: string
  algoActive?: boolean
}

export function TradeBookDrawer({ open, onClose, frameIndex, symbol, algoActive }: TradeBookDrawerProps) {
  const title = symbol ? `Paper Trade Book · ${symbol}` : 'Paper Trade Book'
  return (
    <SideDrawer open={open} onClose={onClose} title={title} width="min(560px, 48vw)">
      <TradeBookPage frameIndex={frameIndex} symbol={symbol} algoActive={algoActive} embedded />
    </SideDrawer>
  )
}