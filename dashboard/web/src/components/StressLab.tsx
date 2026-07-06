import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { GlassPanel } from './ui/GlassPanel'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { StressLabRow } from '../types'

const C = THEME.chart

const REGIME_ORDER = [
  'calm', 'normal', 'volatile', 'trending', 'flash_crash',
  'liquidity_crisis', 'gap_open', 'high_toxicity', 'low_liquidity',
]

interface StressLabProps {
  results: StressLabRow[]
  loading?: boolean
}

export function StressLab({ results, loading }: StressLabProps) {
  const { chartRef, containerRef } = useChartResize()

  const byRegime = useMemo(() => {
    const map = new Map<string, StressLabRow[]>()
    for (const r of results) {
      const list = map.get(r.regime) ?? []
      list.push(r)
      map.set(r.regime, list)
    }
    return REGIME_ORDER.map((regime) => {
      const rows = map.get(regime) ?? []
      const avgSharpe = rows.filter((r) => r.sharpe != null).reduce((s, r) => s + (r.sharpe ?? 0), 0) / Math.max(rows.filter((r) => r.sharpe != null).length, 1)
      const avgDd = rows.reduce((s, r) => s + r.max_drawdown, 0) / Math.max(rows.length, 1)
      const survival = rows.filter((r) => r.survival).length / Math.max(rows.length, 1)
      const avgFill = rows.reduce((s, r) => s + r.fill_rate, 0) / Math.max(rows.length, 1)
      return { regime, avgSharpe, avgDd, survival, avgFill, rows }
    })
  }, [results])

  const chartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { left: 80, right: 16, top: 24, bottom: 32 },
    legend: { top: 0, textStyle: { color: C.axis, fontSize: 10 } },
    xAxis: { type: 'category', data: byRegime.map((r) => r.regime.replace('_', ' ')), axisLabel: { color: C.axis, fontSize: 9, rotate: 25 }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: [
      { type: 'value', name: 'Sharpe', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      { type: 'value', name: 'Survival %', max: 1, axisLabel: { color: C.axis, fontSize: 9, formatter: (v: number) => `${(v * 100).toFixed(0)}%` } },
    ],
    series: [
      { name: 'Avg Sharpe', type: 'bar', data: byRegime.map((r) => r.avgSharpe.toFixed(2)), itemStyle: { color: THEME.info } },
      { name: 'Survival Rate', type: 'line', yAxisIndex: 1, data: byRegime.map((r) => r.survival), lineStyle: { color: THEME.info }, showSymbol: true, symbolSize: 6 },
      { name: 'Avg Drawdown', type: 'bar', data: byRegime.map((r) => -r.avgDd), itemStyle: { color: THEME.loss } },
    ],
    tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: THEME.text, fontSize: 10 } },
  }), [byRegime])

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <GlassPanel title="Stress Test Lab" className="shrink-0">
        <p className="px-3 py-2 text-xs text-desk-muted">
          Multi-regime simulation across calm, volatile, flash crash, liquidity crisis, and toxicity scenarios.
          {loading && <span className="ml-2 text-desk-info">Loading…</span>}
        </p>
      </GlassPanel>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <GlassPanel title="Regime Overview" className="min-h-0">
          <div ref={containerRef} className="chart-container p-1">
            <ReactECharts ref={chartRef} option={chartOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>

        <GlassPanel title="Detailed Results" className="min-h-0 overflow-hidden">
          <div className="h-full overflow-auto p-1">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-desk-border/50 text-left uppercase text-desk-muted">
                  <th className="px-1.5 py-1">Regime</th>
                  <th className="px-1.5 py-1">Strategy</th>
                  <th className="px-1.5 py-1">Return</th>
                  <th className="px-1.5 py-1">Sharpe</th>
                  <th className="px-1.5 py-1">MaxDD</th>
                  <th className="px-1.5 py-1">Fill%</th>
                  <th className="px-1.5 py-1">Survival</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-desk-border/20 font-mono">
                    <td className="px-1.5 py-1">{r.regime.replace('_', ' ')}</td>
                    <td className="px-1.5 py-1">{r.strategy}</td>
                    <td className={`px-1.5 py-1 ${r.total_return >= 0 ? 'text-desk-profit' : 'text-desk-loss'}`}>{r.total_return.toFixed(2)}</td>
                    <td className="px-1.5 py-1">{r.sharpe?.toFixed(2) ?? '—'}</td>
                    <td className="px-1.5 py-1 text-desk-loss">{r.max_drawdown.toFixed(2)}</td>
                    <td className="px-1.5 py-1">{(r.fill_rate * 100).toFixed(0)}%</td>
                    <td className="px-1.5 py-1">{r.survival ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}