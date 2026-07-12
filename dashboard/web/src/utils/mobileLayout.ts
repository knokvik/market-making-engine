import type { LayoutItem } from 'react-grid-layout/legacy'
import type { LayoutMode } from '../components/DashboardLayout'
import type { PanelId } from '../types'

const MOBILE_HEIGHTS: Partial<Record<PanelId, number>> = {
  leftSidebar: 5,
  orderBook: 6,
  centerChart: 12,
  eventInspector: 5,
  replayToolbar: 3,
  quoteDecision: 4,
  rightSidebar: 4,
  strategyCompare: 5,
  pnlDecomposition: 5,
  performance: 5,
  latencyAnalytics: 6,
  dataSource: 5,
  inventoryAnalytics: 5,
  queuePosition: 5,
  eventFeed: 5,
  execution: 5,
  aiAnalysis: 5,
  paperStockLock: 5,
  automationPanel: 5,
  algoOrderBook: 6,
  paperPnlSummary: 4,
  trendingMarquee: 2,
  stockDetail: 12,
  liveNewsFeed: 6,
  liveSymbolBar: 2,
  trendingStocks: 6,
  liveMarketStats: 5,
  liveEventFeed: 5,
}

const REPLAY_ORDER: PanelId[] = [
  'centerChart',
  'replayToolbar',
  'orderBook',
  'leftSidebar',
  'eventInspector',
  'quoteDecision',
  'rightSidebar',
  'strategyCompare',
  'pnlDecomposition',
  'performance',
  'latencyAnalytics',
  'dataSource',
  'inventoryAnalytics',
  'queuePosition',
  'eventFeed',
  'execution',
  'aiAnalysis',
]

const PAPER_ORDER: PanelId[] = [
  'centerChart',
  'paperStockLock',
  'algoOrderBook',
  'automationPanel',
  'quoteDecision',
  'rightSidebar',
  'paperPnlSummary',
  'performance',
  'execution',
  'eventFeed',
  'pnlDecomposition',
  'latencyAnalytics',
]

const LIVE_ORDER: PanelId[] = [
  'trendingMarquee',
  'stockDetail',
  'liveSymbolBar',
  'liveNewsFeed',
  'trendingStocks',
  'liveMarketStats',
  'liveEventFeed',
]

function panelOrderForMode(mode: LayoutMode): PanelId[] {
  if (mode === 'paper') return PAPER_ORDER
  if (mode === 'live') return LIVE_ORDER
  return REPLAY_ORDER
}

export function buildMobileLayout(mode: LayoutMode, activePanelIds: PanelId[]): LayoutItem[] {
  const order = panelOrderForMode(mode)
  let y = 0

  return order
    .filter((id) => activePanelIds.includes(id))
    .map((id) => {
      const h = MOBILE_HEIGHTS[id] ?? 5
      const item: LayoutItem = {
        i: id,
        x: 0,
        y,
        w: 12,
        h,
        minW: 12,
        maxW: 12,
        minH: 2,
        static: true,
      }
      y += h
      return item
    })
}