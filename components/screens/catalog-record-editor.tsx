"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  materialize,
  versionLabel,
  type Catalog,
  type CatalogDraftKind,
  type CatalogKind,
  type CatalogRecord,
  type VersionRef,
} from "@/lib/config"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"

type FieldKind = "text" | "multiline" | "lines" | "number" | "select" | "ref"

interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  options?: { value: string; label: string }[]
  catalogKind?: CatalogKind
}

const CONTEXT_TYPES = ["mission", "customer", "project", "system", "incident", "research", "opportunity"]
const INSERT_CATEGORIES = ["analysis", "comparison", "validation", "enhancement", "transformation"]
const INSERT_MODES = ["pre", "in", "post"]

const FIELDS: Partial<Record<CatalogKind, FieldSpec[]>> = {
  context: [
    { key: "contextType", label: "Type", kind: "select", options: CONTEXT_TYPES.map((value) => ({ value, label: value })) },
    { key: "statement", label: "Statement", kind: "multiline" },
    { key: "organization", label: "Organization", kind: "multiline" },
    { key: "standingGuidance", label: "Standing guidance", kind: "multiline" },
    { key: "evidenceStandard", label: "Evidence standard", kind: "multiline" },
    { key: "areaOfInterest", label: "Area of interest", kind: "text" },
    { key: "areaOfResponsibility", label: "Area of responsibility", kind: "text" },
    { key: "timeWindow", label: "Time window", kind: "text" },
    { key: "knownConstraints", label: "Known constraints", kind: "lines" },
  ],
  task: [
    { key: "summary", label: "Summary", kind: "multiline" },
    { key: "prompt", label: "Prompt", kind: "ref", catalogKind: "prompt" },
    { key: "artifactSchema", label: "Artifact schema", kind: "ref", catalogKind: "artifact_schema" },
    { key: "llm", label: "LLM", kind: "ref", catalogKind: "llm" },
    { key: "requiredInputs", label: "Required inputs", kind: "lines" },
  ],
  purpose: [
    { key: "summary", label: "Summary", kind: "multiline" },
    { key: "audience", label: "Audience", kind: "multiline" },
    { key: "tone", label: "Tone", kind: "text" },
    { key: "evidenceRequirement", label: "Evidence requirement", kind: "multiline" },
    { key: "riskTolerance", label: "Risk tolerance", kind: "multiline" },
    { key: "detail", label: "Detail", kind: "multiline" },
  ],
  prompt: [
    { key: "role", label: "Role", kind: "multiline" },
    { key: "objective", label: "Objective", kind: "multiline" },
    { key: "instructions", label: "Instructions", kind: "multiline" },
    { key: "constraints", label: "Constraints", kind: "multiline" },
    { key: "output", label: "Output", kind: "multiline" },
  ],
  artifact_schema: [
    { key: "summary", label: "Summary", kind: "multiline" },
    { key: "requiredSections", label: "Required sections", kind: "lines" },
  ],
  custom_insert: [
    { key: "summary", label: "Summary", kind: "multiline" },
    { key: "category", label: "Category", kind: "select", options: INSERT_CATEGORIES.map((value) => ({ value, label: value })) },
    { key: "executionMode", label: "Execution", kind: "select", options: INSERT_MODES.map((value) => ({ value, label: value })) },
    { key: "prompt", label: "Prompt", kind: "ref", catalogKind: "prompt" },
    { key: "artifactSchema", label: "Artifact schema", kind: "ref", catalogKind: "artifact_schema" },
  ],
  llm: [
    { key: "provider", label: "Provider", kind: "text" },
    { key: "baseUrl", label: "Base URL", kind: "text" },
    { key: "apiKeyEnv", label: "API key environment variable", kind: "text" },
    { key: "apiKeyHeader", label: "API key header", kind: "text" },
    { key: "model", label: "Model", kind: "text" },
    { key: "temperature", label: "Temperature", kind: "number" },
    { key: "embeddingModel", label: "Embedding model", kind: "text" },
  ],
}

function refKey(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const ref = value as Partial<VersionRef>
  if (!ref.id || typeof ref.version !== "number") return ""
  return `${ref.id}@${ref.version}`
}

function parseRef(value: string): VersionRef | undefined {
  const [id, version] = value.split("@")
  if (!id || version === undefined) return undefined
  return { id, version: Number(version) }
}

export function CatalogRecordEditor({
  record,
  catalog,
  onSelect,
}: {
  record: CatalogRecord
  catalog: Catalog
  onSelect: (key: string) => void
}) {
  const { navigate, saveCatalogRecord, publishWorkflow } = useStore()
  const savedBody = materialize<Record<string, unknown>>(catalog, record)
  const [name, setName] = React.useState(record.name)
  const [body, setBody] = React.useState(savedBody)
  const fields = FIELDS[record.kind] ?? []

  React.useEffect(() => {
    setName(record.name)
    setBody(materialize<Record<string, unknown>>(catalog, record))
  }, [catalog, record])

  if (record.kind === "workflow") {
    return (
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate("workflow-editor", { id: record.id, version: String(record.version) })}
        >
          Edit schema
        </Button>
        <p className="text-xs text-muted-foreground">
          Saving a published workflow creates the next draft and stores only the node delta. Publishing freezes that draft.
        </p>
      </div>
    )
  }

  const dirty = name !== record.name || JSON.stringify(body) !== JSON.stringify(savedBody)
  const locked = record.status === "deprecated"

  function update(key: string, value: unknown) {
    setBody((current) => ({ ...current, [key]: value }))
  }

  function save() {
    try {
      const nextBody = { ...body }
      for (const field of fields) {
        if (field.kind === "lines" && Array.isArray(nextBody[field.key])) {
          nextBody[field.key] = (nextBody[field.key] as string[]).map((line) => line.trim()).filter(Boolean)
        }
      }
      const saved = saveCatalogRecord(record, { name, body: nextBody })
      onSelect(`${saved.id}@${saved.version}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The catalog record was not saved.")
    }
  }

  function publish() {
    publishWorkflow(record)
    toast.success(`${name} ${versionLabel(record.version)} published`, {
      description: "This version is now immutable. A later edit creates the next version.",
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit</h3>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Name
        <Input value={name} disabled={locked} onChange={(event) => setName(event.target.value)} />
      </label>
      {fields.map((field) => (
        <FieldControl key={field.key} field={field} catalog={catalog} value={body[field.key]} disabled={locked} onChange={(value) => update(field.key, value)} />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={locked || !dirty} onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="outline" disabled={locked || record.status !== "draft" || dirty} onClick={publish}>
          Publish
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {record.status === "published"
          ? "Save creates the next draft. This published version stays unchanged, and the draft stores only the delta."
          : record.status === "draft"
            ? "Save updates this draft. Publish freezes it. A published version cannot be edited in place."
            : "Deprecated versions cannot be edited."}
      </p>
    </section>
  )
}

function FieldControl({
  field,
  catalog,
  value,
  disabled,
  onChange,
  publishedOnly = false,
  clearable = false,
}: {
  field: FieldSpec
  catalog: Catalog
  value: unknown
  disabled: boolean
  onChange: (value: unknown) => void
  publishedOnly?: boolean
  clearable?: boolean
}) {
  if (field.kind === "lines") {
    const text = Array.isArray(value) ? value.map(String).join("\n") : ""
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <Textarea
          value={text}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.split("\n"))}
        />
      </label>
    )
  }
  if (field.kind === "multiline") {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <Textarea value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
    )
  }
  if (field.kind === "number") {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <Input
          type="number"
          step="0.1"
          value={typeof value === "number" ? value : 0}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    )
  }
  if (field.kind === "select") {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <Select value={typeof value === "string" ? value : null} disabled={disabled} onValueChange={(next) => onChange(next ?? "")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
    )
  }
  if (field.kind === "ref" && field.catalogKind) {
    const selected = refKey(value)
    const options = catalog.records.filter((item) => item.kind === field.catalogKind && (!publishedOnly || item.status === "published"))
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {field.label}
        <Select value={selected || (clearable ? "none" : null)} disabled={disabled} onValueChange={(next) => onChange(next && next !== "none" ? parseRef(next) : undefined)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {clearable ? <SelectItem value="none">None</SelectItem> : null}
              {options.map((option) => (
                <SelectItem key={`${option.id}@${option.version}`} value={`${option.id}@${option.version}`}>
                  {option.name} {versionLabel(option.version)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
    )
  }
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {field.label}
      <Input value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

const CREATE_LABEL: Record<CatalogDraftKind, string> = {
  task: "task",
  purpose: "purpose",
  prompt: "prompt",
  artifact_schema: "artifact schema",
}

function emptyDraft(kind: CatalogDraftKind): Record<string, unknown> {
  if (kind === "task") return { summary: "", requiredInputs: [] }
  if (kind === "purpose") return { summary: "", audience: "", tone: "", evidenceRequirement: "", riskTolerance: "", detail: "" }
  if (kind === "prompt") return { role: "", objective: "", instructions: "", constraints: "", output: "" }
  return { summary: "", requiredSections: [] }
}

function draftReady(kind: CatalogDraftKind, name: string, body: Record<string, unknown>) {
  const key = kind === "prompt" ? "instructions" : "summary"
  const value = body[key]
  return name.trim().length > 0 && typeof value === "string" && value.trim().length > 0
}

export function CatalogCreateButton({ kind, onCreated }: { kind: CatalogKind; onCreated: (key: string) => void }) {
  const { catalog, createCatalogRecord, navigate } = useStore()
  const draftKind = kind === "task" || kind === "purpose" || kind === "prompt" || kind === "artifact_schema" ? kind : null
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [body, setBody] = React.useState<Record<string, unknown>>({})
  if (!draftKind) return null
  const fields = FIELDS[draftKind] ?? []
  const label = CREATE_LABEL[draftKind]

  function reset() {
    setName("")
    setBody(emptyDraft(draftKind!))
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        New {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {label}</DialogTitle>
            <DialogDescription>Save a draft. Publish it before a workflow node can use it.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Name
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            {fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                catalog={catalog}
                value={body[field.key]}
                disabled={false}
                publishedOnly
                clearable={field.kind === "ref"}
                onChange={(value) => setBody((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={!draftReady(draftKind, name, body)}
              onClick={() => {
                try {
                  const saved = createCatalogRecord(draftKind, { name, body })
                  const key = `${saved.id}@${saved.version}`
                  setOpen(false)
                  toast.success(`${name.trim()} ${versionLabel(saved.version)} saved to the catalog`)
                  onCreated(key)
                  navigate("catalog", { record: key })
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "The record was not created.")
                }
              }}
            >
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
