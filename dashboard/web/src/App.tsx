import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { DashboardLayout } from './components/DashboardLayout'
import { DeskModeSwitcher } from './components/DeskModeSwitcher'
import { HelpModal } from './components/HelpModal'
import { LiveDeskExtras } from './components/LiveDeskExtras'
import { LoadingScreen } from './components/LoadingScreen'
import { MadeByFooter } from './components/MadeByFooter'
import { ReplayHistoryBanner } from './components/ReplayHistoryBanner'
import { TradeBookDrawer } from './components/TradeBookDrawer'
import { buildPanelSlots } from './components/PanelSlots'
import { TopNav } from './components/TopNav'
import { WelcomeHint } from './components/WelcomeHint'
import { useDailyBoot } from './hooks/useDailyBoot'
import { FrameContext } from './hooks/useFrame'
import { DEFAULT_LIVE_SYMBOL, LiveTraderProvider } from './hooks/LiveTraderContext'
import { useReplayHistory } from './hooks/useReplayHistory'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useReplaySocket } from './hooks/useReplaySocket'
import {
  OVERLAY_OPTIONS,
  type DataMode,
  type InstrumentOption,
  type OverlayKey,
} from './types'

const THEME_KEY = 'mm-engine-theme'
const PAPER_LOCK_KEY = 'mm-paper-locked-symbol'
const defaultOverlays = Object.fromEntries(
  OVERLAY_OPTIONS.map((o) => [o.key, true]),
) as Record<OverlayKey, boolean>

export default function App() {
  const {
    frame,
    connected,
    datasets,
    dataSources,
    control,
    configure,
  } = useReplaySocket()

  const [overlays, setOverlays] = useState(defaultOverlays)
  const [showSettings, setShowSettings] = useState(false)
  const [showTradeBook, setShowTradeBook] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [deskMode, setDeskMode] = useState<DataMode>('paper')
  const [showHelp, setShowHelp] = useState(false)
  const layoutResetRef = useRef<(() => void) | null>(null)
  const replayBootRef = useRef(false)
  const showDailyBoot = useDailyBoot(connected)
  const { history: replayHistory, isFreshSession } = useReplayHistory(frame, deskMode)

  useEffect(() => {
    if (!connected || deskMode !== 'replay' || replayBootRef.current) return
    replayBootRef.current = true
    const source = dataSources.historical[0]
    configure({
      dataset: source?.id ?? 'data/sample_session.csv',
      live_mode: false,
      feed_type: 'historical_replay',
      auto_trade: false,
      exchange: source?.exchange ?? 'LOBSTER Replay',
      dataset_name: source?.label ?? 'Sample Session',
    })
  }, [connected, deskMode, dataSources.historical, configure])

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light') document.documentElement.classList.add('theme-light')
  }, [])

  useEffect(() => {
    if (deskMode !== 'paper') setShowTradeBook(false)
  }, [deskMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTradeBook(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const layoutMode: 'replay' | 'paper' | 'live' =
    deskMode === 'replay' ? 'replay' : deskMode === 'paper' ? 'paper' : 'live'

  const handleDataSourceSelect = useCallback(
    (id: string, mode: DataMode) => {
      if (mode === 'live') {
        configure({ dataset: id, live_mode: true, feed_type: 'live' })
      } else if (mode === 'paper') {
        configure({ dataset: id, live_mode: false, feed_type: 'paper_trading' })
      } else {
        const source = dataSources.historical.find((s) => s.id === id)
        configure({
          dataset: id,
          live_mode: false,
          feed_type: 'historical_replay',
          exchange: source?.exchange ?? 'LOBSTER Replay',
          dataset_name: source?.label ?? id,
        })
      }
    },
    [configure, dataSources],
  )

  const handleInstrumentConnect = useCallback(
    (instrument: InstrumentOption, mode: DataMode) => {
      const prefix = mode === 'live' ? 'live' : 'paper'
      const exchangeKey = instrument.exchange.toLowerCase().replace(/\s+/g, '')
      configure({
        dataset: `${prefix}:${exchangeKey}`,
        symbol: instrument.symbol,
        exchange: instrument.exchange,
        asset_class: instrument.asset_class,
        feed_type: mode === 'live' ? 'live' : 'paper_trading',
        live_mode: mode === 'live',
        auto_trade: mode === 'paper',
        dataset_name: `${instrument.symbol}_${mode === 'live' ? 'LIVE' : 'PAPER'}`,
      })
    },
    [configure],
  )

  const handlePaperConnect = useCallback(
    (instrument: InstrumentOption) => {
      handleInstrumentConnect(instrument, 'paper')
      setTimeout(() => control('start_algo'), 400)
    },
    [handleInstrumentConnect, control],
  )

  const handleLiveViewInstrument = useCallback(
    (instrument: InstrumentOption) => {
      const exchangeKey = instrument.exchange.toLowerCase().replace(/\s+/g, '')
      configure({
        dataset: `live:${exchangeKey}`,
        symbol: instrument.symbol,
        exchange: instrument.exchange,
        asset_class: instrument.asset_class,
        feed_type: 'live',
        live_mode: true,
        dataset_name: `${instrument.symbol}_LIVE`,
        auto_trade: false,
      })
    },
    [configure],
  )

  const handleLiveViewStock = useCallback(
    (symbol: string) => {
      handleLiveViewInstrument({
        symbol,
        exchange: 'Alpaca',
        asset_class: 'stock',
        label: symbol,
      })
    },
    [handleLiveViewInstrument],
  )

  const handleDeskModeChange = useCallback(
    (mode: DataMode) => {
      setDeskMode(mode)
      if (mode === 'paper') {
        const locked = localStorage.getItem(PAPER_LOCK_KEY)
        if (locked) {
          handlePaperConnect({
            symbol: locked,
            exchange: 'Alpaca',
            asset_class: 'stock',
            label: locked,
          })
        } else {
          handlePaperConnect({
            symbol: 'NVDA',
            exchange: 'Alpaca',
            asset_class: 'stock',
            label: 'NVDA',
          })
        }
      } else if (mode === 'live') {
        handleLiveViewStock(DEFAULT_LIVE_SYMBOL)
      } else {
        const source = dataSources.historical[0]
        if (source) {
          handleDataSourceSelect(source.id, 'replay')
          setTimeout(() => control('pause'), 50)
        }
      }
    },
    [control, dataSources, handleDataSourceSelect, handlePaperConnect, handleLiveViewStock],
  )

  const keyboardHandlers = useMemo(
    () => ({
      onPlayPause: () => control(frame?.playing ? 'pause' : 'play'),
      onStepForward: () => control('step_forward'),
      onStepBackward: () => control('step_backward'),
      onReset: () => control('reset'),
    }),
    [control, frame?.playing],
  )

  useKeyboardShortcuts(keyboardHandlers, layoutMode === 'replay' && !showTradeBook)

  const expandSidebar = useCallback(() => setLeftCollapsed(false), [])
  const collapseSidebar = useCallback(() => setLeftCollapsed(true), [])
  const openTradeBook = useCallback(() => setShowTradeBook(true), [])
  const closeTradeBook = useCallback(() => setShowTradeBook(false), [])

  const panels = useMemo(
    () =>
      buildPanelSlots({
        deskMode,
        overlays,
        datasets,
        dataSources,
        leftCollapsed,
        onConnect: handleInstrumentConnect,
        onPaperConnect: handlePaperConnect,
        onLiveViewStock: handleLiveViewStock,
        onDataSourceSelect: handleDataSourceSelect,
        onConfigure: configure,
        onControl: control,
        onToggleOverlay: toggleOverlay,
        onExpandSidebar: expandSidebar,
        onCollapseSidebar: collapseSidebar,
        onOpenTradeBook: openTradeBook,
      }),
    [
      deskMode,
      overlays,
      datasets,
      dataSources,
      leftCollapsed,
      handleInstrumentConnect,
      handlePaperConnect,
      handleLiveViewStock,
      handleDataSourceSelect,
      configure,
      control,
      toggleOverlay,
      expandSidebar,
      collapseSidebar,
      openTradeBook,
    ],
  )

  const modeLabel =
    frame?.live_mode ? 'LIVE' : frame?.feed_type === 'paper_trading' ? 'PAPER' : 'REPLAY'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-desk-bg">
      {showDailyBoot && <LoadingScreen overlay />}
      <TopNav
        frame={frame}
        connected={connected}
        onSettings={() => setShowSettings((s) => !s)}
        showResetLayout
        onResetLayout={() => layoutResetRef.current?.()}
        onHelp={() => setShowHelp(true)}
      />

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} deskMode={deskMode} />

      <div className="flex flex-wrap items-center gap-2 border-b border-desk-border bg-desk-bg px-2 py-1.5 sm:px-4 sm:py-1">
        <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-desk-text sm:inline">Trading Desk</span>

        <DeskModeSwitcher mode={deskMode} onChange={handleDeskModeChange} />

        {deskMode === 'paper' && (
          <button
            type="button"
            onClick={openTradeBook}
            className="toolbar-btn border-desk-warn/30 text-desk-warn"
          >
            <BookOpen size={11} />
            <span className="hidden min-[400px]:inline">Trade Book</span>
            <span className="hidden sm:inline"> →</span>
          </button>
        )}

        {frame && (
          <span
            className={`w-full rounded-full border px-2 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider sm:ml-auto sm:w-auto sm:px-3 sm:text-[10px] ${
              frame.live_mode
                ? 'border-desk-loss/40 bg-desk-loss/10 text-desk-loss'
                : frame.feed_type === 'paper_trading'
                  ? 'border-desk-profit/40 bg-desk-profit/10 text-desk-profit'
                  : 'border-desk-warn/30 bg-desk-warn/10 text-desk-warn'
            }`}
          >
            {modeLabel} · {frame.regime.replace('_', ' ')}
            {deskMode === 'paper' && frame.algo_state?.active && ` · ALGO ${frame.symbol}`}
          </span>
        )}
        <span className="hidden w-full text-[10px] text-desk-muted lg:inline lg:w-auto">
          {layoutMode === 'replay'
            ? 'Space play/pause · ←/→ step · R reset'
            : layoutMode === 'paper'
              ? 'Trade Book slides from right · knokvik to change stock'
              : 'Switch symbol bar below chart · candle/line/area modes'}
        </span>
      </div>

      <FrameContext.Provider value={frame}>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {deskMode === 'replay' && isFreshSession && replayHistory && (
            <div className="shrink-0">
              <ReplayHistoryBanner history={replayHistory} />
            </div>
          )}
          <WelcomeHint deskMode={deskMode} />
          {deskMode === 'live' ? (
            <LiveTraderProvider>
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <LiveDeskExtras onSelectInstrument={handleLiveViewInstrument} />
                <DashboardLayout
                  panels={panels}
                  layoutMode={layoutMode}
                  onRegisterReset={(fn) => { layoutResetRef.current = fn }}
                />
              </div>
            </LiveTraderProvider>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <DashboardLayout
                panels={panels}
                layoutMode={layoutMode}
                onRegisterReset={(fn) => { layoutResetRef.current = fn }}
              />
              <TradeBookDrawer
                open={showTradeBook && deskMode === 'paper'}
                onClose={closeTradeBook}
                frameIndex={frame?.frame_index}
                symbol={frame?.symbol}
                algoActive={frame?.algo_state?.active}
              />
            </div>
          )}
        </div>
      </FrameContext.Provider>

      <MadeByFooter />

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel mx-4 w-full max-w-sm p-4 sm:mx-0"
            >
              <h2 className="mb-3 text-sm font-semibold">Session Settings</h2>
              <div className="space-y-3 text-xs text-desk-muted">
                <p>Layout persists automatically. Use Reset Layout to restore defaults.</p>
                <label className="flex items-center justify-between">
                  Toxicity Monitor
                  <input type="checkbox" defaultChecked onChange={(e) => configure({ enable_toxicity: e.target.checked })} />
                </label>
                <label className="flex items-center justify-between">
                  γ (gamma)
                  <input type="number" step="0.01" defaultValue={0.1} className="w-20 rounded border border-desk-border bg-black/30 px-2 py-1 text-white" onChange={(e) => configure({ gamma: Number(e.target.value) })} />
                </label>
                <label className="flex items-center justify-between">
                  k (intensity)
                  <input type="number" step="0.1" defaultValue={1.5} className="w-20 rounded border border-desk-border bg-black/30 px-2 py-1 text-white" onChange={(e) => configure({ k: Number(e.target.value) })} />
                </label>
                <label className="flex items-center justify-between">
                  Theme
                  <select
                    className="rounded border border-desk-border bg-black/30 px-2 py-1 text-white"
                    defaultValue="dark"
                    onChange={(e) => {
                      localStorage.setItem(THEME_KEY, e.target.value)
                      document.documentElement.classList.toggle('theme-light', e.target.value === 'light')
                    }}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}