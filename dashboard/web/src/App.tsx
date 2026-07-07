import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArchitectureView } from './components/ArchitectureView'
import { DashboardLayout } from './components/DashboardLayout'
import { EventFeed } from './components/EventFeed'
import { ExecutionPanel } from './components/ExecutionPanel'
import { LeftSidebar } from './components/LeftSidebar'
import { MicrostructureChart } from './components/MicrostructureChart'
import { PerformancePanel } from './components/PerformancePanel'
import { ReplayToolbar } from './components/ReplayToolbar'
import { RightSidebar } from './components/RightSidebar'
import { TopNav } from './components/TopNav'
import { GlassPanel } from './components/ui/GlassPanel'
import { useReplaySocket } from './hooks/useReplaySocket'
import { OVERLAY_OPTIONS, type OverlayKey } from './types'

const defaultOverlays = Object.fromEntries(
  OVERLAY_OPTIONS.map((o) => [o.key, true]),
) as Record<OverlayKey, boolean>

type Tab = 'trading' | 'architecture'

export default function App() {
  const { frame, connected, datasets, control, configure } = useReplaySocket()
  const [overlays, setOverlays] = useState(defaultOverlays)
  const [tab, setTab] = useState<Tab>('trading')
  const [showSettings, setShowSettings] = useState(false)

  const toggleOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const panels = useMemo(
    () => ({
      leftSidebar: <LeftSidebar overlays={overlays} onToggle={toggleOverlay} />,
      centerChart: (
        <GlassPanel className="h-full" title="Market Microstructure">
          <MicrostructureChart frame={frame} overlays={overlays} />
        </GlassPanel>
      ),
      rightSidebar: <RightSidebar frame={frame} />,
      replayToolbar: (
        <div className="h-full overflow-hidden rounded-xl border border-desk-border/60 bg-desk-panel/70 backdrop-blur-glass">
          <ReplayToolbar
            frame={frame}
            datasets={datasets}
            onControl={control}
            onConfigure={configure}
          />
        </div>
      ),
      eventFeed: <EventFeed events={frame?.events ?? []} />,
      performance: <PerformancePanel frame={frame} />,
      execution: <ExecutionPanel frame={frame} />,
    }),
    [frame, overlays, datasets, control, configure, toggleOverlay],
  )

  return (
    <div className="flex h-screen flex-col bg-desk-bg">
      <TopNav frame={frame} connected={connected} onSettings={() => setShowSettings((s) => !s)} />

      <div className="flex items-center gap-2 border-b border-desk-border/50 px-4 py-1">
        <TabButton active={tab === 'trading'} onClick={() => setTab('trading')}>
          Trading Desk
        </TabButton>
        <TabButton active={tab === 'architecture'} onClick={() => setTab('architecture')}>
          Architecture
        </TabButton>
        {frame && (
          <motion.span
            key={frame.regime}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="ml-auto rounded-full border border-desk-info/40 bg-desk-info/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-desk-info"
          >
            Regime: {frame.regime.replace('_', ' ')}
          </motion.span>
        )}
        {tab === 'trading' && (
          <span className="text-[10px] text-desk-muted">Drag panel headers · resize corners</span>
        )}
      </div>

      {tab === 'trading' ? (
        <DashboardLayout panels={panels} />
      ) : (
        <div className="min-h-0 flex-1 p-2">
          <ArchitectureView />
        </div>
      )}

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-96 p-4"
            >
              <h2 className="mb-3 text-sm font-semibold">Session Settings</h2>
              <div className="space-y-3 text-xs text-desk-muted">
                <p>Drag panel headers to rearrange. Resize from bottom-right corner. Layout persists in browser storage.</p>
                <label className="flex items-center justify-between">
                  Toxicity Monitor
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={(e) => configure({ enable_toxicity: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between">
                  γ (gamma)
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={0.1}
                    className="w-20 rounded border border-desk-border bg-black/30 px-2 py-1 text-white"
                    onChange={(e) => configure({ gamma: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center justify-between">
                  k (intensity)
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={1.5}
                    className="w-20 rounded border border-desk-border bg-black/30 px-2 py-1 text-white"
                    onChange={(e) => configure({ k: Number(e.target.value) })}
                  />
                </label>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-desk-info/15 text-desk-info' : 'text-desk-muted hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}