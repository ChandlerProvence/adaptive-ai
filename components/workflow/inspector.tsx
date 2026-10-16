"use client"

import * as React from "react"
import type { WorkflowNodeConfig } from "@/lib/mock-data"
import { PURPOSE_OPTIONS, TASK_OPTIONS } from "@/lib/mock-data"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { InheritanceBadge } from "@/components/status-badge"
import { Pencil, Plus, X, ArrowDownToLine, FileCode2 } from "lucide-react"
import { toast } from "sonner"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
}

export function Inspector({
  section,
  onEditPrompt,
  onChange,
}: {
  section: WorkflowNodeConfig
  onEditPrompt: () => void
  onChange: (patch: Partial<WorkflowNodeConfig>) => void
}) {
  const isCustom = section.badge === "overridden" || section.badge === "custom"

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Node Configuration</p>
          <h3 className="text-sm font-semibold">{section.title}</h3>
        </div>
        <InheritanceBadge kind={section.badge} />
      </div>

      <Tabs defaultValue="basic" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b border-border px-3 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">
              Basic
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1">
              Advanced
            </TabsTrigger>
            <TabsTrigger value="effective" className="flex-1">
              Effective
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {/* Basic */}
          <TabsContent value="basic" className="mt-0 flex flex-col gap-5 p-4">
            <div>
              <SectionLabel>Purpose</SectionLabel>
              <Field>
                <FieldLabel className="sr-only">Purpose</FieldLabel>
                <Select value={section.purpose} onValueChange={(v) => onChange({ purpose: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PURPOSE_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <p className="mt-1.5 text-xs text-muted-foreground">{section.purposeSummary}</p>
            </div>

            <div>
              <SectionLabel>Task</SectionLabel>
              <Field>
                <FieldLabel className="sr-only">Task</FieldLabel>
                <Select value={section.task} onValueChange={(v) => onChange({ task: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {TASK_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <p className="mt-1.5 text-xs text-muted-foreground">{section.taskSummary}</p>
            </div>

            <div>
              <SectionLabel>Prompt</SectionLabel>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{section.prompt}</span>
                  <span className="text-xs text-muted-foreground">Base: {section.basePrompt}</span>
                </div>
                <Button variant="outline" size="sm" onClick={onEditPrompt}>
                  <Pencil data-icon="inline-start" />
                  Edit
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel>Analytical Components</SectionLabel>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast("Add from Custom Insert Library (illustrative).")}
                >
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {section.analyticalEnhancements.length === 0 && (
                  <p className="text-xs text-muted-foreground">No analytical components on this node.</p>
                )}
                {section.analyticalEnhancements.map((e) => (
                  <div
                    key={e}
                    className="flex items-center justify-between rounded-md border border-violet-200 bg-violet-50/60 px-3 py-1.5"
                  >
                    <span className="text-sm text-violet-800">{e}</span>
                    <button
                      onClick={() =>
                        onChange({
                          analyticalEnhancements: section.analyticalEnhancements.filter((x) => x !== e),
                        })
                      }
                      className="text-violet-500 hover:text-violet-700"
                      aria-label={`Remove ${e}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Advanced */}
          <TabsContent value="advanced" className="mt-0 flex flex-col gap-5 p-4">
            <div>
              <SectionLabel>Dependencies</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {section.dependencies.length === 0 && (
                  <p className="text-xs text-muted-foreground">No upstream dependencies.</p>
                )}
                {section.dependencies.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span>{d.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{d.version}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Artifact Schema</SectionLabel>
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <FileCode2 className="size-4 text-muted-foreground" />
                {section.artifactSchema}
              </div>
            </div>

            <div>
              <SectionLabel>Required Inputs</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {section.requiredInputs.map((r) => (
                  <Badge key={r} variant="secondary" className="font-normal">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Runtime Variables</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {section.runtimeVariables.length === 0 && (
                  <p className="text-xs text-muted-foreground">None declared.</p>
                )}
                {section.runtimeVariables.map((r) => (
                  <Badge key={r} variant="outline" className="font-mono text-[11px]">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Validation Rules</SectionLabel>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {section.validationRules.length === 0 && <li className="text-xs">No custom validation rules.</li>}
                {section.validationRules.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionLabel>Execution Behavior</SectionLabel>
              <p className="text-sm text-muted-foreground">{section.executionBehavior}</p>
            </div>
          </TabsContent>

          {/* Effective / resolved */}
          <TabsContent value="effective" className="mt-0 flex flex-col gap-5 p-4">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownToLine className="size-3.5" />
                Inherited from Base Workflow
              </div>
              <div className="flex flex-wrap gap-1.5">
                {section.inheritedSettings.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            {isCustom && section.overrides.length > 0 && (
              <div>
                <SectionLabel>Overrides on this node</SectionLabel>
                <ul className="flex flex-col gap-1.5">
                  {section.overrides.map((o) => (
                    <li
                      key={o}
                      className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-sm text-blue-800"
                    >
                      <Pencil className="mt-0.5 size-3.5 shrink-0" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div>
              <SectionLabel>Effective Configuration</SectionLabel>
              <dl className="flex flex-col gap-1.5 text-sm">
                {[
                  ["Purpose", section.purpose],
                  ["Task", section.task],
                  ["Prompt", section.prompt],
                  ["Artifact Schema", section.artifactSchema],
                  ["Model", section.modelConfig],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
