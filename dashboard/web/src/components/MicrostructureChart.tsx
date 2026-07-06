import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useMemo } from 'react'
import type { OverlayKey, ReplayFrame } from '../types'

interface MicrostructureChartProps {
  frame: ReplayFrame | null
  overlays: Record<OverlayKey, boolean>
}

export function MicrostructureChart({ frame, overlays }: MicrostructureChartProps) {
  const option = useMemo<EChartsOption>(() => {
    if (!frame) return {}

    const trail = frame.quote_trail
    const times = trail.map((p) => p.timestamp)
    const mids = overlays.midPrice ? trail.map((p) => p.mid) : []
    const reservations = overlays.reservationPrice ? trail.map((p) => p.reservation) : []
    const bids = trail.map((p) => p.bid)
    const asks = trail.map((p) => p.ask)

    const depthPrices = [
      ...frame.bid_depth.map((l) => l.price),
      ...frame.ask_depth.map((l) => l.price),
    ]
    const minPrice = depthPrices.length ? Math.min(...depthPrices) * 0.999 : (frame.mid_price ?? 100) - 1
    const maxPrice = depthPrices.length ? Math.max(...depthPrices) * 1.001 : (frame.mid_price ?? 100) + 1

    const heatmapData: [number, number, number][] = []
    if (overlays.bidAskHeatmap || overlays.orderBookDepth) {
      frame.bid_depth.forEach((level, idx) => {
        heatmapData.push([idx, 0, level.quantity])
      })
      frame.ask_depth.forEach((level, idx) => {
        heatmapData.push([idx, 1, level.quantity])
      })
    }

    const fillPoints = overlays.tradePrints
      ? frame.recent_fills.map((f) => [f.timestamp, f.price, f.quantity])
      : []

    const volBand = overlays.volatilityBands && frame.mid_price
      ? frame.mid_price * frame.sigma * 2
      : 0

    const series: EChartsOption['series'] = []

    if (overlays.bidAskHeatmap && heatmapData.length) {
      series.push({
        name: 'Depth Heatmap',
        type: 'heatmap',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: heatmapData,
        itemStyle: {
          borderColor: '#1E2430',
          borderWidth: 1,
        },
      })
    }

    if (overlays.midPrice) {
      series.push({
        name: 'Mid',
        type: 'line',
        data: times.map((t, i) => [t, mids[i]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#3B9EFF', width: 2 },
      })
    }

    if (overlays.reservationPrice) {
      series.push({
        name: 'Reservation',
        type: 'line',
        data: times.map((t, i) => [t, reservations[i]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#FFB020', width: 1.5, type: 'dashed' },
      })
    }

    if (overlays.fairValue && frame.fair_value) {
      series.push({
        name: 'Fair Value',
        type: 'line',
        data: times.map((t) => [t, frame.fair_value]),
        showSymbol: false,
        lineStyle: { color: '#9CA3AF', width: 1, type: 'dotted' },
      })
    }

    series.push({
      name: 'Our Bid',
      type: 'line',
      data: times.map((t, i) => [t, bids[i]]),
      showSymbol: false,
      lineStyle: { color: '#00E676', width: 1.5 },
      areaStyle: overlays.spread ? { color: 'rgba(0,230,118,0.05)' } : undefined,
    })

    series.push({
      name: 'Our Ask',
      type: 'line',
      data: times.map((t, i) => [t, asks[i]]),
      showSymbol: false,
      lineStyle: { color: '#FF3B5C', width: 1.5 },
      areaStyle: overlays.spread ? { color: 'rgba(255,59,92,0.05)' } : undefined,
    })

    if (overlays.tradePrints && fillPoints.length) {
      series.push({
        name: 'Fills',
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(6, Math.min(20, val[2])),
        data: fillPoints,
        itemStyle: { color: '#FFFFFF' },
      })
    }

    if (overlays.volatilityBands && frame.mid_price && volBand) {
      series.push({
        name: 'Vol Upper',
        type: 'line',
        data: times.map((t) => [t, frame.mid_price! + volBand]),
        showSymbol: false,
        lineStyle: { opacity: 0.3, color: '#3B9EFF' },
      })
      series.push({
        name: 'Vol Lower',
        type: 'line',
        data: times.map((t) => [t, frame.mid_price! - volBand]),
        showSymbol: false,
        lineStyle: { opacity: 0.3, color: '#3B9EFF' },
      })
    }

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 200,
      grid: [
        { left: 48, right: 16, top: 24, height: '62%' },
        { left: 48, right: 16, top: '72%', height: '22%' },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#11141A',
        borderColor: '#1E2430',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      legend: {
        top: 0,
        textStyle: { color: '#6B7280', fontSize: 10 },
        itemWidth: 12,
        itemHeight: 8,
      },
      xAxis: [
        {
          type: 'time',
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#1E2430' } },
          axisLabel: { color: '#6B7280', fontSize: 10 },
          splitLine: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: frame.bid_depth.map((_, i) => `L${i + 1}`),
          axisLine: { lineStyle: { color: '#1E2430' } },
          axisLabel: { color: '#6B7280', fontSize: 10 },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          min: minPrice,
          max: maxPrice,
          scale: true,
          axisLine: { show: false },
          axisLabel: { color: '#6B7280', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1E2430', type: 'dashed' } },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: ['Bid', 'Ask'],
          axisLine: { show: false },
          axisLabel: { color: '#6B7280' },
          splitLine: { show: false },
        },
      ],
      visualMap: overlays.bidAskHeatmap
        ? {
            show: false,
            min: 0,
            max: Math.max(...heatmapData.map((d) => d[2]), 1),
            inRange: {
              color: ['#0B1A2E', '#1B4D7A', '#3B9EFF', '#00E676'],
            },
          }
        : undefined,
      series,
    }
  }, [frame, overlays])

  return (
    <div className="relative h-full w-full">
      {frame && (
        <div className="absolute left-3 top-2 z-10 flex gap-3 font-mono text-[10px]">
          <span className="text-desk-profit">BB {frame.best_bid?.toFixed(4) ?? '—'}</span>
          <span className="text-desk-info">MID {frame.mid_price?.toFixed(4) ?? '—'}</span>
          <span className="text-desk-loss">BA {frame.best_ask?.toFixed(4) ?? '—'}</span>
          <span className="text-desk-warn">SPR {frame.spread?.toFixed(4) ?? '—'}</span>
          {overlays.adverseSelection && (
            <span className="text-desk-loss">TOX {(frame.toxicity * 100).toFixed(0)}%</span>
          )}
          {overlays.regimeDetection && (
            <span className="rounded border border-desk-border px-1.5 uppercase text-desk-info">{frame.regime}</span>
          )}
          <span>OFI {(frame.order_flow_imbalance * 100).toFixed(1)}%</span>
        </div>
      )}
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
    </div>
  )
}