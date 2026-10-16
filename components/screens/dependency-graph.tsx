"use client"

import * as React from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Badge } from "@/components/ui/badge"
import { StatusDot } from "@/components/status-badge"
import type { SectionState } from "@/lib/mock-data"

type NodeData = {
  label: string
  version: string
  state: SectionState
  kind: "source" | "section"
}

const stateBorder: Record<SectionState, string> = {
  Current: "border-emerald-300",
  "Working Changes": "border-blue-300",
  "Change Set Open": "border-violet-300",
  "Potentially Stale": "border-amber-400",
}

function GraphNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <div
      className={`w-52 rounded-md border-2 bg-card px-3 py-2 shadow-sm ${stateBorder[data.state]}`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-border !bg-muted-foreground" />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{data.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{data.version}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <StatusDot state={data.state} />
        <span className="text-[11px] text-muted-foreground">{data.state}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-border !bg-muted-foreground" />
    </div>
  )
}

const nodeTypes = { graphNode: GraphNode }

const nodes: Node<NodeData>[] = [
  { id: "src-market", position: { x: 0, y: 40 }, type: "graphNode", data: { label: "Market Research Brief", version: "V2", state: "Current", kind: "source" } },
  { id: "src-financial", position: { x: 0, y: 160 }, type: "graphNode", data: { label: "Financial Model", version: "V5", state: "Current", kind: "source" } },
  { id: "src-constraints", position: { x: 0, y: 280 }, type: "graphNode", data: { label: "Constraints", version: "V9", state: "Change Set Open", kind: "source" } },

  { id: "sec-narrative", position: { x: 300, y: 40 }, type: "graphNode", data: { label: "Narrative Assessment", version: "V6", state: "Change Set Open", kind: "section" } },
  { id: "sec-alternatives", position: { x: 300, y: 160 }, type: "graphNode", data: { label: "Alternatives", version: "V4", state: "Potentially Stale", kind: "section" } },
  { id: "sec-risk", position: { x: 300, y: 280 }, type: "graphNode", data: { label: "Risk Assessment", version: "V5", state: "Potentially Stale", kind: "section" } },

  { id: "sec-recommendation", position: { x: 600, y: 100 }, type: "graphNode", data: { label: "Recommendation", version: "V7", state: "Potentially Stale", kind: "section" } },
  { id: "sec-exec", position: { x: 880, y: 100 }, type: "graphNode", data: { label: "Executive Summary", version: "V3", state: "Current", kind: "section" } },
]

function edge(source: string, target: string, stale = false): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    animated: stale,
    style: { stroke: stale ? "oklch(0.75 0.15 75)" : "oklch(0.7 0.02 260)", strokeWidth: stale ? 2 : 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: stale ? "oklch(0.75 0.15 75)" : "oklch(0.7 0.02 260)" },
  }
}

const edges: Edge[] = [
  edge("src-market", "sec-narrative"),
  edge("src-financial", "sec-alternatives"),
  edge("src-constraints", "sec-alternatives", true),
  edge("src-constraints", "sec-risk", true),
  edge("sec-narrative", "sec-recommendation", true),
  edge("sec-alternatives", "sec-recommendation", true),
  edge("sec-risk", "sec-recommendation", true),
  edge("sec-recommendation", "sec-exec"),
]

export function DependencyGraph() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-border bg-card px-6 py-5">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight">Dependency Graph</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The traceable lineage from sources through generated sections. Highlighted edges show where a change to
            Constraints V9 propagates staleness downstream toward the Recommendation.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3 text-xs">
          <div className="flex items-center gap-2">
            <StatusDot state="Current" /> Current
          </div>
          <div className="flex items-center gap-2">
            <StatusDot state="Change Set Open" /> Change Set open
          </div>
          <div className="flex items-center gap-2">
            <StatusDot state="Potentially Stale" /> Potentially stale
          </div>
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-1.5">
            <span className="h-0.5 w-5 rounded" style={{ backgroundColor: "oklch(0.75 0.15 75)" }} /> Stale propagation
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          className="bg-muted/20"
        >
          <Background color="oklch(0.85 0.01 260)" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
