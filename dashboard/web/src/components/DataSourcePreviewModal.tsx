import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, Play, X } from 'lucide-react'
import type { DataMode, DataSource } from '../types'

export interface DataSourcePreview {
  id: string
  label: string
  exchange: string
  format: string
  description: string
  row_count: number | null
  columns: string[]
  sample_rows: string[][]
  event_types: Record<string, number>
  time_range: { start: number; end: number } | null
  kind?: string
  file_size_kb?: number
  error?: string
}

interface DataSourcePreviewModalProps {
  source: DataSource | null
  mode: DataMode
  open: boolean
  onClose: () => void
  onLoad: (id: string, mode: DataMode) => void
}

export function DataSourcePreviewModal({
  source,
  mode,
  open,
  onClose,
  onLoad,
}: DataSourcePreviewModalProps) {
  const [preview, setPreview] = useState<DataSourcePreview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !source) {
      setPreview(null)
      return
    }
    setLoading(true)
    fetch(`/api/data-sources/preview?id=${encodeURIComponent(source.id)}`)
      .then((r) => r.json())
      .then((data) => setPreview(data))
      .catch(() =>
        setPreview({
          id: source.id,
          label: source.label,
          exchange: source.exchange,
          format: '',
          description: 'Failed to load preview.',
          row_count: null,
          columns: [],
          sample_rows: [],
          event_types: {},
          time_range: null,
          error: 'fetch failed',
        }),
      )
      .finally(() => setLoading(false))
  }, [open, source])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && source && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/75 p-4 py-8 backdrop-blur-sm sm:items-center sm:py-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dataset-preview-title"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel my-auto flex w-full max-w-2xl flex-col overflow-hidden shadow-2xl"
            style={{ maxHeight: 'min(88vh, 720px)' }}
          >
            <header className="shrink-0 flex items-center justify-between border-b border-desk-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-desk-profit" />
                <div>
                  <h2 id="dataset-preview-title" className="text-sm font-semibold text-desk-text">
                    {source.label}
                  </h2>
                  <p className="text-[10px] text-desk-muted">
                    {source.exchange} · {source.format ?? preview?.format ?? '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-desk-border p-1 text-desk-muted hover:text-desk-text"
              >
                <X size={14} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 text-xs">
              {loading && <p className="text-desk-muted">Loading preview…</p>}
              {!loading && preview && (
                <div className="space-y-4">
                  <p className="leading-relaxed text-desk-muted">{preview.description}</p>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {preview.row_count != null && (
                      <StatChip label="Events" value={preview.row_count.toLocaleString()} accent="profit" />
                    )}
                    {preview.file_size_kb != null && (
                      <StatChip label="Size" value={`${preview.file_size_kb} KB`} />
                    )}
                    {preview.time_range && (
                      <StatChip
                        label="Duration"
                        value={`${preview.time_range.start}–${preview.time_range.end}`}
                        accent="info"
                      />
                    )}
                    <StatChip label="Type" value={preview.kind ?? mode} accent="warn" />
                  </div>

                  {Object.keys(preview.event_types).length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-desk-muted">Event mix</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(preview.event_types).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded border border-desk-border bg-desk-bg px-2 py-0.5 text-[10px] text-desk-info"
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {preview.sample_rows.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-desk-muted">Sample rows</p>
                      <div className="max-h-64 overflow-auto rounded border border-desk-border">
                        <table className="w-full min-w-max text-left text-[10px]">
                          <thead className="sticky top-0 z-10 bg-desk-panel">
                            <tr className="border-b border-desk-border text-desk-muted">
                              {preview.columns.map((col) => (
                                <th key={col} className="px-2 py-1 font-semibold uppercase">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.sample_rows.map((row, i) => (
                              <tr key={i} className="border-b border-desk-border/40 text-desk-text">
                                {row.map((cell, j) => (
                                  <td key={j} className="whitespace-nowrap px-2 py-1">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="shrink-0 flex justify-end gap-2 border-t border-desk-border px-4 py-3">
              <button type="button" onClick={onClose} className="toolbar-btn">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onLoad(source.id, mode)
                  onClose()
                }}
                className="toolbar-btn border-desk-profit/40 bg-desk-profit/10 text-desk-profit"
              >
                <Play size={11} /> Load dataset
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'profit' | 'info' | 'warn'
}) {
  const accentClass =
    accent === 'profit'
      ? 'text-desk-profit'
      : accent === 'info'
        ? 'text-desk-info'
        : accent === 'warn'
          ? 'text-desk-warn'
          : 'text-desk-text'
  return (
    <div className="rounded border border-desk-border bg-desk-bg px-2 py-1.5">
      <p className="text-[9px] uppercase text-desk-muted">{label}</p>
      <p className={`text-[11px] font-semibold ${accentClass}`}>{value}</p>
    </div>
  )
}