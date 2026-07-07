import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout } from 'react-grid-layout/legacy'
import { RotateCcw } from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGrid = WidthProvider(Responsive)

const STORAGE_KEY = 'mm-engine-dashboard-layout-v1'

export type PanelId =
  | 'leftSidebar'
  | 'centerChart'
  | 'rightSidebar'
  | 'replayToolbar'
  | 'eventFeed'
  | 'performance'
  | 'execution'

const DEFAULT_LAYOUT: Layout = [
  { i: 'leftSidebar', x: 0, y: 0, w: 2, h: 14, minW: 2, minH: 6 },
  { i: 'centerChart', x: 2, y: 0, w: 8, h: 10, minW: 4, minH: 5 },
  { i: 'rightSidebar', x: 10, y: 0, w: 2, h: 14, minW: 2, minH: 6 },
  { i: 'replayToolbar', x: 2, y: 10, w: 8, h: 2, minW: 4, minH: 2, static: true },
  { i: 'eventFeed', x: 0, y: 14, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'performance', x: 4, y: 14, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'execution', x: 8, y: 14, w: 4, h: 6, minW: 3, minH: 4 },
]

interface DashboardLayoutProps {
  panels: Record<PanelId, ReactNode>
}

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Layout
  } catch {
    /* use defaults */
  }
  return DEFAULT_LAYOUT
}

export function DashboardLayout({ panels }: DashboardLayoutProps) {
  const [layout, setLayout] = useState<Layout>(loadLayout)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  const onLayoutChange = useCallback((next: Layout) => {
    setLayout(next)
  }, [])

  const resetLayout = useCallback(() => {
    setLayout([...DEFAULT_LAYOUT])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const panelOrder: PanelId[] = [
    'leftSidebar',
    'centerChart',
    'rightSidebar',
    'replayToolbar',
    'eventFeed',
    'performance',
    'execution',
  ]

  return (
    <div className="relative min-h-0 flex-1">
      <button
        onClick={resetLayout}
        className="absolute right-3 top-1 z-20 flex items-center gap-1 rounded-lg border border-desk-border/60 bg-desk-panel/90 px-2 py-1 text-[10px] text-desk-muted backdrop-blur-sm transition hover:border-desk-info/40 hover:text-white"
        title="Reset panel layout"
      >
        <RotateCcw size={10} />
        Reset Layout
      </button>

      <ResponsiveGrid
        className="layout h-full"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
        rowHeight={28}
        margin={[8, 8]}
        containerPadding={[8, 8]}
        onLayoutChange={onLayoutChange}
        draggableHandle=".panel-drag-handle"
        compactType="vertical"
        resizeHandles={['se', 'e', 's']}
      >
        {panelOrder.map((id) => (
          <div key={id} className="overflow-hidden rounded-xl">
            {panels[id]}
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  )
}