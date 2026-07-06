import { useState } from 'react'
import { Eye, FileSpreadsheet, Radio, ScrollText } from 'lucide-react'
import { DataSourcePreviewModal } from './DataSourcePreviewModal'
import type { DataMode, DataSource, ReplayFrame } from '../types'

interface DataSourceSelectorProps {
  frame: ReplayFrame | null
  sources: { historical: DataSource[]; paper: DataSource[]; live: DataSource[] }
  mode: DataMode
  onSelect: (id: string, mode: DataMode) => void
  compact?: boolean
}

export function DataSourceSelector({
  frame,
  sources,
  mode,
  onSelect,
  compact,
}: DataSourceSelectorProps) {
  const list =
    mode === 'replay' ? sources.historical : mode === 'paper' ? sources.paper : sources.live
  const progress = frame?.progress_pct ?? 0
  const filled = Math.round(progress / 10)
  const [previewSource, setPreviewSource] = useState<DataSource | null>(null)

  const sectionIcon =
    mode === 'replay' ? <FileSpreadsheet size={11} /> : mode === 'paper' ? <ScrollText size={11} /> : <Radio size={11} />
  const sectionLabel =
    mode === 'replay' ? 'Historical Datasets' : mode === 'paper' ? 'Paper Feeds' : 'Live Exchanges'

  return (
    <>
      <div className={compact ? 'space-y-2 text-xs' : 'flex h-full min-h-0 flex-col gap-2 p-2 text-xs'}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-desk-border/30 pb-2">
          <StatusChip label="Exchange" value={frame?.exchange ?? '—'} />
          <StatusChip
            label="Connection"
            value={
              frame?.live_mode
                ? frame.live_connected
                  ? 'Connected'
                  : 'Disconnected'
                : frame?.feed_type === 'paper_trading'
                  ? 'Paper Sim'
                  : 'Replay'
            }
            tone={
              frame?.live_mode
                ? frame.live_connected
                  ? 'profit'
                  : 'loss'
                : 'info'
            }
          />
          <StatusChip label="Dataset" value={frame?.dataset_name ?? '—'} accent />
          {mode === 'replay' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-desk-muted">Progress</span>
              <span className="text-desk-profit">{'█'.repeat(filled)}{'░'.repeat(10 - filled)}</span>
              <span className="text-desk-muted">{progress.toFixed(0)}%</span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <Section icon={sectionIcon} label={sectionLabel}>
            <div className={compact ? 'space-y-0.5' : 'grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4'}>
              {list.map((s) => (
                <SourceButton
                  key={s.id}
                  source={s}
                  active={
                    mode === 'live'
                      ? frame?.live_mode && frame?.exchange === s.exchange
                      : mode === 'paper'
                        ? frame?.feed_type === 'paper_trading' && frame?.exchange === s.exchange
                        : frame?.dataset_name === s.label || frame?.exchange === s.exchange
                  }
                  onPreview={() => setPreviewSource(s)}
                />
              ))}
            </div>
          </Section>
          <p className="mt-1 px-1 text-[9px] text-desk-muted">Click a dataset to preview</p>
        </div>
      </div>

      <DataSourcePreviewModal
        source={previewSource}
        mode={mode}
        open={previewSource !== null}
        onClose={() => setPreviewSource(null)}
        onLoad={onSelect}
      />
    </>
  )
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-desk-info">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}

function SourceButton({
  source,
  active,
  onPreview,
}: {
  source: DataSource
  active?: boolean
  onPreview: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className={`group flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-[10px] transition ${
        active
          ? 'border-desk-profit/40 bg-desk-profit/10 text-desk-profit'
          : 'border-desk-border/40 text-desk-muted hover:border-desk-info/30 hover:bg-desk-panel-hover hover:text-desk-text'
      }`}
    >
      <span className="truncate">
        {source.label}
        {source.format && <span className="ml-1 text-[8px] uppercase text-desk-muted">{source.format}</span>}
      </span>
      <Eye size={11} className="shrink-0 opacity-0 transition group-hover:opacity-100 text-desk-info" />
    </button>
  )
}

function StatusChip({
  label,
  value,
  tone,
  accent,
}: {
  label: string
  value: string
  tone?: 'profit' | 'loss' | 'info'
  accent?: boolean
}) {
  const toneClass =
    tone === 'profit'
      ? 'text-desk-profit'
      : tone === 'loss'
        ? 'text-desk-loss'
        : tone === 'info'
          ? 'text-desk-info'
          : accent
            ? 'text-desk-profit'
            : 'text-desk-text'
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase text-desk-muted">{label}</span>
      <span className={`text-[10px] ${toneClass}`}>{value}</span>
    </div>
  )
}