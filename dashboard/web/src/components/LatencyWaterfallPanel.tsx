import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GlassPanel } from './ui/GlassPanel'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { ReplayFrame } from '../types'
import { formatLatencyMs, latencyStats, niceAxisMax } from '../utils/latencyFormat'

const C = THEME.chart
const HISTORY_CAP = 240

export const LATENCY_STAGES = [
  { key: 'feed_latency', label: 'Feed' },
  { key: 'book_update', label: 'Book Update' },
  { key: 'strategy_compute', label: 'Strategy' },
  { key: 'risk_engine', label: 'Risk' },
  { key: 'quote_generation', label: 'Quote Generation' },
  { key: 'network', label: 'Network' },
  { key: 'execution', label: 'Execution' },
] as const

type StageKey = (typeof LATENCY_STAGES)[number]['key']

const STAGE_COLOR = '#5A6F8C'
const BOTTLENECK_COLOR = '#FF6B4A'

export function LatencyWaterfallPanel({ frame }: { frame: ReplayFrame | null }) {
  const { chartRef, containerRef } = useChartResize()
  const breakdown = frame?.latency_breakdown ?? {}
  const historyRef = useRef<Partial<Record<StageKey, number[]>>>({})
  const [historyTick, setHistoryTick] = useState(0)

  const stageValues = useMemo(
    () => LATENCY_STAGES.map((s) => breakdown[s.key] ?? 0),
    [breakdown],
  )

  const total = useMemo(() => {
    const explicit = breakdown.total
    if (typeof explicit === 'number' && explicit > 0) return explicit
    const e2e = frame?.end_to_end_latency_ms
    if (typeof e2e === 'number' && e2e > 0) return e2e
    const sum = stageValues.reduce((a, b) => a + b, 0)
    return sum > 0 ? sum : 0
  }, [breakdown, frame?.end_to_end_latency_ms, stageValues])

  const hasData = total > 0 && stageValues.some((v) => v > 0)

  useEffect(() => {
    if (!hasData) return
    let changed = false
    LATENCY_STAGES.forEach((stage, i) => {
      const v = stageValues[i]
      if (v <= 0) return
      const bucket = historyRef.current[stage.key] ?? []
      bucket.push(v)
      if (bucket.length > HISTORY_CAP) bucket.shift()
      historyRef.current[stage.key] = bucket
      changed = true
    })
    if (changed) setHistoryTick((t) => t + 1)
  }, [hasData, stageValues, frame?.frame_index, frame?.timestamp])

  const bottleneckIdx = useMemo(() => {
    let max = -1
    let idx = -1
    stageValues.forEach((v, i) => {
      if (v > max) {
        max = v
        idx = i
      }
    })
    return idx
  }, [stageValues])

  const stageStats = useMemo(() => {
    void historyTick
    return LATENCY_STAGES.map((stage, i) => ({
      ...stage,
      current: stageValues[i],
      pct: total > 0 ? (stageValues[i] / total) * 100 : 0,
      history: (() => {
        const bucket = historyRef.current[stage.key] ?? []
        const stats = latencyStats(bucket)
        const cur = stageValues[i]
        if (!bucket.length && cur > 0) {
          return { current: cur, avg: cur, min: cur, max: cur, p95: cur }
        }
        return { ...stats, current: cur }
      })(),
      isBottleneck: i === bottleneckIdx && stageValues[i] > 0,
    }))
  }, [stageValues, total, bottleneckIdx, historyTick])

  const option = useMemo(() => {
    const maxVal = Math.max(...stageValues, 0.001)
    const axisMax = niceAxisMax(maxVal)

    return {
      backgroundColor: 'transparent',
      grid: { left: 108, right: 72, top: 8, bottom: 8 },
      xAxis: {
        type: 'value',
        min: 0,
        max: axisMax,
        axisLabel: {
          color: C.axis,
          fontSize: 9,
          formatter: (v: number) => formatLatencyMs(v),
        },
        splitLine: { lineStyle: { color: C.grid, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: LATENCY_STAGES.map((s) => s.label),
        axisLabel: { color: C.axis, fontSize: 9 },
        axisLine: { lineStyle: { color: C.grid } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: stageStats.map((s) => ({
            value: s.current,
            itemStyle: {
              color: s.isBottleneck ? BOTTLENECK_COLOR : STAGE_COLOR,
              borderRadius: [0, 2, 2, 0],
            },
          })),
          barMaxWidth: 16,
          label: {
            show: true,
            position: 'right',
            fontSize: 8,
            color: C.axis,
            formatter: (p: { dataIndex?: number; value?: number }) => {
              const idx = p.dataIndex ?? 0
              const st = stageStats[idx]
              if (!st) return ''
              return `${formatLatencyMs(p.value ?? 0)} · ${st.pct.toFixed(0)}%`
            },
          },
        },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: C.tooltipBg,
        borderColor: C.tooltipBorder,
        textStyle: { color: THEME.text, fontSize: 10 },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params]
          const first = items[0] as { dataIndex?: number }
          const idx = first?.dataIndex ?? 0
          const st = stageStats[idx]
          if (!st) return ''
          const h = st.history
          const lines = [
            `<b>${st.label}</b>${st.isBottleneck ? ' <span style="color:#FF6B4A">(bottleneck)</span>' : ''}`,
            `Current: ${formatLatencyMs(st.current)} (${st.pct.toFixed(1)}% of pipeline)`,
            `Avg: ${formatLatencyMs(h.avg)}`,
            `Min: ${formatLatencyMs(h.min)} · Max: ${formatLatencyMs(h.max)}`,
            `P95: ${formatLatencyMs(h.p95)}`,
          ]
          return lines.join('<br/>')
        },
      },
    }
  }, [stageStats, stageValues])

  const bottleneck = bottleneckIdx >= 0 ? stageStats[bottleneckIdx] : null

  return (
    <GlassPanel title="Latency Analytics" className="h-full">
      <div ref={containerRef} className="flex h-full min-h-0 flex-col gap-2 p-2">
        <div className="grid shrink-0 grid-cols-2 gap-2 rounded border border-desk-border/50 bg-black/20 px-2.5 py-2 text-[10px] sm:grid-cols-3">
          <div>
            <div className="text-[8px] uppercase tracking-wider text-desk-muted">Total Pipeline</div>
            <div className="font-mono text-sm font-semibold text-desk-text">
              {hasData ? formatLatencyMs(total) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-wider text-desk-muted">Bottleneck</div>
            <div className={`font-mono text-sm font-semibold ${bottleneck ? 'text-desk-warn' : 'text-desk-muted'}`}>
              {bottleneck ? `${bottleneck.label} · ${bottleneck.pct.toFixed(0)}%` : '—'}
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[8px] uppercase tracking-wider text-desk-muted">Stages</div>
            <div className="font-mono text-sm text-desk-info">{LATENCY_STAGES.length} tracked</div>
          </div>
        </div>

        {!hasData ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-dashed border-desk-border/40 bg-black/10 px-4 text-center text-[11px] text-desk-muted">
            No latency measurements available
          </div>
        ) : (
          <div className="chart-container min-h-0 flex-1">
            <ReactECharts
              ref={chartRef}
              option={option}
              style={{ height: '100%', width: '100%', minHeight: 120 }}
              notMerge
              lazyUpdate={frame?.playing === true}
            />
          </div>
        )}
      </div>
    </GlassPanel>
  )
}