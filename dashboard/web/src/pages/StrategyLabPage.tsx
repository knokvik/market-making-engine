import { useCallback, useState } from 'react'
import { FlaskConical, Play, RotateCcw } from 'lucide-react'
import { AutomationPanel } from '../components/AutomationPanel'
import { DataSourceSelector } from '../components/DataSourceSelector'
import { InstrumentPickerPanel } from '../components/InstrumentPickerPanel'
import { MicrostructureChart } from '../components/MicrostructureChart'
import { ReplayToolbar } from '../components/ReplayToolbar'
import { StrategyComparisonPanel } from '../components/StrategyComparisonPanel'
import { StressLab } from '../components/StressLab'
import { GlassPanel } from '../components/ui/GlassPanel'
import { MetricCard } from '../components/ui/MetricCard'
import { isLiveSession } from '../hooks/useSessionMode'
import type {
  DataMode,
  DataSource,
  DatasetOption,
  InstrumentOption,
  OverlayKey,
  ReplayFrame,
  StressLabRow,
} from '../types'
import { OVERLAY_OPTIONS } from '../types'

const STRATEGIES = [
  { id: 'symmetric', label: 'Symmetric' },
  { id: 'avellaneda_stoikov', label: 'Avellaneda-Stoikov' },
  { id: 'glft', label: 'GLFT' },
  { id: 'custom', label: 'Custom Strategy' },
]

const REGIMES = ['calm', 'normal', 'volatile', 'trending', 'high_toxicity', 'flash_crash', 'liquidity_crisis']

interface StrategyLabPageProps {
  frame: ReplayFrame | null
  deskMode: DataMode
  sources: { historical: DataSource[]; paper: DataSource[]; live: DataSource[] }
  datasets: DatasetOption[]
  stressResults: StressLabRow[]
  stressLoading?: boolean
  onDataSourceSelect: (id: string, mode: DataMode) => void
  onInstrumentConnect: (instrument: InstrumentOption, mode: DataMode) => void
  onConfigure: (config: Record<string, unknown>) => void
  onControl: (action: string, extra?: Record<string, unknown>) => void
  onRunSimulation: () => void
  onFetchStress: () => void
}

export function StrategyLabPage({
  frame,
  deskMode,
  sources,
  datasets,
  stressResults,
  stressLoading,
  onDataSourceSelect,
  onInstrumentConnect,
  onConfigure,
  onControl,
  onRunSimulation,
  onFetchStress,
}: StrategyLabPageProps) {
  const liveDesk = isLiveSession(deskMode)
  const [strategy, setStrategy] = useState(frame?.strategy ?? 'avellaneda_stoikov')
  const [regime, setRegime] = useState(frame?.regime ?? 'normal')
  const [gamma, setGamma] = useState(frame?.gamma ?? 0.1)
  const [k, setK] = useState(frame?.k ?? 1.5)
  const [sigma, setSigma] = useState(frame?.sigma ?? 0.02)
  const [maxInv, setMaxInv] = useState(100)
  const [halfSpread, setHalfSpread] = useState(0.05)
  const [compareAll, setCompareAll] = useState(true)
  const overlays = Object.fromEntries(OVERLAY_OPTIONS.map((o) => [o.key, true])) as Record<OverlayKey, boolean>

  const applyParams = useCallback(() => {
    onConfigure({ strategy, regime, gamma, k, sigma, max_inventory: maxInv, half_spread: halfSpread })
  }, [onConfigure, strategy, regime, gamma, k, sigma, maxInv, halfSpread])

  const handleRun = () => {
    applyParams()
    onControl('reset')
    onRunSimulation()
    onFetchStress()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
      <GlassPanel title="Strategy Lab" className="shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-desk-muted">
            <FlaskConical size={13} />
            Research environment — develop, test, and compare market-making strategies
          </span>
          <div className="ml-auto flex gap-1.5">
            <button onClick={applyParams} className="toolbar-btn">Apply Params</button>
            <button onClick={handleRun} className="toolbar-btn border-desk-info/40 bg-desk-info/10 text-desk-info">
              <Play size={11} /> Run Simulation
            </button>
            <button onClick={() => onControl('reset')} className="toolbar-btn">
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>
      </GlassPanel>

      <div className="grid shrink-0 grid-cols-12 gap-2">
        <GlassPanel title={liveDesk ? 'Instrument' : 'Data Source'} className="col-span-4 min-h-[180px]">
          {liveDesk ? (
            <InstrumentPickerPanel
              frame={frame}
              sessionMode={deskMode}
              onConnect={onInstrumentConnect}
            />
          ) : (
            <DataSourceSelector
              frame={frame}
              sources={sources}
              mode={deskMode}
              onSelect={onDataSourceSelect}
              compact
            />
          )}
        </GlassPanel>

        <GlassPanel title="Strategy & Parameters" className="col-span-4">
          <div className="space-y-2 p-2 text-xs">
            <label className="block">
              <span className="text-[10px] uppercase text-desk-muted">Strategy</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="mt-0.5 w-full rounded border border-desk-border bg-black/30 px-2 py-1 text-[10px] text-white"
              >
                {STRATEGIES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase text-desk-muted">Market Regime</span>
              <select
                value={regime}
                onChange={(e) => setRegime(e.target.value)}
                className="mt-0.5 w-full rounded border border-desk-border bg-black/30 px-2 py-1 text-[10px] text-white"
              >
                {REGIMES.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <ParamSlider label="γ Gamma" value={gamma} min={0.01} max={1} step={0.01} onChange={setGamma} />
            <ParamSlider label="σ Volatility" value={sigma} min={0.005} max={0.1} step={0.005} onChange={setSigma} />
            <ParamSlider label="k Arrival Intensity" value={k} min={0.1} max={5} step={0.1} onChange={setK} />
            <ParamSlider label="Half Spread" value={halfSpread} min={0.01} max={0.2} step={0.01} onChange={setHalfSpread} />
            <ParamSlider label="Max Inventory" value={maxInv} min={10} max={500} step={10} onChange={setMaxInv} />
            <label className="flex items-center gap-2 pt-1">
              <input type="checkbox" checked={compareAll} onChange={(e) => setCompareAll(e.target.checked)} />
              <span className="text-[10px] text-desk-muted">Compare multiple strategies</span>
            </label>
          </div>
        </GlassPanel>

        <GlassPanel title="Performance Metrics" className="col-span-4">
          <div className="grid grid-cols-2 gap-1.5 p-2">
            <MetricCard label="Inventory" value={String(frame?.position ?? 0)} />
            <MetricCard label="Sharpe" value={frame?.sharpe_ratio?.toFixed(2) ?? '—'} tone="info" />
            <MetricCard label="Drawdown" value={(frame?.max_drawdown ?? 0).toFixed(2)} tone="loss" />
            <MetricCard label="Fill Rate" value={`${((frame?.fill_rate ?? 0) * 100).toFixed(1)}%`} />
            <MetricCard label="Win Rate" value={`${((frame?.win_rate ?? 0) * 100).toFixed(1)}%`} />
            <MetricCard label="Spread Capture" value={(frame?.spread_capture ?? 0).toFixed(2)} tone="profit" />
            <MetricCard label="Adverse Selection" value={(frame?.adverse_selection_cost ?? 0).toFixed(2)} tone="loss" />
            <MetricCard label="Trade Count" value={String(frame?.fill_count ?? 0)} />
          </div>
        </GlassPanel>
      </div>

      <div className="grid min-h-[280px] flex-1 grid-cols-12 gap-2">
        <GlassPanel title="Market Microstructure" className="col-span-8 min-h-0">
          <MicrostructureChart frame={frame} overlays={overlays} />
        </GlassPanel>
        {compareAll && (
          <div className="col-span-4 min-h-0 overflow-hidden">
            <StrategyComparisonPanel frame={frame} />
          </div>
        )}
      </div>

      {liveDesk ? (
        <GlassPanel title="Algo Automation" className="shrink-0">
          <AutomationPanel frame={frame} onConfigure={onConfigure} onControl={onControl} />
        </GlassPanel>
      ) : (
        <GlassPanel title="Replay Controls" className="shrink-0">
          <ReplayToolbar frame={frame} datasets={datasets} onControl={onControl} onConfigure={onConfigure} />
        </GlassPanel>
      )}

      <div className="min-h-[320px] shrink-0">
        <StressLab results={stressResults} loading={stressLoading} />
      </div>
    </div>
  )
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-[10px]">
        <span className="uppercase text-desk-muted">{label}</span>
        <span className="font-mono text-desk-info">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-desk-info"
      />
    </label>
  )
}