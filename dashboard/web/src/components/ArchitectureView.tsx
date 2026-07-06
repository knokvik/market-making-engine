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

const nodes: Node[] = [
  { id: 'feed', position: { x: 0, y: 80 }, data: { label: 'Market Feed' }, style: nodeStyle('#3B9EFF') },
  { id: 'handler', position: { x: 180, y: 80 }, data: { label: 'Feed Handler' }, style: nodeStyle('#1E2430') },
  { id: 'book', position: { x: 360, y: 80 }, data: { label: 'Order Book' }, style: nodeStyle('#00E676') },
  { id: 'match', position: { x: 540, y: 80 }, data: { label: 'Matching Engine' }, style: nodeStyle('#00E676') },
  { id: 'quote', position: { x: 360, y: 200 }, data: { label: 'A-S Quoting Engine' }, style: nodeStyle('#FFB020') },
  { id: 'risk', position: { x: 540, y: 200 }, data: { label: 'Risk Manager' }, style: nodeStyle('#FF3B5C') },
  { id: 'exec', position: { x: 720, y: 140 }, data: { label: 'Execution Simulator' }, style: nodeStyle('#1E2430') },
  { id: 'analytics', position: { x: 900, y: 140 }, data: { label: 'Analytics Engine' }, style: nodeStyle('#3B9EFF') },
  { id: 'dash', position: { x: 1080, y: 140 }, data: { label: 'Dashboard' }, style: nodeStyle('#FFFFFF') },
]

const edges: Edge[] = [
  { id: 'e1', source: 'feed', target: 'handler', animated: true, style: { stroke: '#3B9EFF' } },
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
    background: '#11141A',
    border: `1px solid ${color}`,
    color: '#fff',
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
          <Background color="#1E2430" gap={16} />
          <MiniMap
            nodeColor="#3B9EFF"
            maskColor="rgba(11,13,16,0.8)"
            style={{ background: '#0B0D10' }}
          />
          <Controls style={{ background: '#11141A', border: '1px solid #1E2430' }} />
        </ReactFlow>
      </div>
    </GlassPanel>
  )
}