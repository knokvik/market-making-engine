import { useState } from 'react'
import {
  Bookmark,
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
  const [jumpTs, setJumpTs] = useState('')
  const progress = frame ? ((frame.frame_index + 1) / Math.max(frame.total_frames, 1)) * 100 : 0
  const bookmarks = frame?.bookmarks ?? []

  const handleJump = () => {
    if (!jumpTs || !frame) return
    const parts = jumpTs.split(':').map(Number)
    if (parts.length < 3) return
    const targetSec = parts[0] * 3600 + parts[1] * 60 + parts[2]
    const trail = frame.quote_trail
    let bestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < trail.length; i++) {
      const ts = trail[i].timestamp
      const sec = ts > 1e12 ? ts / 1e9 : ts / 1e6
      const diff = Math.abs(sec - targetSec)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = i
      }
    }
    onControl('seek', { index: bestIdx })
  }

  return (
    <div className="flex h-full flex-col border-t border-desk-border bg-desk-panel px-3 py-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <ToolbarButton onClick={() => onControl('step_backward')} icon={<SkipBack size={13} />} label="Back" />
        <ToolbarButton onClick={() => onControl('step_backward')} icon={<ChevronLeft size={13} />} />
        {frame?.replay_complete ? (
          <span className="rounded border border-desk-info/40 bg-desk-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-desk-info">
            Complete
          </span>
        ) : frame?.playing ? (
          <ToolbarButton onClick={() => onControl('pause')} icon={<Pause size={13} />} label="Pause" primary />
        ) : (
          <ToolbarButton onClick={() => onControl('play')} icon={<Play size={13} />} label="Play" primary />
        )}
        <ToolbarButton onClick={() => onControl('step_forward')} icon={<ChevronRight size={13} />} />
        <ToolbarButton onClick={() => onControl('step_forward')} icon={<SkipForward size={13} />} label="Fwd" />
        <ToolbarButton onClick={() => onControl('reset')} icon={<RotateCcw size={13} />} label="Reset" />

        <div className="mx-1 h-4 w-px bg-desk-border" />

        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onControl('set_speed', { speed })}
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
              frame?.playback_speed === speed ? 'bg-desk-info/20 text-desk-info' : 'text-desk-muted hover:bg-white/5'
            }`}
          >
            {speed}x
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-desk-border" />

        <select
          className="rounded border border-desk-border bg-black/30 px-2 py-0.5 text-[10px] text-white"
          onChange={(e) => {
            const dataset = datasets.find((d) => d.id === e.target.value)
            onConfigure({ dataset: e.target.value, exchange: dataset?.exchange ?? 'LOBSTER Replay' })
          }}
          defaultValue="data/sample_session.csv"
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>

        <select
          className="rounded border border-desk-border bg-black/30 px-2 py-0.5 text-[10px] text-white"
          onChange={(e) => onConfigure({ strategy: e.target.value })}
          defaultValue="avellaneda_stoikov"
        >
          <option value="avellaneda_stoikov">Avellaneda-Stoikov</option>
          <option value="symmetric">Symmetric</option>
          <option value="glft">GLFT</option>
        </select>

        <button
          onClick={() => onControl('bookmark', { label: frame?.replay_time_display ?? '' })}
          className="toolbar-btn"
          title="Add bookmark"
        >
          <Bookmark size={11} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max((frame?.total_frames ?? 1) - 1, 0)}
          value={frame?.frame_index ?? 0}
          onChange={(e) => onControl('seek', { index: Number(e.target.value) })}
          className="flex-1 accent-desk-info"
        />
        <span className="w-16 font-mono text-[9px] text-desk-muted">
          {frame ? `${frame.frame_index + 1}/${frame.total_frames}` : '—'}
        </span>
        <span className="w-14 font-mono text-[9px] text-desk-info">{progress.toFixed(0)}%</span>
        <span className="w-24 font-mono text-[9px] text-desk-muted">{frame?.replay_time_display ?? '—'}</span>
        <span className="font-mono text-[9px] text-desk-muted">Evt #{(frame?.frame_index ?? 0) + 1}</span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <input
          type="text"
          placeholder="HH:MM:SS.mmm"
          value={jumpTs}
          onChange={(e) => setJumpTs(e.target.value)}
          className="w-28 rounded border border-desk-border bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white"
        />
        <button onClick={handleJump} className="toolbar-btn text-[10px]">Jump</button>
        {bookmarks.length > 0 && (
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {bookmarks.map((bm, i) => (
              <button
                key={i}
                onClick={() => onControl('seek', { index: bm.index })}
                className="shrink-0 rounded border border-desk-border/50 px-1.5 py-0.5 font-mono text-[9px] text-desk-info hover:bg-desk-info/10"
              >
                {bm.label || `#${bm.index}`}
              </button>
            ))}
          </div>
        )}
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
      className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] transition ${
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