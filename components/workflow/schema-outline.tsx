"use client"

import type { WorkflowNode } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

export function SchemaOutline({
  nodes,
  selectedId,
  taskLabel,
  purposeLabel,
  onSelect,
  onAdd,
  onDisable,
  onRestore,
}: {
  nodes: WorkflowNode[]
  selectedId: string
  taskLabel: (node: WorkflowNode) => string
  purposeLabel: (node: WorkflowNode) => string
  onSelect: (id: string) => void
  onAdd: (parentId?: string) => void
  onDisable: (id: string) => void
  onRestore: (id: string) => void
}) {
  const active = nodes.filter((node) => node.enabled !== false)
  const disabled = nodes.filter((node) => node.enabled === false)
  const roots = active.filter((node) => !node.parentNodeId || !active.some((item) => item.id === node.parentNodeId))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outline</p>
        <Button size="xs" variant="outline" onClick={() => onAdd(undefined)}>
          <Plus data-icon="inline-start" />
          Section
        </Button>
      </div>
      <ul className="flex flex-col gap-1 p-2">
        {roots.map((node) => (
          <OutlineNode
            key={node.id}
            node={node}
            depth={0}
            nodes={active}
            selectedId={selectedId}
            taskLabel={taskLabel}
            purposeLabel={purposeLabel}
            onSelect={onSelect}
            onAdd={onAdd}
            onDisable={onDisable}
          />
        ))}
      </ul>
      {disabled.length ? (
        <div className="mt-auto border-t border-border p-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Disabled</p>
          {disabled.map((node) => (
            <button key={node.id} onClick={() => onRestore(node.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent/50">
              <span>{node.title}</span>
              <span className="text-[10px]">Restore</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function OutlineNode({
  node,
  depth,
  nodes,
  selectedId,
  taskLabel,
  purposeLabel,
  onSelect,
  onAdd,
  onDisable,
}: {
  node: WorkflowNode
  depth: number
  nodes: WorkflowNode[]
  selectedId: string
  taskLabel: (node: WorkflowNode) => string
  purposeLabel: (node: WorkflowNode) => string
  onSelect: (id: string) => void
  onAdd: (parentId?: string) => void
  onDisable: (id: string) => void
}) {
  const children = nodes.filter((item) => item.parentNodeId === node.id)
  return (
    <li>
      <div className={cn("rounded-md", node.id === selectedId ? "bg-accent" : "hover:bg-accent/50")} style={{ marginLeft: depth * 12 }}>
        <button onClick={() => onSelect(node.id)} className="flex w-full flex-col px-3 py-2 text-left">
          <span className="text-sm font-medium">{node.title}</span>
          <span className="text-[10px] text-muted-foreground">
            {node.executable ? taskLabel(node) : "Grouping node"}
            {purposeLabel(node) ? ` · ${purposeLabel(node)}` : ""}
          </span>
        </button>
        <div className="flex gap-1 px-3 pb-2">
          <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onAdd(node.id)}>
            Add child
          </button>
          <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onDisable(node.id)}>
            Disable
          </button>
        </div>
      </div>
      {children.length ? (
        <ul>
          {children.map((child) => (
            <OutlineNode
              key={child.id}
              node={child}
              depth={depth + 1}
              nodes={nodes}
              selectedId={selectedId}
              taskLabel={taskLabel}
              purposeLabel={purposeLabel}
              onSelect={onSelect}
              onAdd={onAdd}
              onDisable={onDisable}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
