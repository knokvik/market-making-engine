import { useState } from 'react'
import { Bot, Play, Square } from 'lucide-react'
import { GlassPanel } from './ui/GlassPanel'
import { MetricCard } from './ui/MetricCard'
import type { ReplayFrame } from '../types'

interface AutomationPanelProps {
  frame: ReplayFrame | null
  onConfigure: (config: Record<string, unknown>) => void
  onControl: (action: string) => void
}

const STRATEGIES = [
  { id: 'avellaneda_stoikov', label: 'Avellaneda-Stoikov' },
  { id: 'symmetric', label: 'Symmetric' },
  { id: 'glft', label: 'GLFT' },
]

export function AutomationPanel({ frame, onConfigure, onControl }: AutomationPanelProps) {
  const algo = frame?.algo_state
  const [strategy, setStrategy] = useState(frame?.strategy ?? 'avellaneda_stoikov')
  const [gamma, setGamma] = useState(frame?.gamma ?? 0.1)
  const [k, setK] = useState(frame?.k ?? 1.5)
  const [sigma, setSigma] = useState(frame?.sigma ?? 0.02)
  const [maxInv, setMaxInv] = useState(100)

  const apply = () => {
    onConfigure({ strategy, gamma, k, sigma, max_inventory: maxInv })
  }

  return (
    <GlassPanel title="Algo Automation" className="h-full" action={<Bot size={14} className="text-desk-muted" />}>
      <div className="space-y-2 overflow-auto p-2 text-xs">
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="w-full rounded border border-desk-border bg-black/30 px-2 py-1 text-[10px] text-white"
        >
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <Slider label="γ Gamma" value={gamma} min={0.01} max={1} step={0.01} onChange={setGamma} />
        <Slider label="k Intensity" value={k} min={0.1} max={5} step={0.1} onChange={setK} />
        <Slider label="σ Volatility" value={sigma} min={0.005} max={0.1} step={0.005} onChange={setSigma} />
        <Slider label="Max Inventory" value={maxInv} min={10} max={500} step={10} onChange={setMaxInv} />

        <div className="flex gap-1.5">
          <button onClick={apply} className="toolbar-btn flex-1">Apply</button>
          {algo?.active ? (
            <button
              onClick={() => onControl('stop_algo')}
              className="toolbar-btn flex-1 border-desk-loss/40 text-desk-loss"
            >
              <Square size={11} /> Stop Algo
            </button>
          ) : (
            <button
              onClick={() => {
                apply()
                onControl('start_algo')
              }}
              className="toolbar-btn flex-1 border-desk-info/40 bg-desk-info/10 text-desk-info"
            >
              <Play size={11} /> Start Algo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <MetricCard label="Quotes" value={String(algo?.quotes_posted ?? 0)} />
          <MetricCard label="Fills" value={String(algo?.fills ?? 0)} />
          <MetricCard label="Win Rate" value={`${((algo?.win_rate ?? 0) * 100).toFixed(0)}%`} />
          <MetricCard
            label="Status"
            value={algo?.active ? 'RUNNING' : 'IDLE'}
            tone={algo?.active ? 'profit' : 'neutral'}
          />
        </div>
      </div>
    </GlassPanel>
  )
}

function Slider({
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
    <label>
      <div className="flex justify-between text-[10px]">
        <span className="text-desk-muted">{label}</span>
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