import clsx from 'clsx'
import { Trophy } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import type { ReplayFrame } from '../types'

const STRATEGY_LABELS: Record<string, string> = {
  symmetric: 'Symmetric',
  avellaneda_stoikov: 'Avellaneda-Stoikov',
  glft: 'GLFT',
  custom: 'Custom',
}

export function StrategyComparisonPanel({ frame }: { frame: ReplayFrame | null }) {
  const rows = frame?.strategy_comparison ?? []

  return (
    <GlassPanel title="Live Strategy Comparison" className="h-full" action={<Trophy size={14} className="text-desk-warn" />}>
      <div className="overflow-auto p-1">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-desk-border/50 text-left uppercase tracking-wider text-desk-muted">
              <th className="px-1.5 py-1">Strategy</th>
              <th className="px-1.5 py-1">PnL</th>
              <th className="px-1.5 py-1">Inv</th>
              <th className="px-1.5 py-1">Sharpe</th>
              <th className="px-1.5 py-1">MaxDD</th>
              <th className="px-1.5 py-1">Fill%</th>
              <th className="px-1.5 py-1">Win%</th>
              <th className="px-1.5 py-1">Spread</th>
              <th className="px-1.5 py-1">Adv.Sel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.strategy}
                className={clsx(
                  'border-b border-desk-border/20 font-mono transition',
                  row.is_best && 'bg-desk-info/10 ring-1 ring-inset ring-desk-info/30',
                )}
              >
                <td className="px-1.5 py-1 font-medium">
                  {STRATEGY_LABELS[row.strategy] ?? row.strategy}
                  {row.is_best && <span className="ml-1 text-desk-warn">★</span>}
                </td>
                <td className={clsx('px-1.5 py-1', row.total_pnl >= 0 ? 'text-desk-profit' : 'text-desk-loss')}>
                  {row.total_pnl.toFixed(2)}
                </td>
                <td className="px-1.5 py-1">{row.position}</td>
                <td className="px-1.5 py-1">{row.sharpe?.toFixed(2) ?? '—'}</td>
                <td className="px-1.5 py-1 text-desk-loss">{row.max_drawdown.toFixed(2)}</td>
                <td className="px-1.5 py-1">{(row.fill_rate * 100).toFixed(0)}%</td>
                <td className="px-1.5 py-1">{(row.win_rate * 100).toFixed(0)}%</td>
                <td className="px-1.5 py-1">{row.spread_capture.toFixed(2)}</td>
                <td className="px-1.5 py-1 text-desk-warn">{row.adverse_selection_cost.toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-desk-muted">Running shadow strategies…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassPanel>
  )
}