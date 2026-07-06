import { memo } from 'react'
import { AiAnalysisPanel } from './AiAnalysisPanel'
import { AlgoOrderBookPanel } from './AlgoOrderBookPanel'
import { AutomationPanel } from './AutomationPanel'
import { DataSourcePanel } from './DataSourcePanel'
import { EventFeed } from './EventFeed'
import { EventInspectorPanel } from './EventInspectorPanel'
import { ExecutionPanel } from './ExecutionPanel'
import { LiveMarketStatsPanel } from './LiveMarketStatsPanel'
import { LiveNewsFeedPanel } from './LiveNewsFeedPanel'
import { LiveSymbolBarPanel } from './LiveSymbolBarPanel'
import { PaperPnlSummaryPanel } from './PaperPnlSummaryPanel'
import { PaperStockLockPanel } from './PaperStockLockPanel'
import { StockDetailPanel } from './StockDetailPanel'
import { TrendingMarqueePanel } from './TrendingMarqueePanel'
import { TrendingStocksPanel } from './TrendingStocksPanel'
import { InventoryAnalyticsPanel } from './InventoryAnalyticsPanel'
import { LatencyWaterfallPanel } from './LatencyWaterfallPanel'
import { LeftSidebar } from './LeftSidebar'
import { MicrostructureChart } from './MicrostructureChart'
import { OrderBookPanel } from './OrderBookPanel'
import { PerformancePanel } from './PerformancePanel'
import { PnlDecompositionPanel } from './PnlDecompositionPanel'
import { QueuePositionPanel } from './QueuePositionPanel'
import { QuoteDecisionPanel } from './QuoteDecisionPanel'
import { ReplayToolbar } from './ReplayToolbar'
import { RightSidebar } from './RightSidebar'
import { StrategyComparisonPanel } from './StrategyComparisonPanel'
import { GlassPanel } from './ui/GlassPanel'
import { useFrame } from '../hooks/useFrame'

import type {
  DataMode,
  DataSource,
  DatasetOption,
  InstrumentOption,
  OverlayKey,
  PanelId,
} from '../types'
import type { ReactNode } from 'react'

type PanelDeps = {
  deskMode: DataMode
  overlays: Record<OverlayKey, boolean>
  datasets: DatasetOption[]
  dataSources: { historical: DataSource[]; paper: DataSource[]; live: DataSource[] }
  leftCollapsed: boolean
  onConnect: (instrument: InstrumentOption, mode: DataMode) => void
  onPaperConnect: (instrument: InstrumentOption) => void
  onLiveViewStock: (symbol: string) => void
  onDataSourceSelect: (id: string, mode: DataMode) => void
  onConfigure: (config: Record<string, unknown>) => void
  onControl: (action: string) => void
  onToggleOverlay: (key: OverlayKey) => void
  onExpandSidebar: () => void
  onCollapseSidebar: () => void
  onOpenTradeBook?: () => void
}

const AutomationSlot = memo(function AutomationSlot({
  onConfigure,
  onControl,
}: Pick<PanelDeps, 'onConfigure' | 'onControl'>) {
  const frame = useFrame()
  return <AutomationPanel frame={frame} onConfigure={onConfigure} onControl={onControl} />
})

const AlgoOrderBookSlot = memo(function AlgoOrderBookSlot() {
  const frame = useFrame()
  return <AlgoOrderBookPanel frame={frame} />
})

const DataSourceSlot = memo(function DataSourceSlot({
  dataSources,
  deskMode,
  onDataSourceSelect,
}: Pick<PanelDeps, 'dataSources' | 'deskMode' | 'onDataSourceSelect'>) {
  const frame = useFrame()
  return (
    <DataSourcePanel
      frame={frame}
      sources={dataSources}
      mode={deskMode}
      onSelect={onDataSourceSelect}
    />
  )
})

const LeftSidebarSlot = memo(function LeftSidebarSlot({
  overlays,
  leftCollapsed,
  onToggleOverlay,
  onExpandSidebar,
  onCollapseSidebar,
}: Pick<PanelDeps, 'overlays' | 'leftCollapsed' | 'onToggleOverlay' | 'onExpandSidebar' | 'onCollapseSidebar'>) {
  if (leftCollapsed) {
    return (
      <GlassPanel title="Layers" className="h-full">
        <button onClick={onExpandSidebar} className="m-2 text-[10px] text-desk-info">Expand →</button>
      </GlassPanel>
    )
  }
  return <LeftSidebar overlays={overlays} onToggle={onToggleOverlay} onCollapse={onCollapseSidebar} />
})

const OrderBookSlot = memo(function OrderBookSlot() {
  const frame = useFrame()
  return <OrderBookPanel frame={frame} />
})

const CenterChartSlot = memo(function CenterChartSlot({
  overlays,
}: Pick<PanelDeps, 'overlays'>) {
  const frame = useFrame()
  return (
    <GlassPanel className="h-full" title="Market Microstructure">
      <MicrostructureChart frame={frame} overlays={overlays} chartType="mountain" />
    </GlassPanel>
  )
})

const QuoteDecisionSlot = memo(function QuoteDecisionSlot() {
  const frame = useFrame()
  return <QuoteDecisionPanel frame={frame} />
})

const RightSidebarSlot = memo(function RightSidebarSlot() {
  const frame = useFrame()
  return <RightSidebar frame={frame} />
})

const ReplayToolbarSlot = memo(function ReplayToolbarSlot({
  datasets,
  onControl,
  onConfigure,
}: Pick<PanelDeps, 'datasets' | 'onControl' | 'onConfigure'>) {
  const frame = useFrame()
  return (
    <div className="h-full overflow-hidden rounded-panel border border-desk-border bg-desk-panel">
      <ReplayToolbar frame={frame} datasets={datasets} onControl={onControl} onConfigure={onConfigure} />
    </div>
  )
})

const StrategyCompareSlot = memo(function StrategyCompareSlot() {
  const frame = useFrame()
  return <StrategyComparisonPanel frame={frame} />
})

const PnlSlot = memo(function PnlSlot() {
  const frame = useFrame()
  return <PnlDecompositionPanel frame={frame} />
})

const InventorySlot = memo(function InventorySlot() {
  const frame = useFrame()
  return <InventoryAnalyticsPanel frame={frame} />
})

const QueueSlot = memo(function QueueSlot() {
  const frame = useFrame()
  return <QueuePositionPanel frame={frame} />
})

const LatencySlot = memo(function LatencySlot() {
  const frame = useFrame()
  return <LatencyWaterfallPanel frame={frame} />
})

const EventFeedSlot = memo(function EventFeedSlot() {
  const frame = useFrame()
  return <EventFeed events={frame?.events ?? []} />
})

const PerformanceSlot = memo(function PerformanceSlot() {
  const frame = useFrame()
  return <PerformancePanel frame={frame} />
})

const ExecutionSlot = memo(function ExecutionSlot() {
  const frame = useFrame()
  return <ExecutionPanel frame={frame} />
})

const AiSlot = memo(function AiSlot() {
  const frame = useFrame()
  return <AiAnalysisPanel frame={frame} />
})

const EventInspectorSlot = memo(function EventInspectorSlot() {
  const frame = useFrame()
  return <EventInspectorPanel frame={frame} />
})

const PaperStockLockSlot = memo(function PaperStockLockSlot({
  onPaperConnect,
}: Pick<PanelDeps, 'onPaperConnect'>) {
  const frame = useFrame()
  return <PaperStockLockPanel frame={frame} onConnect={onPaperConnect} />
})

const PaperPnlSummarySlot = memo(function PaperPnlSummarySlot({
  onOpenTradeBook,
}: Pick<PanelDeps, 'onOpenTradeBook'>) {
  return <PaperPnlSummaryPanel onOpenTradeBook={onOpenTradeBook} />
})

const StockDetailSlot = memo(function StockDetailSlot({
  onLiveViewStock,
}: Pick<PanelDeps, 'onLiveViewStock'>) {
  return <StockDetailPanel onViewStock={onLiveViewStock} />
})

const TrendingStocksSlot = memo(function TrendingStocksSlot({
  onLiveViewStock,
}: Pick<PanelDeps, 'onLiveViewStock'>) {
  return <TrendingStocksPanel onSelectStock={onLiveViewStock} />
})

export function buildPanelSlots(deps: PanelDeps): Partial<Record<PanelId, ReactNode>> {
  const all: Partial<Record<PanelId, ReactNode>> = {
    dataSource: (
      <DataSourceSlot
        dataSources={deps.dataSources}
        deskMode={deps.deskMode}
        onDataSourceSelect={deps.onDataSourceSelect}
      />
    ),
    leftSidebar: (
      <LeftSidebarSlot
        overlays={deps.overlays}
        leftCollapsed={deps.leftCollapsed}
        onToggleOverlay={deps.onToggleOverlay}
        onExpandSidebar={deps.onExpandSidebar}
        onCollapseSidebar={deps.onCollapseSidebar}
      />
    ),
    orderBook: <OrderBookSlot />,
    centerChart: (
      <CenterChartSlot overlays={deps.overlays} />
    ),
    quoteDecision: <QuoteDecisionSlot />,
    rightSidebar: <RightSidebarSlot />,
    replayToolbar: (
      <ReplayToolbarSlot datasets={deps.datasets} onControl={deps.onControl} onConfigure={deps.onConfigure} />
    ),
    strategyCompare: <StrategyCompareSlot />,
    pnlDecomposition: <PnlSlot />,
    inventoryAnalytics: <InventorySlot />,
    queuePosition: <QueueSlot />,
    latencyAnalytics: <LatencySlot />,
    eventFeed: <EventFeedSlot />,
    performance: <PerformanceSlot />,
    execution: <ExecutionSlot />,
    aiAnalysis: <AiSlot />,
    eventInspector: <EventInspectorSlot />,
    automationPanel: <AutomationSlot onConfigure={deps.onConfigure} onControl={deps.onControl} />,
    algoOrderBook: <AlgoOrderBookSlot />,
    paperStockLock: <PaperStockLockSlot onPaperConnect={deps.onPaperConnect} />,
    paperPnlSummary: <PaperPnlSummarySlot onOpenTradeBook={deps.onOpenTradeBook} />,
    liveNewsFeed: <LiveNewsFeedPanel />,
    liveSymbolBar: <LiveSymbolBarPanel />,
    liveMarketStats: <LiveMarketStatsPanel />,
    liveEventFeed: <EventFeedSlot />,
    trendingMarquee: <TrendingMarqueePanel onSelectStock={deps.onLiveViewStock} />,
    trendingStocks: <TrendingStocksSlot onLiveViewStock={deps.onLiveViewStock} />,
    stockDetail: <StockDetailSlot onLiveViewStock={deps.onLiveViewStock} />,
  }

  if (deps.deskMode === 'replay') {
    return {
      dataSource: all.dataSource,
      leftSidebar: all.leftSidebar,
      orderBook: all.orderBook,
      centerChart: all.centerChart,
      quoteDecision: all.quoteDecision,
      rightSidebar: all.rightSidebar,
      replayToolbar: all.replayToolbar,
      strategyCompare: all.strategyCompare,
      pnlDecomposition: all.pnlDecomposition,
      inventoryAnalytics: all.inventoryAnalytics,
      queuePosition: all.queuePosition,
      latencyAnalytics: all.latencyAnalytics,
      eventFeed: all.eventFeed,
      performance: all.performance,
      execution: all.execution,
      aiAnalysis: all.aiAnalysis,
      eventInspector: all.eventInspector,
    }
  }

  if (deps.deskMode === 'paper') {
    return {
      paperStockLock: all.paperStockLock,
      automationPanel: all.automationPanel,
      algoOrderBook: all.algoOrderBook,
      centerChart: all.centerChart,
      quoteDecision: all.quoteDecision,
      rightSidebar: all.rightSidebar,
      paperPnlSummary: all.paperPnlSummary,
      performance: all.performance,
      execution: all.execution,
      eventFeed: all.eventFeed,
      pnlDecomposition: all.pnlDecomposition,
      latencyAnalytics: all.latencyAnalytics,
    }
  }

  return {
    trendingMarquee: all.trendingMarquee,
    stockDetail: all.stockDetail,
    liveNewsFeed: all.liveNewsFeed,
    liveSymbolBar: all.liveSymbolBar,
    trendingStocks: all.trendingStocks,
    liveMarketStats: all.liveMarketStats,
    liveEventFeed: all.liveEventFeed,
  }
}