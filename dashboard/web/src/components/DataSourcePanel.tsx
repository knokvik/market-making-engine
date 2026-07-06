import { DataSourceSelector } from './DataSourceSelector'
import { GlassPanel } from './ui/GlassPanel'
import type { DataMode, DataSource, ReplayFrame } from '../types'
interface DataSourcePanelProps {
  frame: ReplayFrame | null
  sources: { historical: DataSource[]; paper?: DataSource[]; live: DataSource[] }
  mode: DataMode
  onSelect: (id: string, mode: DataMode) => void
}

export function DataSourcePanel({ frame, sources, mode, onSelect }: DataSourcePanelProps) {
  return (
    <GlassPanel title="Data Source Manager" className="h-full">
      <DataSourceSelector
        frame={frame}
        sources={{ historical: sources.historical, paper: sources.paper ?? [], live: sources.live }}
        mode={mode}
        onSelect={onSelect}
      />
    </GlassPanel>
  )
}