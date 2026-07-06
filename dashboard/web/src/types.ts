export interface DepthLevel {
  price: number
  quantity: number
}

export interface TimelinePoint {
  timestamp: number
  pnl?: number
  position?: number
}

export interface QuoteTrailPoint {
  timestamp: number
  mid: number
  bid: number
  ask: number
  reservation: number
}

export interface FillEvent {
  timestamp: number
  price: number
  quantity: number
  side: string
}

export interface LogEvent {
  timestamp: string
  category: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'danger'
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
  pnl_timeline: TimelinePoint[]
  inventory_timeline: TimelinePoint[]
  quote_trail: QuoteTrailPoint[]
  recent_fills: FillEvent[]
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
  events: LogEvent[]
}

export interface DatasetOption {
  id: string
  label: string
  exchange: string
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

export const OVERLAY_OPTIONS: { key: OverlayKey; label: string }[] = [
  { key: 'orderBookDepth', label: 'Order Book Depth' },
  { key: 'bidAskHeatmap', label: 'Bid/Ask Heatmap' },
  { key: 'tradePrints', label: 'Trade Prints' },
  { key: 'queuePosition', label: 'Queue Position' },
  { key: 'inventory', label: 'Inventory Visualization' },
  { key: 'reservationPrice', label: 'Reservation Price' },
  { key: 'midPrice', label: 'Mid Price' },
  { key: 'fairValue', label: 'Fair Value' },
  { key: 'spread', label: 'Spread Visualization' },
  { key: 'volatilityBands', label: 'Volatility Bands' },
  { key: 'adverseSelection', label: 'Adverse Selection Detection' },
  { key: 'latencySim', label: 'Latency Simulation' },
  { key: 'fillProbability', label: 'Fill Probability' },
  { key: 'riskLimits', label: 'Risk Limits' },
  { key: 'regimeDetection', label: 'Market Regime Detection' },
]