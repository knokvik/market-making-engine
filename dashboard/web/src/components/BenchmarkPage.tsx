import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { Cpu, Zap } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import { useChartResize } from '../hooks/useChartResize'
import { THEME } from '../theme'
import type { BenchmarkData } from '../types'

const C = THEME.chart

interface BenchmarkPageProps {
  data: BenchmarkData | null
  loading?: boolean
}

const METRICS = [
  { key: 'events_per_sec', label: 'Events/sec' },
  { key: 'latency_ms', label: 'Latency (ms)' },
  { key: 'cpu_percent', label: 'CPU %' },
  { key: 'memory_mb', label: 'Memory (MB)' },
  { key: 'book_updates_per_sec', label: 'Book Updates/sec' },
  { key: 'execution_throughput', label: 'Exec Throughput' },
] as const

export function BenchmarkPage({ data, loading }: BenchmarkPageProps) {
  const { chartRef, containerRef } = useChartResize()

  const chartOption = useMemo(() => {
    if (!data) return {}
    const labels = METRICS.map((m) => m.label)
    const python = METRICS.map((m) => data.python_engine[m.key])
    const cpp = METRICS.map((m) => data.cpp_engine[m.key])

    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 32, bottom: 48 },
      legend: { top: 0, textStyle: { color: C.axis, fontSize: 10 } },
      xAxis: { type: 'category', data: labels, axisLabel: { color: C.axis, fontSize: 9, rotate: 20 }, axisLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: 'value', axisLabel: { color: C.axis, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid, type: 'dashed' } } },
      series: [
        { name: 'Python Engine', type: 'bar', data: python, itemStyle: { color: C.secondary } },
        { name: 'C++ Engine', type: 'bar', data: cpp, itemStyle: { color: THEME.info } },
      ],
      tooltip: { trigger: 'axis', backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: THEME.text, fontSize: 10 } },
    }
  }, [data])

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <GlassPanel title="Engine Benchmark" className="shrink-0">
        <div className="flex items-center gap-4 px-3 py-2 text-xs text-desk-muted">
          <span className="flex items-center gap-1"><Cpu size={12} /> Python vs C++ implementation comparison</span>
          {loading && <span className="text-desk-info">Running benchmark…</span>}
          {data && (
            <span className={data.detailed_benchmark_passed ? 'text-desk-profit' : 'text-desk-loss'}>
              Detailed suite: {data.detailed_benchmark_passed ? 'PASSED' : 'FAILED'}
            </span>
          )}
        </div>
      </GlassPanel>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <GlassPanel title="Throughput Comparison" className="min-h-0">
          <div ref={containerRef} className="chart-container p-1">
            <ReactECharts ref={chartRef} option={chartOption} style={{ height: '100%' }} notMerge lazyUpdate />
          </div>
        </GlassPanel>

        <div className="flex min-h-0 flex-col gap-2">
          <EngineCard name="Python Engine" icon={<Zap size={14} className="text-desk-muted" />} engine={data?.python_engine} />
          <EngineCard name="C++ Engine" icon={<Zap size={14} className="text-desk-info" />} engine={data?.cpp_engine} projected />
        </div>
      </div>
    </div>
  )
}

function EngineCard({
  name,
  icon,
  engine,
  projected,
}: {
  name: string
  icon: React.ReactNode
  engine?: BenchmarkData['python_engine']
  projected?: boolean
}) {
  if (!engine) {
    return (
      <GlassPanel title={name} className="flex-1">
        <div className="p-4 text-center text-xs text-desk-muted">No data</div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel title={name} className="flex-1" action={icon}>
      {projected && engine.note && (
        <div className="border-b border-desk-warn/30 bg-desk-warn/5 px-3 py-1 text-[10px] text-desk-warn">{engine.note}</div>
      )}
      <div className="grid grid-cols-3 gap-1.5 p-2">
        <MetricCard label="Events/sec" value={engine.events_per_sec.toFixed(1)} tone="info" />
        <MetricCard label="Latency" value={`${engine.latency_ms.toFixed(3)}ms`} />
        <MetricCard label="Sim Speed" value={engine.simulation_speed} />
        <MetricCard label="CPU" value={`${engine.cpu_percent.toFixed(0)}%`} />
        <MetricCard label="Memory" value={`${engine.memory_mb.toFixed(0)}MB`} />
        <MetricCard label="Book Upd/s" value={engine.book_updates_per_sec.toFixed(1)} />
        <MetricCard label="Exec/s" value={engine.execution_throughput.toFixed(1)} tone="profit" />
      </div>
    </GlassPanel>
  )
}