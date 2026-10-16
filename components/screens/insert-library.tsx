"use client"

import * as React from "react"
import { materialize, versionLabel, type InsertBody, type VersionRef } from "@/lib/config"
import { useStore } from "@/lib/store"
import { CUSTOM_INSERTS, INSERT_CATEGORIES, type CustomInsert, type ExecutionMode } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { Plus, ArrowRightLeft, Boxes } from "lucide-react"
import { toast } from "sonner"

const INSERT_BODY_CATEGORIES: InsertBody["category"][] = ["analysis", "comparison", "validation", "enhancement", "transformation"]
const INSERT_BODY_MODES: { value: InsertBody["executionMode"]; label: string }[] = [
  { value: "pre", label: "Before generation" },
  { value: "in", label: "During generation" },
  { value: "post", label: "After generation" },
]

function statusStyle(status: string) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

function parseRef(value: string): VersionRef | undefined {
  if (!value || value === "none") return undefined
  const [id, version] = value.split("@")
  return { id, version: Number(version) }
}

const MODES: ExecutionMode[] = ["Pre-Generation", "In-Generation", "Post-Generation"]

const modeStyle: Record<ExecutionMode, string> = {
  "Pre-Generation": "border-sky-200 bg-sky-50 text-sky-700",
  "In-Generation": "border-violet-200 bg-violet-50 text-violet-700",
  "Post-Generation": "border-emerald-200 bg-emerald-50 text-emerald-700",
}

function InsertCard({ insert, onOpen }: { insert: CustomInsert; onOpen: () => void }) {
  return (
    <Card className="cursor-pointer gap-0 transition-shadow hover:shadow-sm" onClick={onOpen}>
      <CardHeader className="gap-1.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {insert.name}
            <span className="font-mono text-xs text-muted-foreground">{insert.version}</span>
          </CardTitle>
          <Badge variant="outline" className={`shrink-0 text-[10px] ${modeStyle[insert.executionMode]}`}>
            {insert.executionMode}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{insert.purpose}</p>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            Inputs: <span className="text-foreground">{insert.inputSummary}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <ArrowRightLeft className="size-3" />
            {insert.output}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function InsertLibrary({
  selectedKey,
  onSelect,
  detail,
}: {
  selectedKey: string
  onSelect: (key: string) => void
  detail: React.ReactNode
}) {
  const { catalog, createInsert, navigate } = useStore()
  const catalogInserts = catalog.records.filter((record) => record.kind === "custom_insert")
  const prompts = catalog.records.filter((record) => record.kind === "prompt" && record.status === "published")
  const schemas = catalog.records.filter((record) => record.kind === "artifact_schema" && record.status === "published")
  const [category, setCategory] = React.useState<string>("all")
  const [mode, setMode] = React.useState<string>("all")
  const [active, setActive] = React.useState<CustomInsert | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [summary, setSummary] = React.useState("")
  const [insertCategory, setInsertCategory] = React.useState<InsertBody["category"]>("analysis")
  const [executionMode, setExecutionMode] = React.useState<InsertBody["executionMode"]>("in")
  const [prompt, setPrompt] = React.useState("none")
  const [artifactSchema, setArtifactSchema] = React.useState("none")

  const filtered = CUSTOM_INSERTS.filter(
    (i) => (category === "all" || i.category === category) && (mode === "all" || i.executionMode === mode),
  )

  const grouped = INSERT_CATEGORIES.filter((cat) => category === "all" || cat === category)
    .map((cat) => ({
      cat,
      records: catalogInserts.filter((record) => {
        const body = materialize<InsertBody>(catalog, record)
        const wanted = mode === "Pre-Generation" ? "pre" : mode === "Post-Generation" ? "post" : mode === "In-Generation" ? "in" : null
        return body.category === cat.toLowerCase() && (wanted === null || body.executionMode === wanted)
      }),
      items: filtered.filter((item) => item.category === cat),
    }))
    .filter((group) => group.records.length > 0 || group.items.length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Reusable analytical modules that can be attached to any workflow node — analysis, comparison, validation,
          enhancement, and transformation. Each declares its inputs, output artifact, and execution timing.
        </p>
        <Button size="sm" className="shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          New Insert
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Category</span>
          <ToggleGroup value={[category]} onValueChange={(v) => setCategory(v[0] ?? "all")} spacing={2}>
            <ToggleGroupItem value="all" className="text-xs">
              All
            </ToggleGroupItem>
            {INSERT_CATEGORIES.map((c) => (
              <ToggleGroupItem key={c} value={c} className="text-xs">
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Timing</span>
          <ToggleGroup value={[mode]} onValueChange={(v) => setMode(v[0] ?? "all")} spacing={2}>
            <ToggleGroupItem value="all" className="text-xs">
              All
            </ToggleGroupItem>
            {MODES.map((m) => (
              <ToggleGroupItem key={m} value={m} className="text-xs">
                {m}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <ScrollArea className="min-h-0 border-r border-border">
          <div className="flex flex-col gap-6 p-6">
            {grouped.map(({ cat, records, items }) => (
              <section key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <Boxes className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{cat}</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {records.length + items.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {records.map((record) => {
                    const body = materialize<InsertBody>(catalog, record)
                    const key = `${record.id}@${record.version}`
                    return (
                      <Card
                        key={key}
                        className={`cursor-pointer gap-0 transition-shadow hover:shadow-sm ${key === selectedKey ? "ring-2 ring-primary" : ""}`}
                        onClick={() => onSelect(key)}
                      >
                        <CardHeader className="gap-1.5 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              {record.name}
                              <span className="font-mono text-xs text-muted-foreground">{versionLabel(record.version)}</span>
                            </CardTitle>
                            <Badge variant="outline" className={`shrink-0 text-[10px] capitalize ${statusStyle(record.status)}`}>
                              {record.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="line-clamp-3 text-xs leading-snug text-muted-foreground">{body.summary}</p>
                          <p className="mt-2 text-[11px] capitalize text-muted-foreground">
                            {body.category} · {body.executionMode}-generation
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {items.map((item) => (
                    <InsertCard key={item.id} insert={item} onOpen={() => setActive(item)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
        {detail}
      </div>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          {active && (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle className="flex items-center gap-2">
                  {active.name}
                  <span className="font-mono text-sm text-muted-foreground">{active.version}</span>
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className={`text-[10px] ${modeStyle[active.executionMode]}`}>
                    {active.executionMode}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {active.category}
                  </Badge>
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-5 p-6">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose</p>
                    <p className="text-sm">{active.purpose}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Required Inputs
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(active.requiredInputs ?? ["Primary input"]).map((r) => (
                        <Badge key={r} variant="secondary" className="font-normal">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {active.optionalInputs && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Optional Inputs
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {active.optionalInputs.map((r) => (
                          <Badge key={r} variant="outline" className="font-normal">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Output Artifact
                    </p>
                    <p className="text-sm font-medium">{active.output}</p>
                  </div>
                  {active.artifactSchema && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Artifact Schema
                      </p>
                      <p className="text-sm font-medium">{active.artifactSchema}</p>
                    </div>
                  )}
                  {active.prompt && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Prompt Reference
                      </p>
                      <p className="text-sm font-medium">{active.prompt}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <SheetFooter className="border-t border-border">
                <Button onClick={() => toast.success(`${active.name} attached to node (illustrative).`)}>
                  <Plus data-icon="inline-start" />
                  Attach to Node
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New custom insert</DialogTitle>
            <DialogDescription>
              Save a draft insert. Publish it from the catalog before a workflow node can use it.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Assumption check" />
            </Field>
            <Field>
              <FieldLabel>Summary</FieldLabel>
              <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What this insert adds to a node." />
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select
                value={insertCategory}
                items={Object.fromEntries(INSERT_BODY_CATEGORIES.map((value) => [value, value]))}
                onValueChange={(value) => setInsertCategory((value as InsertBody["category"]) ?? "analysis")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {INSERT_BODY_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Execution</FieldLabel>
              <Select
                value={executionMode}
                items={Object.fromEntries(INSERT_BODY_MODES.map((item) => [item.value, item.label]))}
                onValueChange={(value) => setExecutionMode((value as InsertBody["executionMode"]) ?? "in")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {INSERT_BODY_MODES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Prompt</FieldLabel>
              <Select
                value={prompt}
                items={{ none: "None", ...Object.fromEntries(prompts.map((record) => [`${record.id}@${record.version}`, `${record.name} ${versionLabel(record.version)}`])) }}
                onValueChange={(value) => setPrompt(value ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">None</SelectItem>
                    {prompts.map((record) => (
                      <SelectItem key={`${record.id}@${record.version}`} value={`${record.id}@${record.version}`}>
                        {record.name} {versionLabel(record.version)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Artifact schema</FieldLabel>
              <Select
                value={artifactSchema}
                items={{ none: "None", ...Object.fromEntries(schemas.map((record) => [`${record.id}@${record.version}`, `${record.name} ${versionLabel(record.version)}`])) }}
                onValueChange={(value) => setArtifactSchema(value ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">None</SelectItem>
                    {schemas.map((record) => (
                      <SelectItem key={`${record.id}@${record.version}`} value={`${record.id}@${record.version}`}>
                        {record.name} {versionLabel(record.version)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={!name.trim() || !summary.trim()}
              onClick={() => {
                try {
                  const saved = createInsert({
                    name,
                    summary,
                    category: insertCategory,
                    executionMode,
                    prompt: parseRef(prompt),
                    artifactSchema: parseRef(artifactSchema),
                  })
                  const savedName = name.trim()
                  setName("")
                  setSummary("")
                  setInsertCategory("analysis")
                  setExecutionMode("in")
                  setPrompt("none")
                  setArtifactSchema("none")
                  setCreateOpen(false)
                  toast.success(`${savedName} ${versionLabel(saved.version)} saved to the catalog`)
                  const key = `${saved.id}@${saved.version}`
                  onSelect(key)
                  navigate("catalog", { record: key })
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "The insert was not created.")
                }
              }}
            >
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
