import { useEffect, useRef } from 'react'
import type ReactECharts from 'echarts-for-react'

export function useChartResize() {
  const chartRef = useRef<ReactECharts>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return { chartRef, containerRef }
}