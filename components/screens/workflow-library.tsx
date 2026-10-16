"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { getRecord, materialize, versionLabel, type WorkflowBody } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field"
import { toast } from "sonner"
import { Plus, ArrowRight } from "lucide-react"

function statusStyle(status: string) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

export function WorkflowLibrary() {
  const { navigate, catalog, saveWorkflow, createWorkflow } = useStore()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const workflows = catalog.records.filter((record) => record.kind === "workflow").sort((a, b) => a.name.localeCompare(b.name) || a.version - b.version)
  const published = workflows.filter((record) => record.status === "published")
  const [selectedBase, setSelectedBase] = React.useState("none")

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-border bg-card px-6 py-5">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight">Workflow Schemas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A workflow schema assembles published tasks, purposes, prompts, artifact schemas, and custom inserts from the catalog. Context is chosen when the workflow is run, not stored in the schema. Saving a draft adds it to the catalog. A run can pin only a published version.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          New draft
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((record) => {
            const body = materialize<WorkflowBody>(catalog, record)
            const parent = record.forkedFrom ? getRecord(catalog, record.forkedFrom) : undefined
            return (
              <Card key={`${record.id}@${record.version}`} className="gap-0">
                <CardHeader className="gap-1 border-b border-border pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {record.name}
                      <span className="font-mono text-xs text-muted-foreground">{versionLabel(record.version)}</span>
                    </CardTitle>
                    <Badge variant="outline" className={`text-[10px] capitalize ${statusStyle(record.status)}`}>
                      {record.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {parent ? `Forked from ${parent.name} ${versionLabel(parent.version)}. ` : "Base schema. "}
                    {body.nodes.length} nodes. References catalog records only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate("workflow-editor", { id: record.id, version: String(record.version) })}
                  >
                    {record.status === "published" ? "View" : "Configure"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </ScrollArea>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workflow draft</DialogTitle>
            <DialogDescription>
              Name the schema and save an empty draft. You can optionally copy a published schema. Nodes are filled from published catalog records.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Port security planning" />
            </Field>
            <Field>
              <FieldLabel>Start from</FieldLabel>
              <Select
                value={selectedBase}
                items={{
                  none: "Empty schema",
                  ...Object.fromEntries(published.map((record) => [`${record.id}@${record.version}`, `${record.name} ${versionLabel(record.version)}`])),
                }}
                onValueChange={(value) => setSelectedBase(value ?? "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Empty schema</SelectItem>
                    {published.map((record) => (
                      <SelectItem key={`${record.id}@${record.version}`} value={`${record.id}@${record.version}`}>
                        {record.name} {versionLabel(record.version)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>An empty schema does not require a published workflow. A copied schema leaves that version unchanged.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={!name.trim()}
              onClick={() => {
                if (selectedBase === "none") {
                  const saved = createWorkflow(name)
                  setName("")
                  setSelectedBase("none")
                  setCreateOpen(false)
                  toast.success(`${name.trim()} ${versionLabel(saved.version)} saved to the catalog`)
                  navigate("workflow-editor", { id: saved.id, version: String(saved.version) })
                  return
                }
                const [id, version] = selectedBase.split("@")
                const saved = saveWorkflow({ id, version: Number(version) }, { nodes: {} }, name)
                setName("")
                setSelectedBase("none")
                setCreateOpen(false)
                toast.success(`${name.trim()} ${versionLabel(saved.version)} saved to the catalog`)
                navigate("workflow-editor", { id: saved.id, version: String(saved.version) })
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
