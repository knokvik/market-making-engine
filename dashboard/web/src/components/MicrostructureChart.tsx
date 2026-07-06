import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useEffect, useMemo } from 'react'
import { useChartResize } from '../hooks/useChartResize'
import { useLiveChartHistory } from '../hooks/useLiveChartHistory'
import { THEME } from '../theme'
import { DEFAULT_CHART_RANGE, type ChartDisplayType, type OverlayKey, type ReplayFrame } from '../types'
import { resolveChartTrail } from '../utils/chartTrail'

const C = THEME.chart

interface MicrostructureChartProps {
  frame: ReplayFrame | null
  overlays: Record<OverlayKey, boolean>
  chartType?: ChartDisplayType
  priceFocus?: boolean
}

export function MicrostructureChart({
  frame,
  overlays,
  chartType = 'mountain',
  priceFocus = false,
}: MicrostructureChartProps) {
  const { chartRef, containerRef } = useChartResize()

  useEffect(() => {
    const onResize = () => chartRef.current?.getEchartsInstance()?.resize()
    window.addEventListener('panel-resize', onResize)
    return () => window.removeEventListener('panel-resize', onResize)
  }, [chartRef])

  const isLive = frame?.live_mode || frame?.feed_type === 'paper_trading'
  const isPlayingReplay = Boolean(frame?.playing && !isLive)
  const symbol = frame?.symbol ?? ''
  const assetClass = frame?.asset_class === 'crypto' ? 'crypto' : 'stock'
  const { bars, loading: historyLoading } = useLiveChartHistory(
    isLive ? symbol : '',
    assetClass,
    DEFAULT_CHART_RANGE,
  )

  const trail = useMemo(
    () =>
      resolveChartTrail(frame, {
        priceFocus,
        symbol,
        historyBars: isLive ? bars : undefined,
      }),
    [frame, priceFocus, symbol, isLive, bars],
  )

  const option = useMemo<EChartsOption>(() => {
    if (!trail.length) return {}

    const times = trail.map((p) => p.timestamp)
    const mids = overlays.midPrice ? trail.map((p) => p.mid) : []
    const reservations = overlays.reservationPrice ? trail.map((p) => p.reservation) : []
    const bids = trail.map((p) => p.bid)
    const asks = trail.map((p) => p.ask)

    const depthPrices = frame
      ? [...frame.bid_depth.map((l) => l.price), ...frame.ask_depth.map((l) => l.price)]
      : []
    const refMid = frame?.mid_price ?? trail[trail.length - 1]?.mid ?? 100
    const minPrice = depthPrices.length ? Math.min(...depthPrices) * 0.999 : refMid * 0.995
    const maxPrice = depthPrices.length ? Math.max(...depthPrices) * 1.001 : refMid * 1.005

    const heatmapData: [number, number, number][] = []
    if (frame && (overlays.bidAskHeatmap || overlays.orderBookDepth)) {
      frame.bid_depth.forEach((level, idx) => {
        heatmapData.push([idx, 0, level.quantity])
      })
      frame.ask_depth.forEach((level, idx) => {
        heatmapData.push([idx, 1, level.quantity])
      })
    }

    const fillPoints =
      frame && overlays.tradePrints
        ? frame.recent_fills.map((f) => [f.timestamp, f.price, f.quantity])
        : []

    const volBand =
      frame && overlays.volatilityBands && frame.mid_price
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
          borderColor: C.tooltipBorder,
          borderWidth: 1,
        },
      })
    }

    if (overlays.midPrice) {
      if (chartType === 'candlestick') {
        const candles = trail.map((p, i) => {
          const prev = i > 0 ? trail[i - 1].mid : p.mid
          const open = prev
          const close = p.mid
          const low = Math.min(p.bid, open, close)
          const high = Math.max(p.ask, open, close)
          return [open, close, low, high]
        })
        series.push({
          name: 'OHLC',
          type: 'candlestick',
          data: candles,
          itemStyle: {
            color: THEME.profit,
            color0: THEME.loss,
            borderColor: THEME.profit,
            borderColor0: THEME.loss,
          },
        })
      } else {
        const isArea = chartType === 'area' || chartType === 'mountain'
        series.push({
          name: 'Mid',
          type: 'line',
          data: times.map((t, i) => [t, mids[i]]),
          smooth: chartType === 'line',
          showSymbol: false,
          lineStyle: { color: C.mid, width: chartType === 'line' ? 2 : 1.5 },
          areaStyle: isArea
            ? {
                color: chartType === 'mountain'
                  ? {
                      type: 'linear',
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: 'rgba(68,255,137,0.35)' },
                        { offset: 1, color: 'rgba(68,255,137,0.02)' },
                      ],
                    }
                  : 'rgba(68,255,137,0.12)',
              }
            : undefined,
        })
      }
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

    if (frame && overlays.fairValue && frame.fair_value) {
      series.push({
        name: 'Fair Value',
        type: 'line',
        data: times.map((t) => [t, frame.fair_value]),
        showSymbol: false,
        lineStyle: { color: '#9CA3AF', width: 1, type: 'dotted' },
      })
    }

    if (!priceFocus) {
      series.push({
        name: 'Our Bid',
        type: 'line',
        data: times.map((t, i) => [t, bids[i]]),
        showSymbol: false,
        lineStyle: { color: THEME.profit, width: 1.5 },
        areaStyle: overlays.spread ? { color: 'rgba(68,255,137,0.05)' } : undefined,
      })

      series.push({
        name: 'Our Ask',
        type: 'line',
        data: times.map((t, i) => [t, asks[i]]),
        showSymbol: false,
        lineStyle: { color: THEME.ask, width: 1.5 },
        areaStyle: overlays.spread ? { color: 'rgba(255,77,106,0.05)' } : undefined,
      })
    }

    if (overlays.tradePrints && fillPoints.length) {
      series.push({
        name: 'Fills',
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(6, Math.min(20, val[2])),
        data: fillPoints,
        itemStyle: { color: '#FFFFFF' },
      })
    }

    if (frame && overlays.volatilityBands && frame.mid_price && volBand) {
      series.push({
        name: 'Vol Upper',
        type: 'line',
        data: times.map((t) => [t, frame.mid_price! + volBand]),
        showSymbol: false,
        lineStyle: { opacity: 0.3, color: C.secondary },
      })
      series.push({
        name: 'Vol Lower',
        type: 'line',
        data: times.map((t) => [t, frame.mid_price! - volBand]),
        showSymbol: false,
        lineStyle: { opacity: 0.3, color: C.secondary },
      })
    }

    if (frame && overlays.vwap && frame.mid_price) {
      const vwap = frame.recent_fills.length
        ? frame.recent_fills.reduce((s, f) => s + f.price * f.quantity, 0) /
          Math.max(frame.recent_fills.reduce((s, f) => s + f.quantity, 0), 1)
        : frame.mid_price
      series.push({
        name: 'VWAP',
        type: 'line',
        data: times.map((t) => [t, vwap]),
        showSymbol: false,
        lineStyle: { color: '#A78BFA', width: 1.5, type: 'dotted' },
      })
    }

    if (frame && overlays.liquidityWalls) {
      const allDepth = [...frame.bid_depth, ...frame.ask_depth]
      const maxQty = Math.max(...allDepth.map((l) => l.quantity), 1)
      const walls = allDepth.filter((l) => l.quantity > maxQty * 0.6)
      for (const wall of walls.slice(0, 3)) {
        series.push({
          name: `Wall ${wall.price.toFixed(2)}`,
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#FFB020', type: 'solid', width: 1, opacity: 0.5 },
            data: [{ yAxis: wall.price, label: { formatter: `${wall.quantity.toFixed(0)}`, fontSize: 8 } }],
          },
          data: [],
        })
      }
    }

    if (frame && overlays.orderFlowImbalance && !priceFocus) {
      series.push({
        name: 'OFI',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: [frame.order_flow_imbalance, -frame.order_flow_imbalance * 0.5],
        itemStyle: { color: (p: { dataIndex: number }) => (p.dataIndex === 0 ? THEME.profit : THEME.loss) },
      })
    }

    if (frame && overlays.spread && frame.spread) {
      series.push({
        name: 'Spread Width',
        type: 'line',
        data: times.map((t) => [t, frame.spread]),
        showSymbol: false,
        lineStyle: { color: '#6B7280', width: 1, opacity: 0.5 },
      })
    }

    return {
      backgroundColor: 'transparent',
      animation: isLive || isPlayingReplay,
      animationDuration: 0,
      animationDurationUpdate: isLive ? 120 : isPlayingReplay ? 100 : 0,
      animationEasingUpdate: 'linear',
      grid: priceFocus
        ? [{ left: 48, right: 16, top: 8, bottom: 28 }]
        : [
            { left: 48, right: 16, top: 8, height: '58%' },
            { left: 48, right: 16, top: '70%', height: '24%' },
          ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: C.tooltipBg,
        borderColor: C.tooltipBorder,
        textStyle: { color: THEME.text, fontSize: 11 },
      },
      legend: {
        bottom: 2,
        type: 'scroll',
        textStyle: { color: C.axis, fontSize: 9 },
        itemWidth: 10,
        itemHeight: 7,
        pageIconSize: 8,
      },
      xAxis: [
        {
          type: 'time',
          gridIndex: 0,
          axisLine: { lineStyle: { color: C.grid } },
          axisLabel: { color: C.axis, fontSize: 10 },
          splitLine: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: frame?.bid_depth.map((_, i) => `L${i + 1}`) ?? ['L1', 'L2', 'L3'],
          axisLine: { lineStyle: { color: C.grid } },
          axisLabel: { color: C.axis, fontSize: 10 },
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
          axisLabel: { color: C.axis, fontSize: 10 },
          splitLine: { lineStyle: { color: C.grid, type: 'dashed' } },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: ['Bid', 'Ask'],
          axisLine: { show: false },
          axisLabel: { color: C.axis },
          splitLine: { show: false },
        },
      ],
      visualMap: overlays.bidAskHeatmap
        ? {
            show: false,
            min: 0,
            max: Math.max(...heatmapData.map((d) => d[2]), 1),
            inRange: {
              color: [...C.heatmap],
            },
          }
        : undefined,
      series,
    }
  }, [frame, overlays, isLive, isPlayingReplay, chartType, priceFocus, trail])

  return (
    <div ref={containerRef} className="chart-container flex min-h-0 flex-col">
      {frame && (
        <div className="shrink-0 border-b border-desk-border/40 bg-desk-bg/90 px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <QuoteChip label="BB" value={frame.best_bid?.toFixed(4) ?? '—'} tone="profit" />
            <QuoteChip label="MID" value={frame.mid_price?.toFixed(4) ?? '—'} tone="info" />
            <QuoteChip label="BA" value={frame.best_ask?.toFixed(4) ?? '—'} tone="loss" />
            <QuoteChip label="SPR" value={frame.spread?.toFixed(4) ?? '—'} tone="warn" />
            {overlays.adverseSelection && (
              <QuoteChip label="TOX" value={`${(frame.toxicity * 100).toFixed(0)}%`} tone="loss" />
            )}
            {overlays.regimeDetection && (
              <QuoteChip label="Regime" value={frame.regime.replace('_', ' ')} tone="info" />
            )}
            {overlays.orderFlowImbalance && (
              <QuoteChip
                label="OFI"
                value={`${(frame.order_flow_imbalance * 100).toFixed(1)}%`}
                tone={frame.order_flow_imbalance >= 0 ? 'profit' : 'loss'}
              />
            )}
          </div>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%', minHeight: 120 }}
          notMerge={isLive ? false : !isPlayingReplay}
          lazyUpdate={!isPlayingReplay}
        />
        {!trail.length && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-desk-muted">
            {historyLoading && isLive
              ? `Loading ${DEFAULT_CHART_RANGE} chart…`
              : isLive
                ? 'Waiting for market data…'
                : frame && frame.frame_index < 0
                  ? 'Press Play to start replay'
                  : frame
                    ? 'Press Play to resume replay'
                    : 'Select a data source to begin'}
          </span>
        )}
      </div>
    </div>
  )
}

function QuoteChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'profit' | 'loss' | 'info' | 'warn'
}) {
  const toneClass = {
    profit: 'text-desk-profit border-desk-profit/20',
    loss: 'text-desk-loss border-desk-loss/20',
    info: 'text-desk-info border-desk-info/20',
    warn: 'text-desk-warn border-desk-warn/20',
  }[tone]

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded border bg-desk-panel/80 px-1.5 py-0.5 font-mono text-[9px] ${toneClass}`}>
      <span className="text-desk-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}