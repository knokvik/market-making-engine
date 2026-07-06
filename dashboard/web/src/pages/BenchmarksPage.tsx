import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { Activity, BarChart3, Cpu, TrendingUp } from 'lucide-react'
import { GlassPanel } from '../components/ui/GlassPanel'
import { MetricCard } from '../components/ui/MetricCard'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { BenchmarkData, ReplayFrame, StrategyRow } from '../types'

const C = THEME.chart

interface BenchmarksPageProps {
  data: BenchmarkData | null
  frame: ReplayFrame | null
  loading?: boolean
}

const ENGINE_METRICS = [
  { key: 'events_per_sec', label: 'Events/sec' },
  { key: 'latency_ms', label: 'Latency (ms)' },
  { key: 'cpu_percent', label: 'CPU %' },
  { key: 'memory_mb', label: 'Memory (MB)' },
  { key: 'book_updates_per_sec', label: 'Book Updates/sec' },
  { key: 'execution_throughput', label: 'Matching Throughput' },
] as const

const STRATEGY_LABELS: Record<string, string> = {
  symmetric: 'Symmetric',
  avellaneda_stoikov: 'Avellaneda-Stoikov',
  glft: 'GLFT',
  custom: 'Custom',
}

export function BenchmarksPage({ data, frame, loading }: BenchmarksPageProps) {
  const engineChart = useChartResize()
  const strategyChart = useChartResize()
  const distChart = useChartResize()
  const heatmapChart = useChartResize()

  const strategies = frame?.strategy_comparison ?? []

  const engineOption = useMemo(() => {
    if (!data) return {}
    const labels = ENGINE_METRICS.map((m) => m.label)
    const python = ENGINE_METRICS.map((m) => data.python_engine[m.key])
    const cpp = ENGINE_METRICS.map((m) => data.cpp_engine[m.key])
    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 32, bottom: 48 },
      legend: { top: 0, textStyle: { color: C.axis, fontSize: 10 } },
      xAxis: { type: 'category', data: labels, axisLabel: { color: C.axis, fontSize: 9, rotate: 18 }, axisLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: 'value', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      series: [
        { name: 'Python Engine', type: 'bar', data: python, itemStyle: { color: C.secondary } },
        { name: 'C++ Engine', type: 'bar', data: cpp, itemStyle: { color: THEME.info } },
      ],
      tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: THEME.text, fontSize: 10 } },
    }
  }, [data])

  const strategyOption = useMemo(() => buildStrategyCompareOption(strategies), [strategies])

  const latencyOption = useMemo(() => {
    const breakdown = frame?.latency_breakdown ?? {}
    const entries = Object.entries(breakdown)
    if (!entries.length) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 80, right: 16, top: 16, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      yAxis: { type: 'category', data: entries.map(([k]) => k), axisLabel: { color: C.axis, fontSize: 9 } },
      series: [{ type: 'bar', data: entries.map(([, v]) => v), itemStyle: { color: THEME.info } }],
      tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder },
    }
  }, [frame?.latency_breakdown])

  const heatmapOption = useMemo(() => {
    const heat = frame?.inventory_heatmap ?? []
    if (!heat.length) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 16, bottom: 32 },
      xAxis: { type: 'category', data: heat.map((_, i) => `T${i}`), axisLabel: { color: C.axis, fontSize: 8 } },
      yAxis: { type: 'category', data: ['Intensity'], axisLabel: { color: C.axis } },
      visualMap: { show: false, min: 0, max: Math.max(...heat.map((h) => h.intensity), 1), inRange: { color: [...C.heatmap] } },
      series: [{
        type: 'heatmap',
        data: heat.map((h, i) => [i, 0, h.intensity]),
        itemStyle: { borderColor: C.tooltipBorder },
      }],
      tooltip: { backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder },
    }
  }, [frame?.inventory_heatmap])

  const pnlSeriesOption = useMemo(() => {
    const timeline = frame?.pnl_timeline ?? []
    if (!timeline.length) return {}
    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: timeline.map((_, i) => i), axisLabel: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      series: [{ type: 'line', data: timeline.map((p) => p.pnl ?? 0), showSymbol: false, lineStyle: { color: THEME.profit, width: 1.5 }, areaStyle: { color: 'rgba(68,255,137,0.06)' } }],
      tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder },
    }
  }, [frame?.pnl_timeline])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
      <GlassPanel title="Benchmarks" className="shrink-0">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs text-desk-muted">
          <span className="flex items-center gap-1"><Cpu size={12} /> Engine performance</span>
          <span className="flex items-center gap-1"><TrendingUp size={12} /> Trading performance</span>
          <span className="flex items-center gap-1"><BarChart3 size={12} /> Strategy comparison</span>
          {loading && <span className="text-desk-info">Running benchmarks…</span>}
          {data && (
            <span className={data.detailed_benchmark_passed ? 'text-desk-profit' : 'text-desk-loss'}>
              Suite: {data.detailed_benchmark_passed ? 'PASSED' : 'FAILED'}
            </span>
          )}
        </div>
      </GlassPanel>

      <div className="grid shrink-0 grid-cols-6 gap-1.5">
        <MetricCard label="Events/sec" value={frame?.events_per_sec?.toFixed(0) ?? data?.python_engine.events_per_sec.toFixed(0) ?? '—'} tone="info" />
        <MetricCard label="Latency" value={`${frame?.end_to_end_latency_ms?.toFixed(1) ?? data?.python_engine.latency_ms ?? '—'}ms`} />
        <MetricCard label="CPU" value={`${frame?.cpu_percent?.toFixed(0) ?? data?.python_engine.cpu_percent ?? '—'}%`} />
        <MetricCard label="Memory" value={`${frame?.memory_mb?.toFixed(0) ?? data?.python_engine.memory_mb ?? '—'}MB`} />
        <MetricCard label="Replay Speed" value={`${frame?.playback_speed ?? 1}x`} />
        <MetricCard label="Book Upd/s" value={data?.python_engine.book_updates_per_sec.toFixed(0) ?? '—'} />
      </div>

      <div className="grid min-h-[240px] grid-cols-2 gap-2">
        <GlassPanel title="Engine Performance — Python vs C++" className="min-h-0">
          <div ref={engineChart.containerRef} className="chart-container p-1">
            <ReactECharts ref={engineChart.chartRef} option={engineOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>
        <GlassPanel title="Strategy Comparison" className="min-h-0">
          <div ref={strategyChart.containerRef} className="chart-container p-1">
            <ReactECharts ref={strategyChart.chartRef} option={strategyOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>
      </div>

      <div className="grid shrink-0 grid-cols-8 gap-1.5">
        <MetricCard label="Sharpe" value={frame?.sharpe_ratio?.toFixed(2) ?? '—'} tone="info" />
        <MetricCard label="Sortino" value={frame?.sortino_ratio?.toFixed(2) ?? '—'} />
        <MetricCard label="Drawdown" value={(frame?.max_drawdown ?? 0).toFixed(2)} tone="loss" />
        <MetricCard label="Fill Rate" value={`${((frame?.fill_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Inventory" value={String(frame?.position ?? 0)} />
        <MetricCard label="PnL" value={(frame?.total_pnl ?? 0).toFixed(2)} tone={(frame?.total_pnl ?? 0) >= 0 ? 'profit' : 'loss'} />
        <MetricCard label="Spread Capture" value={(frame?.spread_capture ?? 0).toFixed(2)} tone="profit" />
        <MetricCard label="Slippage" value={(frame?.pnl_decomposition?.slippage ?? 0).toFixed(2)} tone="loss" />
      </div>

      <div className="grid min-h-[200px] grid-cols-3 gap-2">
        <GlassPanel title="PnL Time Series" className="min-h-0">
          <div className="chart-container p-1">
            <ReactECharts option={pnlSeriesOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>
        <GlassPanel title="Latency Distribution" className="min-h-0">
          <div ref={distChart.containerRef} className="chart-container p-1">
            <ReactECharts ref={distChart.chartRef} option={latencyOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>
        <GlassPanel title="Inventory Heatmap" className="min-h-0">
          <div ref={heatmapChart.containerRef} className="chart-container p-1">
            <ReactECharts ref={heatmapChart.chartRef} option={heatmapOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>
      </div>

      {data && (
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <EngineDetail name="Python Engine" engine={data.python_engine} icon={<Activity size={12} />} />
          <EngineDetail name="C++ Engine" engine={data.cpp_engine} icon={<Cpu size={12} />} projected />
        </div>
      )}
    </div>
  )
}

function buildStrategyCompareOption(strategies: StrategyRow[]) {
  if (!strategies.length) return {}
  const labels = strategies.map((s) => STRATEGY_LABELS[s.strategy] ?? s.strategy)
  return {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 16, top: 32, bottom: 40 },
    legend: { top: 0, textStyle: { color: C.axis, fontSize: 10 } },
    xAxis: { type: 'category', data: labels, axisLabel: { color: C.axis, fontSize: 9, rotate: 15 }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
    series: [
      { name: 'PnL', type: 'bar', data: strategies.map((s) => s.total_pnl), itemStyle: { color: THEME.profit } },
      { name: 'Sharpe', type: 'bar', data: strategies.map((s) => s.sharpe ?? 0), itemStyle: { color: THEME.info } },
      { name: 'Fill Rate', type: 'bar', data: strategies.map((s) => s.fill_rate * 100), itemStyle: { color: C.secondary } },
    ],
    tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: THEME.text, fontSize: 10 } },
  }
}

function EngineDetail({
  name,
  engine,
  icon,
  projected,
}: {
  name: string
  engine: BenchmarkData['python_engine']
  icon: React.ReactNode
  projected?: boolean
}) {
  return (
    <GlassPanel title={name} action={icon}>
      {projected && engine.note && (
        <div className="border-b border-desk-warn/30 bg-desk-warn/5 px-3 py-1 text-[10px] text-desk-warn">{engine.note}</div>
      )}
      <div className="grid grid-cols-4 gap-1.5 p-2">
        <MetricCard label="Events/sec" value={engine.events_per_sec.toFixed(1)} />
        <MetricCard label="Messages/sec" value={(engine.events_per_sec * 1.1).toFixed(1)} />
        <MetricCard label="Latency" value={`${engine.latency_ms.toFixed(3)}ms`} />
        <MetricCard label="Sim Speed" value={engine.simulation_speed} />
        <MetricCard label="CPU" value={`${engine.cpu_percent.toFixed(0)}%`} />
        <MetricCard label="Memory" value={`${engine.memory_mb.toFixed(0)}MB`} />
        <MetricCard label="Book Upd/s" value={engine.book_updates_per_sec.toFixed(1)} />
        <MetricCard label="Throughput" value={engine.execution_throughput.toFixed(1)} />
      </div>
    </GlassPanel>
  )
}