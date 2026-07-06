import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useEffect, useMemo } from 'react'
import { useChartResize } from '../hooks/useChartResize'
import { useLiveChartHistory } from '../hooks/useLiveChartHistory'
import { useLiveTrader } from '../hooks/LiveTraderContext'
import { THEME } from '../theme'
import type { ChartDisplayType, ReplayFrame } from '../types'
import {
  appendLiveMid,
  formatChartAxisLabel,
  historyBarsToTrail,
  normalizeTimestampMs,
  type TrailPoint,
} from '../utils/chartTrail'

interface LivePriceChartProps {
  frame: ReplayFrame | null
  chartType: ChartDisplayType
  symbol: string
}

export function LivePriceChart({ frame, chartType, symbol }: LivePriceChartProps) {
  const { chartRef, containerRef } = useChartResize()
  const { assetClass, chartRange } = useLiveTrader()
  const { bars, loading: historyLoading } = useLiveChartHistory(symbol, assetClass, chartRange)

  useEffect(() => {
    const t = setTimeout(() => chartRef.current?.getEchartsInstance()?.resize(), 80)
    const onResize = () => chartRef.current?.getEchartsInstance()?.resize()
    window.addEventListener('panel-resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('panel-resize', onResize)
    }
  }, [chartRef, frame?.frame_index, symbol, chartType, chartRange])

  const trail = useMemo((): TrailPoint[] => {
    let points: TrailPoint[] = []

    if (bars.length > 0) {
      points = historyBarsToTrail(bars)
    }

    if (frame?.mid_price != null && frame.symbol === symbol) {
      points = appendLiveMid(points, frame.mid_price, frame.best_bid ?? undefined, frame.best_ask ?? undefined)
    }

    return points
  }, [bars, frame, symbol])

  const isDemoFeed = frame?.connection_quality === 'demo'
  const isReconnecting = frame?.connection_quality === 'reconnecting'
  const syncing =
    frame?.live_mode &&
    !frame?.live_connected &&
    (frame.quote_trail?.length ?? 0) < 2 &&
    !isDemoFeed &&
    bars.length === 0

  const option = useMemo<EChartsOption>(() => {
    if (!trail.length) return {}
    const times = trail.map((p) => normalizeTimestampMs(p.timestamp))
    const mids = trail.map((p) => p.mid)
    const series: EChartsOption['series'] = []

    if (chartType === 'candlestick') {
      series.push({
        name: symbol,
        type: 'candlestick',
        data: trail.map((p, i) => {
          const t = times[i]
          const open = p.open ?? (i > 0 ? trail[i - 1].mid : p.mid)
          const close = p.close ?? p.mid
          const low = p.low ?? Math.min(p.bid, open, close)
          const high = p.high ?? Math.max(p.ask, open, close)
          return [t, open, close, low, high]
        }),
        itemStyle: {
          color: THEME.profit,
          color0: THEME.loss,
          borderColor: THEME.profit,
          borderColor0: THEME.loss,
        },
      })
    } else {
      const isMountain = chartType === 'mountain'
      const isArea = chartType === 'area' || isMountain
      series.push({
        name: symbol,
        type: 'line',
        data: times.map((t, i) => [t, mids[i]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: THEME.chart.mid, width: 2 },
        areaStyle: isArea
          ? {
              color: isMountain
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
                : 'rgba(68,255,137,0.15)',
            }
          : undefined,
      })
    }

    const min = Math.min(...mids) * 0.998
    const max = Math.max(...mids) * 1.002

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 200,
      grid: { left: 52, right: 16, top: 28, bottom: 48 },
      toolbox: {
        right: 8,
        top: 4,
        itemSize: 12,
        iconStyle: { borderColor: THEME.chart.axis },
        emphasis: { iconStyle: { borderColor: THEME.text } },
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset zoom' } },
          restore: { title: 'Reset' },
        },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 18,
          bottom: 6,
          borderColor: THEME.chart.grid,
          fillerColor: 'rgba(68,255,137,0.12)',
          handleStyle: { color: THEME.chart.mid },
          textStyle: { color: THEME.chart.axis, fontSize: 9 },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: THEME.chart.tooltipBg,
        borderColor: THEME.chart.tooltipBorder,
        textStyle: { color: THEME.text, fontSize: 11 },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params]
          const first = items[0] as { axisValue?: number; value?: number | number[]; data?: number | number[] }
          const axisMs = typeof first?.axisValue === 'number' ? first.axisValue : times[0]
          const raw = first?.data ?? first?.value
          if (Array.isArray(raw) && raw.length >= 5) {
            const [, open, close, low, high] = raw as number[]
            return `${formatChartAxisLabel(chartRange, axisMs)}<br/>O ${open.toFixed(2)} H ${high.toFixed(2)} L ${low.toFixed(2)} C ${close.toFixed(2)}`
          }
          const val = Array.isArray(raw) ? raw[1] : raw
          return `${formatChartAxisLabel(chartRange, axisMs)}<br/>${symbol}: ${typeof val === 'number' ? val.toFixed(2) : '—'}`
        },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: THEME.chart.grid } },
        axisLabel: {
          color: THEME.chart.axis,
          fontSize: 9,
          formatter: (v: number) => formatChartAxisLabel(chartRange, v),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min,
        max,
        scale: true,
        axisLabel: { color: THEME.chart.axis, fontSize: 10 },
        splitLine: { lineStyle: { color: THEME.chart.grid, type: 'dashed' } },
      },
      series,
    }
  }, [trail, chartType, symbol, chartRange, bars.length])

  return (
    <div ref={containerRef} className="flex h-full min-h-[220px] w-full flex-col">
      {frame && (
        <div className="shrink-0 border-b border-desk-border/40 px-2 py-1.5 text-[10px]">
          <span className="text-desk-profit">BB {frame.best_bid?.toFixed(2) ?? '—'}</span>
          <span className="mx-2 text-desk-muted">MID {frame.mid_price?.toFixed(2) ?? '—'}</span>
          <span className="text-desk-loss">BA {frame.best_ask?.toFixed(2) ?? '—'}</span>
          <span className="ml-2 text-desk-muted">{chartRange}</span>
          {isDemoFeed && (
            <span className="ml-2 rounded border border-desk-warn/40 bg-desk-warn/10 px-1.5 py-0.5 text-[9px] text-desk-warn">
              Demo feed
            </span>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%', minHeight: 180 }}
          notMerge={false}
          lazyUpdate={false}
        />
        {historyLoading && (
          <span className="absolute left-2 top-2 rounded-md border border-desk-info/30 bg-desk-bg/90 px-2 py-0.5 text-[9px] text-desk-info">
            Loading {chartRange}…
          </span>
        )}
        {syncing && (
          <span className="absolute left-2 top-2 rounded-md border border-desk-warn/30 bg-desk-bg/90 px-2 py-0.5 text-[9px] text-desk-warn">
            Connecting feed…
          </span>
        )}
        {isReconnecting && (
          <span className="absolute left-2 top-2 rounded-md border border-desk-warn/30 bg-desk-bg/90 px-2 py-0.5 text-[9px] text-desk-warn">
            Reconnecting feed…
          </span>
        )}
      </div>
    </div>
  )
}