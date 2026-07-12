import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import ReactGridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, LayoutItem } from 'react-grid-layout/legacy'
import { ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import type { PanelId } from '../types'
import { compactLayoutVertical, computeAdaptiveRowHeight, layoutExtent } from '../utils/gridLayout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const GridLayout = WidthProvider(ReactGridLayout)
const STORAGE_KEY_REPLAY = 'mm-engine-dashboard-layout-v21-replay'
const STORAGE_KEY_PAPER = 'mm-engine-dashboard-layout-v20-paper'
const STORAGE_KEY_LIVE = 'mm-engine-dashboard-layout-v20-live'
const COLLAPSED_KEY_REPLAY = 'mm-engine-dashboard-collapsed-v21-replay'
const COLLAPSED_KEY_PAPER = 'mm-engine-dashboard-collapsed-v20-paper'
const COLLAPSED_KEY_LIVE = 'mm-engine-dashboard-collapsed-v20-live'

export type LayoutMode = 'replay' | 'paper' | 'live'
const ROW_HEIGHT_BASE = 32
const GRID_COLS = 12
const MARGIN = 8
const CONTAINER_PADDING = 8

const RESIZE_HANDLES: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'> = [
  'nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se',
]

const DEBUG_GRID = import.meta.env.DEV

const DRAG_CANCEL = '.panel-no-drag, button, input, select, textarea, a, canvas, .echarts-for-react'

/** v20 — dense workstation: center chart fills middle column, no dead zones */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'leftSidebar', x: 0, y: 0, w: 2, h: 12, minW: 2, minH: 4, maxH: 24 },
  { i: 'orderBook', x: 2, y: 0, w: 2, h: 12, minW: 2, minH: 4, maxH: 24 },
  { i: 'centerChart', x: 4, y: 0, w: 6, h: 12, minW: 4, minH: 6, maxH: 28 },
  { i: 'eventInspector', x: 10, y: 0, w: 2, h: 12, minW: 2, minH: 4, maxH: 24 },
  { i: 'replayToolbar', x: 0, y: 12, w: 8, h: 2, minW: 4, minH: 2, maxH: 3 },
  { i: 'quoteDecision', x: 8, y: 12, w: 2, h: 2, minW: 2, minH: 2, maxH: 8 },
  { i: 'rightSidebar', x: 10, y: 12, w: 2, h: 2, minW: 2, minH: 2, maxH: 8 },
  { i: 'strategyCompare', x: 0, y: 14, w: 3, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'pnlDecomposition', x: 3, y: 14, w: 3, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'performance', x: 6, y: 14, w: 3, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'latencyAnalytics', x: 9, y: 14, w: 3, h: 5, minW: 3, minH: 4, maxH: 16 },
  { i: 'dataSource', x: 0, y: 19, w: 6, h: 5, minW: 4, minH: 3, maxH: 14 },
  { i: 'inventoryAnalytics', x: 6, y: 19, w: 3, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'queuePosition', x: 9, y: 19, w: 3, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'eventFeed', x: 0, y: 24, w: 4, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'execution', x: 4, y: 24, w: 4, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'aiAnalysis', x: 8, y: 24, w: 4, h: 5, minW: 2, minH: 3, maxH: 14 },
]

/** v20 — paper desk: chart dominates center, analytics band below */
export const DEFAULT_PAPER_LAYOUT: LayoutItem[] = [
  { i: 'paperStockLock', x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 4, maxH: 12 },
  { i: 'automationPanel', x: 0, y: 6, w: 3, h: 6, minW: 2, minH: 4, maxH: 12 },
  { i: 'algoOrderBook', x: 3, y: 0, w: 3, h: 12, minW: 2, minH: 6, maxH: 20 },
  { i: 'centerChart', x: 6, y: 0, w: 6, h: 9, minW: 4, minH: 6, maxH: 24 },
  { i: 'quoteDecision', x: 6, y: 9, w: 3, h: 3, minW: 2, minH: 2, maxH: 10 },
  { i: 'rightSidebar', x: 9, y: 9, w: 3, h: 3, minW: 2, minH: 2, maxH: 10 },
  { i: 'paperPnlSummary', x: 0, y: 12, w: 4, h: 4, minW: 2, minH: 3, maxH: 10 },
  { i: 'performance', x: 4, y: 12, w: 4, h: 4, minW: 2, minH: 3, maxH: 12 },
  { i: 'execution', x: 8, y: 12, w: 2, h: 4, minW: 2, minH: 3, maxH: 12 },
  { i: 'eventFeed', x: 10, y: 12, w: 2, h: 4, minW: 2, minH: 3, maxH: 12 },
  { i: 'pnlDecomposition', x: 0, y: 16, w: 6, h: 5, minW: 2, minH: 3, maxH: 14 },
  { i: 'latencyAnalytics', x: 6, y: 16, w: 6, h: 5, minW: 3, minH: 4, maxH: 16 },
]

/** v20 — live desk: chart + news fill viewport center */
export const DEFAULT_LIVE_TRADER_LAYOUT: LayoutItem[] = [
  { i: 'trendingMarquee', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2, maxH: 3 },
  { i: 'stockDetail', x: 0, y: 2, w: 8, h: 9, minW: 5, minH: 6, maxH: 20 },
  { i: 'liveNewsFeed', x: 8, y: 2, w: 4, h: 9, minW: 3, minH: 6, maxH: 20 },
  { i: 'liveSymbolBar', x: 0, y: 11, w: 12, h: 2, minW: 6, minH: 2, maxH: 3 },
  { i: 'trendingStocks', x: 0, y: 13, w: 8, h: 6, minW: 4, minH: 4, maxH: 14 },
  { i: 'liveMarketStats', x: 8, y: 13, w: 4, h: 6, minW: 3, minH: 4, maxH: 14 },
  { i: 'liveEventFeed', x: 0, y: 19, w: 12, h: 4, minW: 6, minH: 3, maxH: 10 },
]

const REPLAY_PANEL_ORDER: PanelId[] = [
  'leftSidebar', 'orderBook', 'centerChart', 'quoteDecision',
  'rightSidebar', 'replayToolbar', 'eventInspector', 'strategyCompare',
  'pnlDecomposition', 'performance', 'dataSource', 'latencyAnalytics', 'inventoryAnalytics',
  'queuePosition', 'eventFeed', 'execution', 'aiAnalysis',
]

const PAPER_PANEL_ORDER: PanelId[] = [
  'paperStockLock', 'automationPanel', 'algoOrderBook', 'centerChart',
  'quoteDecision', 'rightSidebar', 'paperPnlSummary', 'performance', 'execution', 'eventFeed',
  'pnlDecomposition', 'latencyAnalytics',
]

const LIVE_PANEL_ORDER: PanelId[] = [
  'trendingMarquee', 'stockDetail', 'liveNewsFeed', 'liveSymbolBar',
  'trendingStocks', 'liveMarketStats', 'liveEventFeed',
]

function layoutConfig(mode: LayoutMode) {
  if (mode === 'paper') {
    return {
      defaultLayout: DEFAULT_PAPER_LAYOUT,
      panelOrder: PAPER_PANEL_ORDER,
      storageKey: STORAGE_KEY_PAPER,
      collapsedKey: COLLAPSED_KEY_PAPER,
    }
  }
  if (mode === 'live') {
    return {
      defaultLayout: DEFAULT_LIVE_TRADER_LAYOUT,
      panelOrder: LIVE_PANEL_ORDER,
      storageKey: STORAGE_KEY_LIVE,
      collapsedKey: COLLAPSED_KEY_LIVE,
    }
  }
  return {
    defaultLayout: DEFAULT_LAYOUT,
    panelOrder: REPLAY_PANEL_ORDER,
    storageKey: STORAGE_KEY_REPLAY,
    collapsedKey: COLLAPSED_KEY_REPLAY,
  }
}

function cloneLayout(items: LayoutItem[]): LayoutItem[] {
  return items.map((item) => ({ ...item }))
}



function clampItem(item: LayoutItem, defaults: Map<string, LayoutItem>): LayoutItem {
  const def = defaults.get(item.i)
  if (!def) return item
  const w = Math.max(def.minW ?? 2, Math.min(item.w ?? def.w, GRID_COLS))
  return {
    ...def,
    ...item,
    x: Math.max(0, Math.min(item.x ?? def.x, GRID_COLS - w)),
    y: Math.max(0, item.y ?? def.y),
    w,
    h: Math.max(def.minH ?? 2, Math.min(item.h ?? def.h, def.maxH ?? 14)),
    static: item.static ?? false,
  }
}

function clampLayout(raw: LayoutItem[], mode: LayoutMode): LayoutItem[] {
  const defaults = new Map(layoutConfig(mode).defaultLayout.map((d) => [d.i, d]))
  return raw.map((item) => clampItem(item, defaults))
}

/** Compute overlap area (in grid cells²) between two layout items. */
function rectOverlapArea(a: LayoutItem, b: LayoutItem): number {
  const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return overlapX * overlapY
}

let clearedLegacyLayoutKeys = false

function clearOldLayoutKeys() {
  if (clearedLegacyLayoutKeys) return
  clearedLegacyLayoutKeys = true
  for (const key of ['v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15', 'v16']) {
    localStorage.removeItem(`mm-engine-dashboard-layout-${key}`)
    localStorage.removeItem(`mm-engine-dashboard-collapsed-${key}`)
  }
  for (const key of ['v14-live', 'v16-replay', 'v17-paper', 'v17-live', 'v18-live', 'v19-live']) {
    localStorage.removeItem(`mm-engine-dashboard-layout-${key}`)
    localStorage.removeItem(`mm-engine-dashboard-collapsed-${key}`)
  }
}

function loadLayout(mode: LayoutMode): LayoutItem[] {
  clearOldLayoutKeys()
  const { defaultLayout } = layoutConfig(mode)
  return compactLayoutVertical(cloneLayout(defaultLayout))
}

function loadCollapsed(mode: LayoutMode): Set<PanelId> {
  const { collapsedKey } = layoutConfig(mode)
  try {
    const raw = localStorage.getItem(collapsedKey)
    if (raw) return new Set(JSON.parse(raw) as PanelId[])
  } catch { /* empty */ }
  return new Set()
}

interface DashboardLayoutProps {
  panels: Partial<Record<PanelId, ReactNode>>
  layoutMode?: LayoutMode
  onRegisterReset?: (fn: (() => void) | null) => void
}

export function DashboardLayout({ panels, layoutMode = 'replay', onRegisterReset }: DashboardLayoutProps) {
  const { panelOrder, storageKey, collapsedKey } = layoutConfig(layoutMode)
  const [layout, setLayout] = useState<LayoutItem[]>(() => loadLayout(layoutMode))
  const [collapsed, setCollapsed] = useState<Set<PanelId>>(() => loadCollapsed(layoutMode))
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    setLayout(loadLayout(layoutMode))
    setCollapsed(loadCollapsed(layoutMode))
    setFullscreen(null)
  }, [layoutMode])
  const [fullscreen, setFullscreen] = useState<PanelId | null>(null)
  const savedHeights = useRef<Partial<Record<PanelId, number>>>({})
  const preDragLayout = useRef<LayoutItem[] | null>(null)
  const draggedItemId = useRef<string | null>(null)
  const currentSwapTarget = useRef<string | null>(null)

  const contentRows = useMemo(() => layoutExtent(layout), [layout])

  const { rowHeight, fillsViewport } = useMemo(
    () =>
      computeAdaptiveRowHeight(
        containerHeight,
        contentRows,
        ROW_HEIGHT_BASE,
        MARGIN,
        CONTAINER_PADDING * 2,
      ),
    [containerHeight, contentRows],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerHeight(el.clientHeight)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [layoutMode, fullscreen])

  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('panel-resize')), 60)
    return () => clearTimeout(t)
  }, [rowHeight, layoutMode, contentRows])

  const gridHeight = useMemo(
    () => contentRows * (rowHeight + MARGIN) + CONTAINER_PADDING * 2,
    [contentRows, rowHeight],
  )

  const applyLayout = useCallback((next: Layout) => {
    setLayout(cloneLayout([...next]))
  }, [])

  const persistLayout = useCallback((next: Layout) => {
    const packed = compactLayoutVertical(cloneLayout([...next]))
    const copy = clampLayout(packed, layoutMode)
    setLayout(copy)
    window.dispatchEvent(new Event('panel-resize'))
  }, [layoutMode])

  const handleDragStart = useCallback(
    (_next: Layout, oldItem: LayoutItem | null) => {
      preDragLayout.current = cloneLayout(layout)
      draggedItemId.current = oldItem?.i ?? null
      currentSwapTarget.current = null
      if (DEBUG_GRID && oldItem) console.log('[grid-drag] start', oldItem.i)
    },
    [layout],
  )

  const handleDrag = useCallback(
    (_next: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      const original = preDragLayout.current
      const draggedId = draggedItemId.current
      if (!original || !draggedId || !newItem) return

      const draggedOriginal = original.find((it) => it.i === draggedId)
      if (!draggedOriginal) return

      // Find which original panel the dragged item currently overlaps with most
      let bestOverlap = 0
      let swapTargetId: string | null = null

      for (const item of original) {
        if (item.i === draggedId) continue
        const overlap = rectOverlapArea(newItem, item)
        if (overlap > bestOverlap) {
          bestOverlap = overlap
          swapTargetId = item.i
        }
      }

      // Skip re-render if the swap target hasn't changed
      if (swapTargetId === currentSwapTarget.current) return
      currentSwapTarget.current = swapTargetId

      // Build live preview layout from the original snapshot:
      // – swap target moves to the dragged item's original slot
      // – everything else stays at its original position
      // – react-draggable handles the dragged item's visual position independently
      const preview = original.map((item) => {
        if (item.i === draggedId) {
          return { ...item, x: newItem.x, y: newItem.y }
        }
        if (swapTargetId && item.i === swapTargetId) {
          return { ...item, x: draggedOriginal.x, y: draggedOriginal.y, w: draggedOriginal.w, h: draggedOriginal.h }
        }
        return { ...item }
      })

      setLayout(preview)
    },
    [],
  )

  const handleDragStop = useCallback(
    (next: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      const original = preDragLayout.current
      const draggedId = draggedItemId.current
      preDragLayout.current = null
      draggedItemId.current = null
      currentSwapTarget.current = null

      if (!original || !draggedId || !newItem) {
        persistLayout(next)
        return
      }

      const draggedOriginal = original.find((it) => it.i === draggedId)
      if (!draggedOriginal) {
        persistLayout(next)
        return
      }

      // Dropped back on its own slot — restore original
      if (newItem.x === draggedOriginal.x && newItem.y === draggedOriginal.y) {
        setLayout(cloneLayout(original))
        return
      }

      // Find which original panel the dragged item overlaps with most
      let bestOverlap = 0
      let swapTargetId: string | null = null

      for (const item of original) {
        if (item.i === draggedId) continue
        const overlap = rectOverlapArea(newItem, item)
        if (overlap > bestOverlap) {
          bestOverlap = overlap
          swapTargetId = item.i
        }
      }

      if (swapTargetId) {
        const target = original.find((it) => it.i === swapTargetId)!
        if (DEBUG_GRID) console.log('[grid-drag] swap', draggedId, '↔', swapTargetId)
        // Swap full slot (x, y, w, h) between the two panels — everything else stays put
        const swapped = original.map((item) => {
          if (item.i === draggedId) {
            return { ...item, x: target.x, y: target.y, w: target.w, h: target.h }
          }
          if (item.i === swapTargetId) {
            return { ...item, x: draggedOriginal.x, y: draggedOriginal.y, w: draggedOriginal.w, h: draggedOriginal.h }
          }
          return { ...item }
        })
        persistLayout(swapped)
      } else {
        // No overlap target — move dragged item to the empty drop position
        if (DEBUG_GRID) console.log('[grid-drag] move to empty space', draggedId)
        const moved = original.map((item) => {
          if (item.i === draggedId) {
            return { ...item, x: newItem.x, y: newItem.y }
          }
          return { ...item }
        })
        persistLayout(moved)
      }
    },
    [persistLayout],
  )

  const handleResize = useCallback(
    (next: Layout, _old: LayoutItem | null, item: LayoutItem | null, _placeholder: LayoutItem | null, event: Event) => {
      applyLayout(next)
      if (DEBUG_GRID && item) {
        const e = event as MouseEvent
        console.log('[grid-resize] move', {
          panelId: item.i,
          w: item.w,
          h: item.h,
          x: item.x,
          y: item.y,
          clientX: e.clientX,
          clientY: e.clientY,
        })
      }
    },
    [applyLayout],
  )

  const handleResizeStart = useCallback(
    (next: Layout, _old: LayoutItem | null, item: LayoutItem | null, _placeholder: LayoutItem | null, event: Event) => {
      applyLayout(next)
      if (DEBUG_GRID && item) {
        const e = event as MouseEvent
        console.log('[grid-resize] pointerDown', {
          panelId: item.i,
          w: item.w,
          h: item.h,
          clientX: e.clientX,
          clientY: e.clientY,
        })
      }
    },
    [applyLayout],
  )

  const handleResizeStop = useCallback(
    (next: Layout, _old: LayoutItem | null, item: LayoutItem | null, _placeholder: LayoutItem | null, event: Event) => {
      if (DEBUG_GRID && item) {
        const e = event as MouseEvent
        console.log('[grid-resize] pointerUp', {
          panelId: item.i,
          newWidth: item.w,
          newHeight: item.h,
          clientX: e.clientX,
          clientY: e.clientY,
        })
      }
      persistLayout(next)
    },
    [persistLayout],
  )

  const toggleCollapse = useCallback((id: PanelId) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        const h = savedHeights.current[id]
        if (h) {
          setLayout((l) => l.map((it) => (it.i === id ? { ...it, h, static: false } : it)))
        }
      } else {
        next.add(id)
        setLayout((l) => l.map((it) => {
          if (it.i !== id) return it
          savedHeights.current[id] = it.h
          return { ...it, h: 2, minH: 2, static: true }
        }))
      }
      localStorage.setItem(collapsedKey, JSON.stringify([...next]))
      return next
    })
  }, [collapsedKey])

  const resetLayout = useCallback(() => {
    const { defaultLayout } = layoutConfig(layoutMode)
    setLayout(compactLayoutVertical(cloneLayout(defaultLayout)))
    setCollapsed(new Set())
    savedHeights.current = {}
    localStorage.removeItem(storageKey)
    localStorage.removeItem(collapsedKey)
    setFullscreen(null)
  }, [layoutMode, storageKey, collapsedKey])

  useEffect(() => {
    onRegisterReset?.(resetLayout)
    return () => onRegisterReset?.(null)
  }, [resetLayout, onRegisterReset])

  if (fullscreen && panels[fullscreen]) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-desk-bg p-2">
        <div className="mb-2 flex justify-end gap-2">
          <button type="button" onClick={() => setFullscreen(null)} className="toolbar-btn">Exit Fullscreen</button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{panels[fullscreen]}</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="dashboard-grid-container relative min-h-0 flex-1 basis-0"
    >
      <GridLayout
        className="layout"
        layout={layout}
        cols={GRID_COLS}
        rowHeight={rowHeight}
        margin={[MARGIN, MARGIN]}
        containerPadding={[CONTAINER_PADDING, CONTAINER_PADDING]}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        draggableHandle=".panel-drag-handle"
        draggableCancel={DRAG_CANCEL}
        compactType="vertical"
        preventCollision={false}
        isDraggable
        isResizable
        resizeHandles={RESIZE_HANDLES}
        useCSSTransforms
        style={{ minHeight: fillsViewport ? '100%' : gridHeight, height: fillsViewport ? '100%' : undefined }}
      >
        {panelOrder.filter((id) => panels[id]).map((id) => (
          <div key={id} className="grid-panel-wrapper">
            <div className="panel-chrome">
              <div className="panel-controls panel-no-drag">
                <button type="button" className="panel-ctrl-btn" onClick={() => toggleCollapse(id)} title="Collapse">
                  {collapsed.has(id) ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                </button>
                <button type="button" className="panel-ctrl-btn" onClick={() => setFullscreen(id)} title="Fullscreen">
                  <Maximize2 size={10} />
                </button>
              </div>
              <div className={collapsed.has(id) ? 'h-full overflow-hidden [&_.panel-body]:hidden' : 'h-full overflow-hidden'}>
                {panels[id]!}
              </div>
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  )
}