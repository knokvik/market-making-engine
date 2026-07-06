import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import type { DatasetOption, ReplayFrame } from '../types'

interface ReplayToolbarProps {
  frame: ReplayFrame | null
  datasets: DatasetOption[]
  onControl: (action: string, extra?: Record<string, unknown>) => void
  onConfigure: (config: Record<string, unknown>) => void
}

const SPEEDS = [0.5, 1, 2, 5, 10, 25, 50, 100]

export function ReplayToolbar({ frame, datasets, onControl, onConfigure }: ReplayToolbarProps) {
  const progress = frame ? ((frame.frame_index + 1) / Math.max(frame.total_frames, 1)) * 100 : 0

  return (
    <div className="border-t border-desk-border/60 bg-desk-panel/60 px-3 py-2 backdrop-blur-glass">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ToolbarButton onClick={() => onControl('step_backward')} icon={<SkipBack size={14} />} label="Back" />
        <ToolbarButton onClick={() => onControl('step_backward')} icon={<ChevronLeft size={14} />} />
        {frame?.playing ? (
          <ToolbarButton onClick={() => onControl('pause')} icon={<Pause size={14} />} label="Pause" primary />
        ) : (
          <ToolbarButton onClick={() => onControl('play')} icon={<Play size={14} />} label="Play" primary />
        )}
        <ToolbarButton onClick={() => onControl('step_forward')} icon={<ChevronRight size={14} />} />
        <ToolbarButton onClick={() => onControl('step_forward')} icon={<SkipForward size={14} />} label="Fwd" />
        <ToolbarButton onClick={() => onControl('reset')} icon={<RotateCcw size={14} />} label="Reset" />

        <div className="mx-2 h-5 w-px bg-desk-border" />

        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onControl('set_speed', { speed })}
            className={`rounded px-2 py-1 text-[10px] font-mono ${
              frame?.playback_speed === speed
                ? 'bg-desk-info/20 text-desk-info'
                : 'text-desk-muted hover:bg-white/5'
            }`}
          >
            {speed}x
          </button>
        ))}

        <div className="mx-2 h-5 w-px bg-desk-border" />

        <select
          className="rounded-lg border border-desk-border bg-black/30 px-2 py-1 text-xs text-white"
          onChange={(e) => {
            const dataset = datasets.find((d) => d.id === e.target.value)
            onConfigure({
              dataset: e.target.value,
              exchange: dataset?.exchange ?? 'LOBSTER Replay',
            })
          }}
          defaultValue="data/sample_session.csv"
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-desk-border bg-black/30 px-2 py-1 text-xs text-white"
          onChange={(e) => onConfigure({ strategy: e.target.value })}
          defaultValue="avellaneda_stoikov"
        >
          <option value="avellaneda_stoikov">Avellaneda-Stoikov</option>
          <option value="symmetric">Symmetric</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max((frame?.total_frames ?? 1) - 1, 0)}
          value={frame?.frame_index ?? 0}
          onChange={(e) => onControl('seek', { index: Number(e.target.value) })}
          className="flex-1 accent-desk-info"
        />
        <span className="w-28 text-right font-mono text-[10px] text-desk-muted">
          {frame ? `${frame.frame_index + 1}/${frame.total_frames}` : '—'}
        </span>
        <span className="w-20 text-right font-mono text-[10px] text-desk-muted">{progress.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void
  icon: React.ReactNode
  label?: string
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
        primary
          ? 'border-desk-info/50 bg-desk-info/15 text-desk-info hover:bg-desk-info/25'
          : 'border-desk-border text-desk-muted hover:border-desk-info/30 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}