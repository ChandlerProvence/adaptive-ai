"use client"

import * as React from "react"
import {
  COA_NODE_ID,
  CONTEXT,
  KIND_LABELS,
  PRECEDENCE_LAYER_LABELS,
  PRECEDENCE_LAYERS,
  createCoaDocument,
  freezeManifest,
  getRecord,
  materialize,
  resolveNode,
  versionLabel,
  type Catalog,
  type CatalogRecord,
  type PrecedenceLayer,
  type WorkflowBody,
} from "@/lib/config"
import { CUSTOM_INSERTS } from "@/lib/mock-data"
import { useStore } from "@/lib/store"
import { CatalogCreateButton, CatalogRecordEditor } from "@/components/screens/catalog-record-editor"
import { InsertLibrary } from "@/components/screens/insert-library"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const ORDER: CatalogRecord["kind"][] = ["workflow", "context", "task", "purpose", "prompt", "artifact_schema", "custom_insert", "llm"]

function statusStyle(status: string) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

function layerOf(provenance: { field: string; layer: PrecedenceLayer }[], field: string) {
  return provenance.find((item) => item.field === field)?.layer
}

export function CatalogScreen() {
  const { catalog, view } = useStore()
  const requested = view.params?.record
  const [kind, setKind] = React.useState<CatalogRecord["kind"]>("workflow")
  const [selectedKey, setSelectedKey] = React.useState(requested ?? "workflow.coa@1")

  React.useEffect(() => {
    if (!requested) return
    const match = catalog.records.find((record) => `${record.id}@${record.version}` === requested)
    if (!match) return
    setKind(match.kind)
    setSelectedKey(requested)
  }, [requested, catalog])

  const rows = catalog.records.filter((record) => record.kind === kind)
  const selected = catalog.records.find((record) => `${record.id}@${record.version}` === selectedKey) ?? rows[0]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuration Catalog</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Versioned configuration objects. Published versions stay immutable. A user modification is the next version and stores only its delta.
        </p>
      </div>
      <Tabs
        value={kind}
        onValueChange={(value) => {
          if (!value) return
          const next = value as CatalogRecord["kind"]
          setKind(next)
          const first = catalog.records.find((record) => record.kind === next)
          if (first) setSelectedKey(`${first.id}@${first.version}`)
        }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b border-border bg-card px-6 py-2">
          <TabsList className="w-max">
            {ORDER.map((item) => (
              <TabsTrigger key={item} value={item} className="gap-1.5">
                {KIND_LABELS[item]}
                <Badge variant="secondary" className="text-[10px]">
                  {catalog.records.filter((record) => record.kind === item).length + (item === "custom_insert" ? CUSTOM_INSERTS.length : 0)}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {kind === "custom_insert" ? (
          <InsertLibrary
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            detail={
              <ScrollArea className="min-h-0 bg-card">
                {selected ? <RecordDetail record={selected} catalog={catalog} onSelect={setSelectedKey} /> : null}
              </ScrollArea>
            }
          />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <ScrollArea className="min-h-0 border-r border-border">
              <div className="p-6">
                {kind === "task" || kind === "purpose" || kind === "prompt" || kind === "artifact_schema" ? (
                  <div className="mb-3 flex justify-end">
                    <CatalogCreateButton kind={kind} onCreated={setSelectedKey} />
                  </div>
                ) : null}
                {ORDER.filter((item) => item !== "custom_insert").map((item) => (
                  <TabsContent key={item} value={item} className="mt-0">
                    <CatalogTable rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} />
                  </TabsContent>
                ))}
              </div>
            </ScrollArea>
            <ScrollArea className="min-h-0 bg-card">
              {selected ? <RecordDetail record={selected} catalog={catalog} onSelect={setSelectedKey} /> : null}
            </ScrollArea>
          </div>
        )}
      </Tabs>
    </div>
  )
}

function CatalogTable({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: CatalogRecord[]
  selectedKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Version</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Forked from</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => {
            const key = `${record.id}@${record.version}`
            return (
              <tr
                key={key}
                onClick={() => onSelect(key)}
                className={cn("cursor-pointer border-b border-border last:border-0", key === selectedKey ? "bg-accent" : "hover:bg-muted/30")}
              >
                <td className="px-4 py-2.5 font-medium">{record.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{versionLabel(record.version)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className={cn("text-[10px] capitalize", statusStyle(record.status))}>
                    {record.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {record.forkedFrom ? versionLabel(record.forkedFrom.version) : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RecordDetail({ record, catalog, onSelect }: { record: CatalogRecord; catalog: Catalog; onSelect: (key: string) => void }) {
  const body = materialize<Record<string, unknown>>(catalog, record)

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <p className="text-xs text-muted-foreground">{KIND_LABELS[record.kind]}</p>
        <h2 className="text-base font-semibold">
          {record.name} <span className="font-mono text-sm text-muted-foreground">{versionLabel(record.version)}</span>
        </h2>
        {record.forkedFrom ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Forked from {versionLabel(record.forkedFrom.version)}. This version stores the delta. {versionLabel(record.forkedFrom.version)} is unchanged.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Base version. Published records are not edited in place.</p>
        )}
      </div>
      <CatalogRecordEditor record={record} catalog={catalog} onSelect={onSelect} />
      {record.overrides ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stored delta</h3>
          <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {JSON.stringify(record.overrides, null, 2)}
          </pre>
        </section>
      ) : null}
      {record.kind === "workflow" ? <WorkflowAssembly catalog={catalog} record={record} /> : <BodySummary body={body} />}
      {record.kind === "workflow" && record.id === "workflow.coa" ? <WorkflowResolution catalog={catalog} version={record.version} /> : null}
      {record.kind === "context" ? (
        <p className="text-xs text-muted-foreground">
          A context profile is the situation. Audience, tone, and evidence requirements are resolved from the purpose profile.
        </p>
      ) : null}
    </div>
  )
}

function refLabel(catalog: Catalog, ref?: { id: string; version: number }) {
  if (!ref) return "Not set"
  const match = catalog.records.find((record) => record.id === ref.id && record.version === ref.version)
  return match ? `${match.name} ${versionLabel(match.version)}` : `${ref.id} ${versionLabel(ref.version)}`
}

function WorkflowAssembly({ catalog, record }: { catalog: Catalog; record: CatalogRecord }) {
  const body = materialize<WorkflowBody>(catalog, record)
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catalog assembly</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        This schema is the saved assembly. Each binding is a catalog record. Context is not part of the schema.
      </p>
      <ul className="flex flex-col gap-3">
        {body.nodes.map((node) => (
          <li key={node.id} className="rounded-md border border-border px-3 py-2">
            <p className="text-sm font-medium">
              {node.title}
              {node.enabled === false ? <span className="ml-2 text-xs text-muted-foreground">Disabled</span> : null}
            </p>
            <dl className="mt-1 grid grid-cols-[8rem_1fr] gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <dt>Phase</dt>
              <dd>{node.parentNodeId ? (body.nodes.find((item) => item.id === node.parentNodeId)?.title ?? node.parentNodeId) : "Top level"}</dd>
              <dt>Dependencies</dt>
              <dd>{node.dependencies?.length ? node.dependencies.join(", ") : "None"}</dd>
              <dt>Phase schema</dt>
              <dd>{node.workflow ? refLabel(catalog, node.workflow) : "None"}</dd>
              <dt>Upstream</dt>
              <dd>{node.upstream?.length ? node.upstream.map((item) => item.nodeId).join(", ") : "None"}</dd>
              <dt>Task</dt>
              <dd>{refLabel(catalog, node.task)}</dd>
              <dt>Purpose</dt>
              <dd>{refLabel(catalog, node.purpose)}</dd>
              <dt>Prompt</dt>
              <dd>{refLabel(catalog, node.prompt)}</dd>
              <dt>Artifact schema</dt>
              <dd>{refLabel(catalog, node.artifactSchema)}</dd>
              <dt>Custom inserts</dt>
              <dd>{node.inserts?.length ? node.inserts.map((item) => refLabel(catalog, item)).join(", ") : "None"}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BodySummary({ body }: { body: Record<string, unknown> }) {
  const entries = Object.entries(body).filter(([, value]) => typeof value !== "object")
  const nested = Object.entries(body).filter(([, value]) => typeof value === "object" && value !== null)
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materialized body</h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[140px_1fr] gap-2">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="font-medium">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {nested.map(([key, value]) => (
        <pre key={key} className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {key}
          {"\n"}
          {JSON.stringify(value, null, 2)}
        </pre>
      ))}
    </section>
  )
}

function WorkflowResolution({ catalog, version }: { catalog: Catalog; version: number }) {
  const resolved = resolveNode({
    catalog,
    workflow: { id: "workflow.coa", version },
    nodeId: COA_NODE_ID,
    context: CONTEXT,
  })
  const manifest = freezeManifest(resolved)
  const context = getRecord(catalog, CONTEXT)
  const pinned = version === 1 ? createCoaDocument().sections.find((section) => section.id === "coa")?.generations[0] : undefined
  const winners = new Map<PrecedenceLayer, string[]>()
  for (const item of resolved.provenance) {
    const list = winners.get(item.layer) ?? []
    list.push(`${item.field}: ${item.display}`)
    winners.set(item.layer, list)
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effective configuration · Course of Action</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Context {context.name} {versionLabel(context.version)} is pinned as the situation. It is not an override layer.
        </p>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        {[
          ["Task", `${resolved.task.id} ${versionLabel(resolved.task.version)}`],
          ["Purpose", `${resolved.purpose.id} ${versionLabel(resolved.purpose.version)}`],
          ["Prompt", `${resolved.prompt.id} ${versionLabel(resolved.prompt.version)}`],
          ["Artifact schema", `${resolved.artifactSchema.id} ${versionLabel(resolved.artifactSchema.version)}`],
          ["Model", `${manifest.model} · temp ${manifest.temperature}`],
          ["Manifest", manifest.id],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {pinned ? (
        <p className="text-xs text-muted-foreground">Generation {pinned.id} is pinned to {pinned.manifestId}.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {PRECEDENCE_LAYERS.map((layer) => {
          const active = winners.has(layer)
          return (
            <div key={layer} className={cn("rounded-md border p-2.5", active ? "border-primary/40 bg-primary/5" : "border-border")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{PRECEDENCE_LAYER_LABELS[layer]}</span>
                {layerOf(resolved.provenance, "prompt") === layer ? (
                  <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                    Prompt
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{active ? winners.get(layer)!.join(" · ") : "No value set"}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
