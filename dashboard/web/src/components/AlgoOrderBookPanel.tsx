import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'

interface AlgoOrderBookPanelProps {
  frame: ReplayFrame | null
}

export function AlgoOrderBookPanel({ frame }: AlgoOrderBookPanelProps) {
  const ladder = frame?.book_ladder ?? []
  const pnlTone = frame && frame.total_pnl >= 0 ? 'profit' : 'loss'

  return (
    <GlassPanel title="Algo Order Book" className="h-full">
      <div className="grid grid-cols-4 gap-1 border-b border-desk-border/40 p-2">
        <MetricCard label="Session PnL" value={(frame?.total_pnl ?? 0).toFixed(2)} tone={pnlTone} />
        <MetricCard label="Inventory" value={String(frame?.position ?? 0)} />
        <MetricCard label="Our Bid" value={frame?.our_bid?.toFixed(4) ?? '—'} tone="profit" />
        <MetricCard label="Our Ask" value={frame?.our_ask?.toFixed(4) ?? '—'} tone="loss" />
      </div>
      <div className="overflow-auto p-1 font-mono text-[10px]">
        <table className="w-full">
          <thead>
            <tr className="text-[9px] uppercase text-desk-muted">
              <th className="px-1 py-0.5 text-right">Bid</th>
              <th className="px-1 py-0.5 text-center">Price</th>
              <th className="px-1 py-0.5 text-left">Ask</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((row) => {
              const isOurs = Boolean((row as { is_ours?: boolean }).is_ours)
              const executed = row.executed
              return (
                <tr
                  key={row.price}
                  className={`border-b border-desk-border/10 ${
                    isOurs ? 'bg-desk-info/10' : executed ? 'bg-desk-warn/5' : ''
                  }`}
                >
                  <td className="relative px-1 py-0.5 text-right text-desk-profit">
                    {row.bid_size > 0 && (
                      <span
                        className="absolute inset-y-0 right-0 bg-desk-profit/15"
                        style={{ width: `${row.bid_pct * 100}%` }}
                      />
                    )}
                    <span className="relative">{row.bid_size > 0 ? row.bid_size.toFixed(0) : ''}</span>
                  </td>
                  <td className={`px-1 py-0.5 text-center ${isOurs ? 'text-desk-info font-bold' : 'text-desk-text'}`}>
                    {row.price.toFixed(4)}
                    {executed && <span className="ml-1 text-desk-warn">●</span>}
                  </td>
                  <td className="relative px-1 py-0.5 text-left text-desk-loss">
                    {row.ask_size > 0 && (
                      <span
                        className="absolute inset-y-0 left-0 bg-desk-loss/15"
                        style={{ width: `${row.ask_pct * 100}%` }}
                      />
                    )}
                    <span className="relative">{row.ask_size > 0 ? row.ask_size.toFixed(0) : ''}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </GlassPanel>
  )
}