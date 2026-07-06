export interface DepthLevel {
  price: number
  quantity: number
}

export interface BookLadderRow {
  price: number
  bid_size: number
  ask_size: number
  bid_pct: number
  ask_pct: number
  executed: boolean
}

export interface StrategyRow {
  strategy: string
  total_pnl: number
  position: number
  sharpe: number | null
  max_drawdown: number
  fill_rate: number
  win_rate: number
  spread_capture: number
  adverse_selection_cost: number
  avg_abs_inventory: number
  is_best?: boolean
}

export interface QuoteDecision {
  mid_price: number | null
  reservation_price: number | null
  fair_value: number | null
  inventory: number
  volatility: number
  gamma: number
  k: number
  optimal_half_spread: number | null
  optimal_bid: number | null
  optimal_ask: number | null
  regime: string
  reasoning: string[]
  fill_probability_bid: number
  fill_probability_ask: number
}

export interface PnlDecomposition {
  realized_pnl: number
  unrealized_pnl: number
  spread_capture: number
  inventory_loss: number
  transaction_fees: number
  slippage: number
  adverse_selection: number
  net_pnl: number
}

export interface QueueAnalytics {
  bid_position: number | null
  ask_position: number | null
  bid_queue_length: number
  ask_queue_length: number
  fill_probability_bid: number
  fill_probability_ask: number
  expected_time_to_fill_bid_ms: number
  expected_time_to_fill_ask_ms: number
  queue_movement: string
}

export interface ReplayFrame {
  timestamp: number
  frame_index: number
  total_frames: number
  playing: boolean
  playback_speed: number
  mode: string
  exchange: string
  symbol: string
  strategy: string
  regime: string
  system_status: string
  best_bid: number | null
  best_ask: number | null
  mid_price: number | null
  spread: number | null
  reservation_price: number | null
  fair_value: number | null
  our_bid: number | null
  our_ask: number | null
  bid_depth: DepthLevel[]
  ask_depth: DepthLevel[]
  position: number
  avg_abs_inventory: number
  max_abs_inventory: number
  exposure: number
  risk_score: number
  gamma: number
  k: number
  sigma: number
  tau: number
  toxicity: number
  optimal_spread: number | null
  kill_switch: boolean
  circuit_breaker: boolean
  total_pnl: number
  realized_pnl: number
  unrealized_pnl: number
  spread_capture: number
  inventory_mtm: number
  transaction_fees: number
  adverse_selection_cost: number
  sharpe_ratio: number | null
  sortino_ratio: number | null
  max_drawdown: number
  fill_rate: number
  win_rate: number
  avg_trade_profit: number
  fill_count: number
  pnl_timeline: { timestamp: number; pnl?: number; position?: number }[]
  inventory_timeline: { timestamp: number; position?: number }[]
  quote_trail: { timestamp: number; mid: number; bid: number; ask: number; reservation: number }[]
  recent_fills: { timestamp: number; price: number; quantity: number; side: string }[]
  queue_position_bid: number | null
  queue_position_ask: number | null
  fill_probability_bid: number
  fill_probability_ask: number
  execution_latency_us: number
  quote_lifetime_ms: number
  cancel_rate: number
  fill_efficiency: number
  events_per_sec: number
  end_to_end_latency_ms: number
  cpu_percent: number
  memory_mb: number
  order_flow_imbalance: number
  events: { timestamp: string; category: string; message: string; severity: string }[]
  feed_type: string
  dataset_name: string
  total_events: number
  replay_time_display: string
  progress_pct: number
  live_mode: boolean
  live_connected: boolean
  live_ping_ms: number
  connection_quality: string
  packet_loss_pct: number
  book_ladder: BookLadderRow[]
  quote_decision: QuoteDecision
  pnl_decomposition: PnlDecomposition
  strategy_comparison: StrategyRow[]
  latency_breakdown: Record<string, number>
  inventory_distribution: { position: number; count: number }[]
  inventory_heatmap: { timestamp: number; intensity: number }[]
  queue_analytics: QueueAnalytics
  calmar_ratio: number | null
  profit_factor: number
  expectancy: number
  rolling_sharpe: { timestamp: number; sharpe: number }[]
  event_inspector: Record<string, unknown>
  ai_summary: string
  bookmarks: { index: number; timestamp: number; label: string }[]
  replay_complete?: boolean
  algo_state?: AlgoState
  asset_class?: string
}

export interface DataSource {
  id: string
  label: string
  exchange: string
  type: string
  format?: string
  status?: string
}

export type PanelId =
  | 'dataSource'
  | 'leftSidebar'
  | 'orderBook'
  | 'centerChart'
  | 'quoteDecision'
  | 'rightSidebar'
  | 'replayToolbar'
  | 'strategyCompare'
  | 'pnlDecomposition'
  | 'inventoryAnalytics'
  | 'queuePosition'
  | 'latencyAnalytics'
  | 'eventFeed'
  | 'performance'
  | 'execution'
  | 'aiAnalysis'
  | 'eventInspector'
  | 'instrumentPicker'
  | 'automationPanel'
  | 'algoOrderBook'
  | 'liveNewsFeed'
  | 'trendingMarquee'
  | 'trendingStocks'
  | 'stockDetail'
  | 'paperStockLock'
  | 'paperPnlSummary'
  | 'liveSymbolBar'
  | 'liveMarketStats'
  | 'liveEventFeed'

export type ChartDisplayType = 'line' | 'candlestick' | 'area' | 'mountain'

export type LiveChartRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX'

export const DEFAULT_CHART_RANGE: LiveChartRange = '1M'

export interface ChartHistoryBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface InstrumentOption {
  symbol: string
  exchange: string
  asset_class: string
  label: string
}

export interface AlgoState {
  active: boolean
  strategy: string
  quotes_posted: number
  fills: number
  win_rate: number
}

export type OverlayKey =
  | 'orderBookDepth'
  | 'bidAskHeatmap'
  | 'tradePrints'
  | 'queuePosition'
  | 'inventory'
  | 'reservationPrice'
  | 'midPrice'
  | 'fairValue'
  | 'spread'
  | 'volatilityBands'
  | 'adverseSelection'
  | 'latencySim'
  | 'fillProbability'
  | 'riskLimits'
  | 'regimeDetection'
  | 'orderFlowImbalance'
  | 'vwap'
  | 'liquidityWalls'

export const OVERLAY_OPTIONS: { key: OverlayKey; label: string }[] = [
  { key: 'orderBookDepth', label: 'Order Book Depth' },
  { key: 'bidAskHeatmap', label: 'Bid/Ask Heatmap' },
  { key: 'tradePrints', label: 'Trade Prints' },
  { key: 'orderFlowImbalance', label: 'Order Flow Imbalance' },
  { key: 'liquidityWalls', label: 'Liquidity Walls' },
  { key: 'queuePosition', label: 'Queue Position' },
  { key: 'inventory', label: 'Inventory Visualization' },
  { key: 'reservationPrice', label: 'Reservation Price' },
  { key: 'midPrice', label: 'Mid Price' },
  { key: 'fairValue', label: 'Fair Value' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'spread', label: 'Spread Width' },
  { key: 'volatilityBands', label: 'Volatility Bands' },
  { key: 'adverseSelection', label: 'Adverse Selection' },
  { key: 'latencySim', label: 'Latency Simulation' },
  { key: 'fillProbability', label: 'Fill Probability' },
  { key: 'riskLimits', label: 'Risk Limits' },
  { key: 'regimeDetection', label: 'Market Regime Detection' },
]

export type WorkstationPage = 'trading'

export interface TrendingStock {
  symbol: string
  exchange: string
  price: number
  change_pct: number
  volume: number
}

export interface MarketNewsItem {
  id: string
  headline: string
  source: string
  created_at: string
  symbols: string[]
  summary: string
}

export type DataMode = 'replay' | 'paper' | 'live'

export interface TradeRecord {
  id: number
  time: number
  time_display: string
  exchange: string
  symbol: string
  side: string
  quantity: number
  entry: number
  exit: number
  price: number
  pnl: number
  fees: number
  strategy: string
  latency_us: number
  status: string
}

export interface TradeBookSession {
  symbol: string
  exchange: string
  feed_type: string
  algo_active: boolean
  strategy: string
}

export interface TradeBookData {
  session?: TradeBookSession
  open_positions: {
    symbol: string
    exchange: string
    side: string
    quantity: number
    unrealized_pnl: number
    exposure: number
  }[]
  open_orders: {
    order_id: number
    side: string
    price: number
    quantity: number
    timestamp: number
    status: string
  }[]
  completed_trades: TradeRecord[]
  summary: {
    daily_pnl: number
    realized_pnl: number
    unrealized_pnl: number
    fees: number
    inventory: number
    exposure: number
    trade_count: number
  }
  pnl_history: { timestamp: number; pnl?: number }[]
  inventory_history: { timestamp: number; position?: number }[]
}

export interface LogEvent {
  timestamp: string
  category: string
  message: string
  severity: string
}

export interface DatasetOption {
  id: string
  label: string
  exchange: string
}

export interface StressLabRow {
  regime: string
  strategy: string
  total_return: number
  sharpe: number | null
  max_drawdown: number
  avg_inventory: number
  max_inventory: number
  fill_rate: number
  fills: number
  survival: boolean
  note?: string
}

export interface EngineBenchmark {
  events_per_sec: number
  latency_ms: number
  cpu_percent: number
  memory_mb: number
  simulation_speed: string
  book_updates_per_sec: number
  execution_throughput: number
  note?: string
}

export interface BenchmarkData {
  python_engine: EngineBenchmark
  cpp_engine: EngineBenchmark
  detailed_benchmark_passed: boolean
  detailed_benchmark_tail: string[]
}