"use client"

import * as React from "react"
import { ReactFlow, Background, Controls, type Connection, type Edge, type Node, type OnEdgesChange } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { WorkflowNode } from "@/lib/config"

function treeLayout(nodes: WorkflowNode[]): Record<string, { x: number; y: number }> {
  const active = nodes.filter((node) => node.enabled !== false)
  const byParent = new Map<string, WorkflowNode[]>()
  for (const node of active) {
    const parent = node.parentNodeId && active.some((item) => item.id === node.parentNodeId) ? node.parentNodeId : ""
    const list = byParent.get(parent) ?? []
    list.push(node)
    byParent.set(parent, list)
  }
  const positions: Record<string, { x: number; y: number }> = {}
  let row = 0
  function walk(parentId: string, depth: number) {
    for (const node of byParent.get(parentId) ?? []) {
      positions[node.id] = { x: depth * 240, y: row * 96 }
      row += 1
      walk(node.id, depth + 1)
    }
  }
  walk("", 0)
  return positions
}

export function DependencyGraph({
  nodes,
  selectedId,
  onSelect,
  onConnectDependency,
  onRemoveDependency,
}: {
  nodes: WorkflowNode[]
  selectedId: string
  onSelect: (id: string) => void
  onConnectDependency: (source: string, target: string) => void
  onRemoveDependency: (source: string, target: string) => void
}) {
  const [dragged, setDragged] = React.useState<Record<string, { x: number; y: number }>>({})
  const layout = treeLayout(nodes)
  const flowNodes: Node[] = nodes
    .filter((node) => node.enabled !== false)
    .map((node) => ({
      id: node.id,
      position: dragged[node.id] ?? layout[node.id] ?? { x: 0, y: 0 },
      data: { label: node.title },
      selected: node.id === selectedId,
      style: { width: 180, fontSize: 12 },
    }))
  const flowEdges: Edge[] = nodes
    .filter((node) => node.enabled !== false)
    .flatMap((node) =>
      (node.dependencies ?? [])
        .filter((dependency) => flowNodes.some((item) => item.id === dependency))
        .map((dependency) => ({
          id: `${dependency}->${node.id}`,
          source: dependency,
          target: node.id,
        })),
    )

  function onEdgesChange(changes: Parameters<OnEdgesChange>[0]) {
    for (const change of changes) {
      if (change.type !== "remove") continue
      const [source, target] = change.id.split("->")
      if (source && target) onRemoveDependency(source, target)
    }
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    onConnectDependency(connection.source, connection.target)
  }

  return (
    <div className="h-full min-h-0">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDragStop={(_, node) => setDragged((current) => ({ ...current, [node.id]: node.position }))}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
