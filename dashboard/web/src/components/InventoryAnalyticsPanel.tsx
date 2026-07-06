import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { ReplayFrame } from '../types'

const C = THEME.chart

export function InventoryAnalyticsPanel({ frame }: { frame: ReplayFrame | null }) {
  const { chartRef, containerRef } = useChartResize()
  const invPct = frame ? (Math.abs(frame.position) / Math.max(frame.max_abs_inventory, 1)) * 100 : 0

  const option = useMemo(() => {
    const timeline = frame?.inventory_timeline ?? []
    const dist = frame?.inventory_distribution ?? []
    const heatmap = frame?.inventory_heatmap ?? []

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: [
        { left: 32, right: 8, top: 8, height: '38%' },
        { left: 32, right: 8, top: '52%', height: '22%' },
        { left: 32, right: 8, top: '78%', height: '18%' },
      ],
      xAxis: [
        { type: 'category', gridIndex: 0, data: timeline.map((p) => String(p.timestamp)), show: false },
        { type: 'category', gridIndex: 1, data: dist.map((d) => String(d.position)), axisLabel: { color: C.axis, fontSize: 8 } },
        { type: 'category', gridIndex: 2, data: heatmap.map((h) => String(h.timestamp)), show: false },
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, axisLabel: { color: C.axis, fontSize: 8 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
        { type: 'value', gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false } },
        { type: 'value', gridIndex: 2, max: 1, axisLabel: { show: false }, splitLine: { show: false } },
      ],
      series: [
        { type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: timeline.map((p) => p.position), showSymbol: false, lineStyle: { color: THEME.info, width: 1.5 }, areaStyle: { color: 'rgba(107,140,174,0.08)' } },
        { type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: dist.map((d) => d.count), itemStyle: { color: THEME.info } },
        { type: 'bar', xAxisIndex: 2, yAxisIndex: 2, data: heatmap.map((h) => h.intensity), itemStyle: { color: (p: { dataIndex: number }) => `rgba(255,176,32,${0.3 + (heatmap[p.dataIndex]?.intensity ?? 0) * 0.7})` } },
      ],
    }
  }, [frame])

  return (
    <GlassPanel title="Inventory Analytics" className="h-full">
      <div className="grid shrink-0 grid-cols-3 gap-1 p-1">
        <MetricCard label="Current" value={frame?.position ?? 0} />
        <MetricCard label="Avg Inv" value={(frame?.avg_abs_inventory ?? 0).toFixed(1)} />
        <MetricCard label="Max Inv" value={frame?.max_abs_inventory ?? 0} />
      </div>
      <div className="px-2 pb-1">
        <div className="mb-0.5 flex justify-between text-[9px] uppercase text-desk-muted">
          <span>Exposure Gauge</span>
          <span>${(frame?.exposure ?? 0).toFixed(0)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-desk-border">
          <div className="h-full rounded-full bg-gradient-to-r from-desk-info to-desk-warn transition-all" style={{ width: `${Math.min(invPct, 100)}%` }} />
        </div>
      </div>
      <div ref={containerRef} className="chart-container min-h-0 flex-1 px-1 pb-1">
        <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
      </div>
    </GlassPanel>
  )
}