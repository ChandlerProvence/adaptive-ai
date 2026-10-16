"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import {
  materialize,
  resolveNode,
  validateWorkflow,
  versionLabel,
  workflowNodeDelta,
  type Catalog,
  type CatalogRecord,
  type ResolvedNode,
  type VersionRef,
  type WorkflowBody,
  type WorkflowNode,
} from "@/lib/config"
import { DependencyGraph } from "@/components/workflow/dependency-graph"
import { SchemaOutline } from "@/components/workflow/schema-outline"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Library } from "lucide-react"

function refKey(ref?: VersionRef) {
  return ref ? `${ref.id}@${ref.version}` : ""
}

function parseRef(value: string): VersionRef | undefined {
  if (!value) return undefined
  const [id, version] = value.split("@")
  return { id, version: Number(version) }
}

function recordLabel(records: CatalogRecord[], ref?: VersionRef) {
  if (!ref) return ""
  const match = records.find((record) => record.id === ref.id && record.version === ref.version)
  return match ? `${match.name} ${versionLabel(match.version)}` : `${ref.id} ${versionLabel(ref.version)}`
}

function descendants(nodes: WorkflowNode[], id: string): Set<string> {
  const ids = new Set<string>()
  function walk(parentId: string) {
    for (const node of nodes) {
      if (node.parentNodeId === parentId && node.enabled !== false) {
        ids.add(node.id)
        walk(node.id)
      }
    }
  }
  walk(id)
  return ids
}

function previewCatalog(catalog: Catalog, ref: VersionRef, body: WorkflowBody, nodes: WorkflowNode[]): Catalog {
  return {
    records: catalog.records.map((item) => {
      if (item.id !== ref.id || item.version !== ref.version || item.kind !== "workflow") return item
      return { ...item, forkedFrom: undefined, overrides: undefined, body: { defaults: body.defaults, nodes } }
    }),
  }
}

export function CatalogWorkflowEditor() {
  const { view, navigate, catalog, saveWorkflow, publishWorkflow } = useStore()
  const ref = { id: view.params?.id ?? "", version: Number(view.params?.version ?? "0") }
  const record = catalog.records.find((item) => item.id === ref.id && item.version === ref.version && item.kind === "workflow")
  const body = record ? materialize<WorkflowBody>(catalog, record) : undefined
  const parentBody = record?.forkedFrom ? materialize<WorkflowBody>(catalog, record.forkedFrom) : body
  const [nodes, setNodes] = React.useState<WorkflowNode[]>(() => body?.nodes.map((node) => ({ ...node })) ?? [])
  const [selectedId, setSelectedId] = React.useState(nodes[0]?.id ?? "")
  const [advanced, setAdvanced] = React.useState(false)

  if (!record || !body || !parentBody) {
    return <p className="p-6 text-sm text-muted-foreground">This workflow schema is not in the catalog.</p>
  }

  const schema = record
  const currentBody = body
  const baseBody = parentBody
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes.find((node) => node.enabled !== false) ?? nodes[0]
  const published = record.status === "published"
  const workflows = catalog.records.filter((item) => item.kind === "workflow" && item.status === "published" && item.id !== record.id)
  const tasks = catalog.records.filter((item) => item.kind === "task" && item.status === "published")
  const purposes = catalog.records.filter((item) => item.kind === "purpose" && item.status === "published")
  const prompts = catalog.records.filter((item) => item.kind === "prompt" && item.status === "published")
  const schemas = catalog.records.filter((item) => item.kind === "artifact_schema" && item.status === "published")
  const inserts = catalog.records.filter((item) => item.kind === "custom_insert" && item.status === "published")
  const previewContext = catalog.records.find((item) => item.kind === "context" && item.status === "published")
  const issues = validateWorkflow({ defaults: currentBody.defaults, nodes })
  const dirty = Object.keys(workflowNodeDelta(currentBody.nodes, nodes)).length > 0
  let resolved: ResolvedNode | undefined
  let resolveError = ""
  if (selected && selected.enabled !== false && selected.executable && previewContext) {
    try {
      resolved = resolveNode({
        catalog: previewCatalog(catalog, ref, currentBody, nodes.filter((node) => node.enabled !== false)),
        workflow: ref,
        nodeId: selected.id,
        context: { id: previewContext.id, version: previewContext.version },
      })
    } catch (error) {
      resolveError = error instanceof Error ? error.message : "This node does not resolve yet."
    }
  }

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)))
  }

  function addNode(parentId?: string) {
    const id = `node-${crypto.randomUUID().slice(0, 8)}`
    setNodes((current) => [...current, { id, title: "New section", executable: true, parentNodeId: parentId, dependencies: [], enabled: true }])
    setSelectedId(id)
  }

  function disableNode(id: string) {
    const removed = descendants(nodes, id)
    removed.add(id)
    setNodes((current) =>
      current.map((node) => {
        if (removed.has(node.id)) return { ...node, enabled: false }
        return {
          ...node,
          dependencies: (node.dependencies ?? []).filter((dependency) => !removed.has(dependency)),
          parentNodeId: node.parentNodeId && removed.has(node.parentNodeId) ? undefined : node.parentNodeId,
        }
      }),
    )
  }

  function save() {
    const baseNodes = schema.status === "draft" ? baseBody.nodes : currentBody.nodes
    const saved = saveWorkflow(ref, { nodes: workflowNodeDelta(baseNodes, nodes) })
    toast.success(`${schema.name} ${versionLabel(saved.version)} saved to the catalog`)
    navigate("workflow-editor", { id: saved.id, version: String(saved.version) })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("workflows")}>
          <ArrowLeft data-icon="inline-start" />
          Schemas
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{record.name}</h1>
            <span className="font-mono text-xs text-muted-foreground">{versionLabel(record.version)}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {record.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            The outline is the hierarchy. Graph edges are dependencies and are not saved as positions. Nodes reference published catalog records.
            {published ? " This version is immutable. Save as new version stores the change as the next catalog draft." : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("catalog", { record: `${record.id}@${record.version}` })}>
            <Library data-icon="inline-start" />
            Catalog
          </Button>
          <Button size="sm" variant="outline" onClick={save}>
            {published ? "Save as new version" : "Save draft"}
          </Button>
          {record.status === "draft" ? (
            <Button
              size="sm"
              disabled={dirty || issues.length > 0}
              onClick={() => {
                publishWorkflow(ref)
                toast.success(`${record.name} ${versionLabel(record.version)} published`)
              }}
            >
              Publish
            </Button>
          ) : null}
        </div>
      </div>
      {issues.length ? (
        <ul className="border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {issues.map((issue) => (
            <li key={`${issue.nodeId}:${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_320px]">
        <ScrollArea className="border-r border-border bg-card">
          <SchemaOutline
            nodes={nodes}
            selectedId={selected?.id ?? ""}
            taskLabel={(node) => (node.workflow ? recordLabel(workflows, node.workflow) : recordLabel(tasks, node.task) || "Task not set")}
            purposeLabel={(node) => recordLabel(purposes, node.purpose)}
            onSelect={setSelectedId}
            onAdd={addNode}
            onDisable={disableNode}
            onRestore={(id) => updateNode(id, { enabled: true })}
          />
        </ScrollArea>
        <div className="min-h-0 bg-muted/20">
          <DependencyGraph
            nodes={nodes}
            selectedId={selected?.id ?? ""}
            onSelect={setSelectedId}
            onConnectDependency={(source, target) => {
              const targetNode = nodes.find((node) => node.id === target)
              if (!targetNode || targetNode.dependencies?.includes(source)) return
              updateNode(target, { dependencies: [...(targetNode.dependencies ?? []), source] })
            }}
            onRemoveDependency={(source, target) => {
              const targetNode = nodes.find((node) => node.id === target)
              if (!targetNode) return
              updateNode(target, { dependencies: (targetNode.dependencies ?? []).filter((dependency) => dependency !== source) })
            }}
          />
        </div>
        <ScrollArea className="border-l border-border bg-card">
          {selected ? (
            <NodeInspector
              node={selected}
              nodes={nodes}
              advanced={advanced}
              onAdvanced={setAdvanced}
              workflows={workflows}
              tasks={tasks}
              purposes={purposes}
              prompts={prompts}
              schemas={schemas}
              inserts={inserts}
              resolved={resolved}
              resolveError={resolveError}
              previewContext={previewContext?.name}
              onChange={(patch) => updateNode(selected.id, patch)}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Add a section to start the workflow.</p>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

function NodeInspector({
  node,
  nodes,
  advanced,
  onAdvanced,
  workflows,
  tasks,
  purposes,
  prompts,
  schemas,
  inserts,
  resolved,
  resolveError,
  previewContext,
  onChange,
}: {
  node: WorkflowNode
  nodes: WorkflowNode[]
  advanced: boolean
  onAdvanced: (value: boolean) => void
  workflows: CatalogRecord[]
  tasks: CatalogRecord[]
  purposes: CatalogRecord[]
  prompts: CatalogRecord[]
  schemas: CatalogRecord[]
  inserts: CatalogRecord[]
  resolved?: ResolvedNode
  resolveError: string
  previewContext?: string
  onChange: (patch: Partial<WorkflowNode>) => void
}) {
  const blocked = descendants(nodes, node.id)
  blocked.add(node.id)
  const parents = nodes.filter((item) => item.enabled !== false && !blocked.has(item.id))

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Section</p>
        <input
          value={node.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button size="xs" variant={advanced ? "outline" : "secondary"} onClick={() => onAdvanced(false)}>
          Basic
        </Button>
        <Button size="xs" variant={advanced ? "secondary" : "outline"} onClick={() => onAdvanced(true)}>
          Advanced
        </Button>
      </div>
      {node.workflow ? (
        <RefSelect label="Phase schema" records={workflows} value={refKey(node.workflow)} onChange={(value) => onChange({ workflow: parseRef(value), executable: false })} />
      ) : null}
      <RefSelect label="Purpose" records={purposes} value={refKey(node.purpose)} onChange={(value) => onChange({ purpose: parseRef(value) })} />
      <RefSelect label="Task" records={tasks} value={refKey(node.task)} onChange={(value) => onChange({ task: parseRef(value) })} />
      <RefSelect label="Prompt" records={prompts} value={refKey(node.prompt)} onChange={(value) => onChange({ prompt: parseRef(value) })} />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom inserts</p>
        <div className="flex flex-col gap-1">
          {inserts.map((insert) => {
            const active = node.inserts?.some((item) => item.id === insert.id && item.version === insert.version) ?? false
            return (
              <label key={`${insert.id}@${insert.version}`} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => {
                    const current = node.inserts ?? []
                    const next = active
                      ? current.filter((item) => !(item.id === insert.id && item.version === insert.version))
                      : [...current, { id: insert.id, version: insert.version }]
                    onChange({ inserts: next })
                  }}
                />
                {insert.name} {versionLabel(insert.version)}
              </label>
            )
          })}
        </div>
      </div>
      {advanced ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={node.executable} onChange={(event) => onChange({ executable: event.target.checked })} />
            Executable node
          </label>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parent</p>
            <Select
              value={node.parentNodeId || ""}
              items={{ "": "Top level", ...Object.fromEntries(parents.map((item) => [item.id, item.title])) }}
              onValueChange={(value) => onChange({ parentNodeId: value || "" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="">Top level</SelectItem>
                  {parents.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <RefSelect label="Artifact schema" records={schemas} value={refKey(node.artifactSchema)} onChange={(value) => onChange({ artifactSchema: parseRef(value) })} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</span>
            <input
              value={node.evidenceRequirement ?? ""}
              onChange={(event) => onChange({ evidenceRequirement: event.target.value })}
              className="h-8 rounded-md border border-border bg-background px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail</span>
            <input value={node.detail ?? ""} onChange={(event) => onChange({ detail: event.target.value })} className="h-8 rounded-md border border-border bg-background px-3" />
          </label>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dependencies</p>
            <div className="flex flex-col gap-1">
              {nodes
                .filter((item) => item.id !== node.id && item.enabled !== false)
                .map((item) => {
                  const active = node.dependencies?.includes(item.id) ?? false
                  return (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          const current = node.dependencies ?? []
                          onChange({ dependencies: active ? current.filter((dependency) => dependency !== item.id) : [...current, item.id] })
                        }}
                      />
                      {item.title}
                    </label>
                  )
                })}
            </div>
          </div>
        </>
      ) : null}
      <section className="rounded-md border border-border p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effective configuration</h3>
        {previewContext ? <p className="mt-1 text-[10px] text-muted-foreground">Preview uses context {previewContext}. The schema does not store it.</p> : null}
        {resolved ? (
          <dl className="mt-2 flex flex-col gap-1 text-xs">
            <Row label="Task" value={`${resolved.task.id} ${versionLabel(resolved.task.version)}`} />
            <Row label="Purpose" value={`${resolved.purpose.id} ${versionLabel(resolved.purpose.version)}`} />
            <Row label="Prompt" value={`${resolved.prompt.id} ${versionLabel(resolved.prompt.version)}`} />
            <Row label="Audience" value={resolved.framing.audience} />
            <Row label="Detail" value={resolved.framing.detail} />
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{node.executable ? resolveError || "Assign a published task to resolve this node." : "Grouping nodes pass defaults to their children."}</p>
        )}
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function RefSelect({ label, records, value, onChange }: { label: string; records: CatalogRecord[]; value: string; onChange: (value: string) => void }) {
  const items = Object.fromEntries(records.map((record) => [`${record.id}@${record.version}`, `${record.name} ${versionLabel(record.version)}`]))
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <Select value={value || null} items={items} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Choose a published ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {records.map((record) => (
              <SelectItem key={`${record.id}@${record.version}`} value={`${record.id}@${record.version}`}>
                {record.name} {versionLabel(record.version)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
