import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { ReplayFrame } from '../types'

const C = THEME.chart

export function PerformancePanel({ frame }: { frame: ReplayFrame | null }) {
  const { chartRef, containerRef } = useChartResize()
  const pnlTone = frame && frame.total_pnl >= 0 ? 'profit' : 'loss'

  const chartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: [
      { left: 28, right: 8, top: 8, height: '42%' },
      { left: 28, right: 8, top: '55%', height: '38%' },
    ],
    xAxis: [
      { type: 'category', gridIndex: 0, data: frame?.pnl_timeline?.map((p) => String(p.timestamp)) ?? [], axisLabel: { show: false }, axisLine: { lineStyle: { color: C.grid } } },
      { type: 'category', gridIndex: 1, data: frame?.rolling_sharpe?.map((p) => String(p.timestamp)) ?? [], axisLabel: { show: false }, axisLine: { lineStyle: { color: C.grid } } },
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, axisLabel: { color: C.axis, fontSize: 8 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      { type: 'value', gridIndex: 1, axisLabel: { color: C.axis, fontSize: 8 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
    ],
    series: [
      {
        name: 'Rolling PnL',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: frame?.pnl_timeline?.map((p) => p.pnl) ?? [],
        smooth: true,
        showSymbol: false,
        lineStyle: { color: C.pnl, width: 1.5 },
        areaStyle: { color: 'rgba(68,255,137,0.06)' },
      },
      {
        name: 'Rolling Sharpe',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: frame?.rolling_sharpe?.map((p) => p.sharpe) ?? [],
        smooth: true,
        showSymbol: false,
        lineStyle: { color: C.sharpe, width: 1.5 },
      },
    ],
    tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: THEME.text, fontSize: 9 } },
  }), [frame])

  return (
    <GlassPanel title="Performance Analytics" className="h-full">
      <div className="grid shrink-0 grid-cols-4 gap-0.5 overflow-hidden p-1">
        <MetricCard label="Net PnL" value={(frame?.total_pnl ?? 0).toFixed(4)} tone={pnlTone} />
        <MetricCard label="Sharpe" value={frame?.sharpe_ratio?.toFixed(2) ?? '—'} />
        <MetricCard label="Sortino" value={frame?.sortino_ratio?.toFixed(2) ?? '—'} />
        <MetricCard label="Calmar" value={frame?.calmar_ratio?.toFixed(2) ?? '—'} />
        <MetricCard label="Max DD" value={(frame?.max_drawdown ?? 0).toFixed(4)} tone="loss" />
        <MetricCard label="Fill Rate" value={`${((frame?.fill_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Win Rate" value={`${((frame?.win_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Trades" value={frame?.fill_count ?? 0} />
        <MetricCard label="Avg Trade" value={(frame?.avg_trade_profit ?? 0).toFixed(4)} />
        <MetricCard label="Profit Factor" value={(frame?.profit_factor ?? 0).toFixed(2)} />
        <MetricCard label="Expectancy" value={(frame?.expectancy ?? 0).toFixed(4)} />
        <MetricCard label="σ (rolling)" value={(frame?.sigma ?? 0).toFixed(4)} />
      </div>
      <div ref={containerRef} className="chart-container min-h-0 flex-1 px-1 pb-1">
        <ReactECharts ref={chartRef} option={chartOption} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
      </div>
    </GlassPanel>
  )
}