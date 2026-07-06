import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { GlassPanel } from './ui/GlassPanel'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { ReplayFrame } from '../types'

const C = THEME.chart

export function PnlDecompositionPanel({ frame }: { frame: ReplayFrame | null }) {
  const { chartRef, containerRef } = useChartResize()
  const d = frame?.pnl_decomposition

  const option = useMemo(() => {
    if (!d) return {}
    const components = [
      { name: 'Realized', value: d.realized_pnl, color: THEME.profit },
      { name: 'Unrealized', value: d.unrealized_pnl, color: C.secondary },
      { name: 'Spread Cap.', value: d.spread_capture, color: '#666666' },
      { name: 'Inv. Loss', value: d.inventory_loss, color: THEME.loss },
      { name: 'Fees', value: -Math.abs(d.transaction_fees), color: C.axis },
      { name: 'Slippage', value: -Math.abs(d.slippage), color: THEME.warn },
      { name: 'Adv. Sel.', value: -Math.abs(d.adverse_selection), color: '#CC6688' },
    ]

    let cumulative = 0
    const waterfall = components.map((c) => {
      const start = cumulative
      cumulative += c.value
      return { ...c, start, end: cumulative }
    })

    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 12, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: [...components.map((c) => c.name), 'Net PnL'], axisLabel: { color: C.axis, fontSize: 9, rotate: 30 }, axisLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: 'value', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      series: [
        {
          type: 'bar',
          stack: 'wf',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          data: [...waterfall.map((w) => w.start), 0],
          silent: true,
        },
        {
          type: 'bar',
          stack: 'wf',
          data: [
            ...waterfall.map((w) => ({ value: w.value, itemStyle: { color: w.color } })),
            { value: d.net_pnl, itemStyle: { color: d.net_pnl >= 0 ? THEME.profit : THEME.loss } },
          ],
          label: { show: true, position: 'top', fontSize: 8, color: C.axis, formatter: (p: { value: number }) => p.value.toFixed(2) },
        },
      ],
      tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: THEME.text, fontSize: 10 } },
    }
  }, [d])

  return (
    <GlassPanel title="PnL Decomposition" className="h-full">
      <div ref={containerRef} className="chart-container p-1">
        <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
      </div>
    </GlassPanel>
  )
}