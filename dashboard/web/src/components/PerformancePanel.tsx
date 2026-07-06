import ReactECharts from 'echarts-for-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'

export function PerformancePanel({ frame }: { frame: ReplayFrame | null }) {
  const pnlTone = frame && frame.total_pnl >= 0 ? 'profit' : 'loss'

  const chartOption = {
    backgroundColor: 'transparent',
    grid: { left: 28, right: 8, top: 8, bottom: 20 },
    xAxis: {
      type: 'category',
      data: frame?.pnl_timeline.map((p) => String(p.timestamp)) ?? [],
      axisLabel: { show: false },
      axisLine: { lineStyle: { color: '#1E2430' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6B7280', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1E2430', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: frame?.pnl_timeline.map((p) => p.pnl) ?? [],
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#00E676', width: 1.5 },
        areaStyle: { color: 'rgba(0,230,118,0.08)' },
      },
    ],
  }

  return (
    <GlassPanel title="Performance Analytics" className="h-full">
      <div className="grid grid-cols-4 gap-1.5 p-2">
        <MetricCard label="Total PnL" value={(frame?.total_pnl ?? 0).toFixed(4)} tone={pnlTone} />
        <MetricCard label="Realized" value={(frame?.realized_pnl ?? 0).toFixed(4)} tone="profit" />
        <MetricCard label="Unrealized" value={(frame?.unrealized_pnl ?? 0).toFixed(4)} tone="warn" />
        <MetricCard label="Fees" value={(frame?.transaction_fees ?? 0).toFixed(4)} tone="loss" />
        <MetricCard label="Spread Capture" value={(frame?.spread_capture ?? 0).toFixed(4)} />
        <MetricCard label="Inv MTM" value={(frame?.inventory_mtm ?? 0).toFixed(4)} />
        <MetricCard label="Adv. Selection" value={(frame?.adverse_selection_cost ?? 0).toFixed(4)} tone="loss" />
        <MetricCard label="Sharpe" value={frame?.sharpe_ratio?.toFixed(2) ?? '—'} />
        <MetricCard label="Sortino" value={frame?.sortino_ratio?.toFixed(2) ?? '—'} />
        <MetricCard label="Max DD" value={(frame?.max_drawdown ?? 0).toFixed(4)} tone="loss" />
        <MetricCard label="Fill Rate" value={`${((frame?.fill_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Win Rate" value={`${((frame?.win_rate ?? 0) * 100).toFixed(1)}%`} />
      </div>
      <div className="h-24 px-1 pb-2">
        <ReactECharts option={chartOption} style={{ height: '100%' }} notMerge lazyUpdate />
      </div>
    </GlassPanel>
  )
}