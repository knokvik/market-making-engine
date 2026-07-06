import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GlassPanel } from './ui/GlassPanel'
import { THEME } from '../theme'

const nodes: Node[] = [
  { id: 'feed', position: { x: 0, y: 80 }, data: { label: 'Market Feed' }, style: nodeStyle(THEME.info) },
  { id: 'handler', position: { x: 180, y: 80 }, data: { label: 'Feed Handler' }, style: nodeStyle(THEME.border) },
  { id: 'book', position: { x: 360, y: 80 }, data: { label: 'Order Book' }, style: nodeStyle(THEME.cyan) },
  { id: 'match', position: { x: 540, y: 80 }, data: { label: 'Matching Engine' }, style: nodeStyle(THEME.cyan) },
  { id: 'quote', position: { x: 360, y: 200 }, data: { label: 'A-S Quoting Engine' }, style: nodeStyle(THEME.warn) },
  { id: 'risk', position: { x: 540, y: 200 }, data: { label: 'Risk Manager' }, style: nodeStyle(THEME.loss) },
  { id: 'exec', position: { x: 720, y: 140 }, data: { label: 'Execution Simulator' }, style: nodeStyle(THEME.border) },
  { id: 'analytics', position: { x: 900, y: 140 }, data: { label: 'Analytics Engine' }, style: nodeStyle(THEME.info) },
  { id: 'dash', position: { x: 1080, y: 140 }, data: { label: 'Dashboard' }, style: nodeStyle(THEME.text) },
]

const edges: Edge[] = [
  { id: 'e1', source: 'feed', target: 'handler', animated: true, style: { stroke: THEME.info } },
  { id: 'e2', source: 'handler', target: 'book', animated: true },
  { id: 'e3', source: 'book', target: 'match', animated: true },
  { id: 'e4', source: 'book', target: 'quote' },
  { id: 'e5', source: 'quote', target: 'risk' },
  { id: 'e6', source: 'risk', target: 'exec', animated: true },
  { id: 'e7', source: 'match', target: 'exec' },
  { id: 'e8', source: 'exec', target: 'analytics', animated: true },
  { id: 'e9', source: 'analytics', target: 'dash', animated: true },
]

function nodeStyle(color: string) {
  return {
    background: THEME.panel,
    border: `1px solid ${color}`,
    color: THEME.text,
    borderRadius: 8,
    fontSize: 11,
    padding: '8px 12px',
    boxShadow: `0 0 12px ${color}33`,
  }
}

export function ArchitectureView() {
  return (
    <GlassPanel title="System Architecture" className="h-full">
      <div className="h-[calc(100%-36px)]">
        <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
          <Background color={THEME.border} gap={16} />
          <MiniMap
            nodeColor={THEME.info}
            maskColor="rgba(20,20,20,0.8)"
            style={{ background: THEME.bg }}
          />
          <Controls style={{ background: THEME.panel, border: `1px solid ${THEME.border}` }} />
        </ReactFlow>
      </div>
    </GlassPanel>
  )
}