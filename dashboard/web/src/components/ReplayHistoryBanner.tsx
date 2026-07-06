import { History } from 'lucide-react'
import type { ReplayHistoryEntry } from '../hooks/useReplayHistory'

interface ReplayHistoryBannerProps {
  history: ReplayHistoryEntry
}

export function ReplayHistoryBanner({ history }: ReplayHistoryBannerProps) {
  return (
    <div className="mx-2 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-desk-border/60 bg-desk-panel/80 px-3 py-1.5 text-[10px]">
      <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-desk-info">
        <History size={11} /> Last session
      </span>
      <span className="text-desk-muted">
        {history.dataset_name} · {history.exchange} · {history.symbol}
      </span>
      <span className={history.total_pnl >= 0 ? 'text-desk-profit' : 'text-desk-loss'}>
        PnL {history.total_pnl.toFixed(2)}
      </span>
      <span className="text-desk-muted">Fills {history.fill_count}</span>
      <span className="text-desk-muted">Progress {history.progress_pct.toFixed(0)}%</span>
      {history.sharpe_ratio != null && (
        <span className="text-desk-muted">Sharpe {history.sharpe_ratio.toFixed(2)}</span>
      )}
      <span className="text-desk-muted">@ {history.replay_time_display}</span>
    </div>
  )
}