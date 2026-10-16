"use client"

import * as React from "react"
import { useStore, type SchemaLifecycle } from "@/lib/store"
import type { WorkflowNodeConfig } from "@/lib/mock-data"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Check, ShieldCheck, UploadCloud, GitBranchPlus, TriangleAlert } from "lucide-react"
import { PRECEDENCE_LAYER_LABELS, PRECEDENCE_LAYERS } from "@/lib/config"
import { cn } from "@/lib/utils"

const STAGES: SchemaLifecycle[] = ["Draft", "Validated", "Published", "Deprecated"]

function executionPlan(sections: WorkflowNodeConfig[]) {
  const titles = new Set(sections.map((s) => s.title))
  const remaining = new Map(
    sections.map((s) => [s.title, s.dependencies.map((d) => d.name).filter((n) => titles.has(n) && n !== s.title)]),
  )
  const stages: string[][] = []
  const done = new Set<string>()
  while (remaining.size) {
    const ready = [...remaining].filter(([, deps]) => deps.every((d) => done.has(d))).map(([t]) => t)
    if (!ready.length) {
      stages.push([...remaining.keys()].map((t) => `${t} (cycle)`))
      break
    }
    ready.forEach((t) => {
      done.add(t)
      remaining.delete(t)
    })
    stages.push(ready)
  }
  return stages
}

function precedenceTrace(section: WorkflowNodeConfig) {
  const custom = section.prompt !== section.basePrompt
  return PRECEDENCE_LAYERS.map((layer) => {
    const value =
      layer === "system_defaults"
        ? "Analytical, neutral · standard detail"
        : layer === "workflow_defaults"
          ? section.basePrompt
          : layer === "parent_node"
            ? section.inheritedSettings.join(", ") || "—"
            : layer === "task_profile"
              ? section.task
              : layer === "purpose_profile"
                ? section.purpose
                : layer === "workflow_node"
                  ? custom
                    ? "—"
                    : section.prompt
                  : layer === "custom_schema"
                    ? custom
                      ? section.prompt
                      : "—"
                    : section.runtimeVariables.join(", ") || "—"
    return { layer: PRECEDENCE_LAYER_LABELS[layer], value, active: layer === "custom_schema" ? custom : layer === "workflow_node" ? !custom : false }
  })
}

export function SchemaGovernanceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { schemaLifecycle, schemaVersion, markValidated, publishSchema, createNextDraft, sections, selectedSectionId, can } =
    useStore()
  const stageIndex = STAGES.indexOf(schemaLifecycle)
  const plan = React.useMemo(() => executionPlan(sections), [sections])
  const selected = sections.find((s) => s.id === selectedSectionId) ?? sections[0]
  const isAdmin = can("merge")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Schema governance · Narrative Focus V{schemaVersion}</SheetTitle>
          <SheetDescription>
            Published schemas are immutable. Documents pin the schema version they were generated from.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-4 pb-6">
            <ol className="flex items-center gap-1">
              {STAGES.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-1">
                  <span
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium",
                      i < stageIndex && "border-emerald-200 bg-emerald-50 text-emerald-700",
                      i === stageIndex && "border-primary bg-primary text-primary-foreground",
                      i > stageIndex && "border-border text-muted-foreground",
                    )}
                  >
                    {i < stageIndex && <Check className="size-3" />}
                    {s}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={schemaLifecycle !== "Draft"} onClick={markValidated}>
                <ShieldCheck data-icon="inline-start" />
                Mark validated
              </Button>
              <Button size="sm" disabled={schemaLifecycle !== "Validated" || !isAdmin} onClick={publishSchema}>
                <UploadCloud data-icon="inline-start" />
                Publish V{schemaVersion}
              </Button>
              <Button size="sm" variant="outline" disabled={schemaLifecycle !== "Published"} onClick={createNextDraft}>
                <GitBranchPlus data-icon="inline-start" />
                Create V{schemaVersion + 1} draft
              </Button>
            </div>
            {schemaLifecycle === "Validated" && !isAdmin && (
              <p className="text-xs text-muted-foreground">Publishing requires the Admin role.</p>
            )}

            <Separator />

            <Tabs defaultValue="plan">
              <TabsList>
                <TabsTrigger value="plan">Execution plan</TabsTrigger>
                <TabsTrigger value="trace">Precedence trace</TabsTrigger>
              </TabsList>

              <TabsContent value="plan" className="mt-3 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Derived from declared dependencies. Sections in the same stage can run in parallel.
                </p>
                {plan.map((stage, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-card p-2.5">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">Stage {i + 1}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {stage.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className={cn(t.includes("(cycle)") && "border-red-200 bg-red-50 text-red-700")}
                        >
                          {t.includes("(cycle)") && <TriangleAlert className="size-3" />}
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="trace" className="mt-3 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Precedence for <span className="font-medium text-foreground">{selected.title}</span>, from the base
                  configuration to the runtime instruction. Context is selected separately and is not a layer.
                </p>
                {precedenceTrace(selected).map((row) => (
                  <div
                    key={row.layer}
                    className={cn(
                      "flex flex-col gap-1 rounded-md border p-2.5",
                      row.active ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                    )}
                  >
                    <span className="flex items-center justify-between text-xs font-semibold">
                      {row.layer}
                      {row.active && (
                        <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                          Wins
                        </Badge>
                      )}
                    </span>
                    <span className="line-clamp-3 text-xs text-muted-foreground">{row.value}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
