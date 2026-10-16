"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { InheritanceBadge } from "@/components/status-badge"
import { Inspector } from "@/components/workflow/inspector"
import { PromptEditorSheet } from "@/components/workflow/prompt-editor"
import { ValidatePanel } from "@/components/workflow/validate-panel"
import { CompareBaseSheet } from "@/components/workflow/compare-base"
import { SchemaGovernanceSheet } from "@/components/workflow/schema-governance"
import { RichEditor } from "@/components/rich-editor"
import {
  ArrowLeft,
  GitCompare,
  ShieldCheck,
  UploadCloud,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

export function WorkflowEditor() {
  const { navigate, sections, selectedSectionId, selectSection, updateSection, savePromptComponents } = useStore()
  const [promptOpen, setPromptOpen] = React.useState(false)
  const [validateOpen, setValidateOpen] = React.useState(false)
  const [compareOpen, setCompareOpen] = React.useState(false)
  const [governanceOpen, setGovernanceOpen] = React.useState(false)
  const { schemaLifecycle, schemaVersion } = useStore()

  const selected = sections.find((s) => s.id === selectedSectionId) ?? sections[0]

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("workflows")}>
          <ArrowLeft data-icon="inline-start" />
          Library
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">Strategic Assessment — Narrative Focus</h1>
            <span className="font-mono text-xs text-muted-foreground">V{schemaVersion}</span>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">
              Custom
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                schemaLifecycle === "Published"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : schemaLifecycle === "Validated"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              {schemaLifecycle}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">Based on Strategic Assessment V4 · 9 nodes</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCompareOpen(true)}>
            <GitCompare data-icon="inline-start" />
            Compare to Base
          </Button>
          <Button variant="outline" size="sm" onClick={() => setValidateOpen(true)}>
            <ShieldCheck data-icon="inline-start" />
            Validate
          </Button>
          <Button size="sm" onClick={() => setGovernanceOpen(true)}>
            <UploadCloud data-icon="inline-start" />
            Lifecycle &amp; Plan
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px]">
        {/* Outline */}
        <div className="flex min-h-0 flex-col border-r border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Structure Outline
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {sections.length}
            </Badge>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-0.5 px-2 pb-4">
              {sections.map((s) => {
                const active = s.id === selectedSectionId
                return (
                  <button
                    key={s.id}
                    onClick={() => selectSection(s.id)}
                    className={cn(
                      "group flex items-center gap-2 rounded-md py-2 pr-2 text-left text-sm transition-colors",
                      s.level === 2 ? "pl-7" : "pl-3",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        active && "rotate-90 text-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <InheritanceBadge kind={s.badge} className="shrink-0 [&>svg]:size-2.5 px-1 py-0" />
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Center: node preview / structure body */}
        <div className="flex min-h-0 flex-col bg-background">
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto max-w-3xl px-8 py-6">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{selected.title}</h2>
                <InheritanceBadge kind={selected.badge} />
              </div>

              <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-border bg-card p-4 text-sm">
                {[
                  ["Purpose", selected.purpose],
                  ["Task", selected.task],
                  ["Prompt", selected.prompt],
                  ["Artifact Schema", selected.artifactSchema],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Node Content Preview
              </p>
              <div className="rounded-md border border-border bg-card">
                <RichEditor content={selected.bodyHtml} editable={false} showToolbar={false} />
              </div>

              {selected.analyticalEnhancements.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Analytical Components
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.analyticalEnhancements.map((e) => (
                      <Badge key={e} variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Inspector */}
        <div className="min-h-0 border-l border-border bg-card">
          <Inspector
            section={selected}
            onEditPrompt={() => setPromptOpen(true)}
            onChange={(patch) => updateSection(selected.id, patch)}
          />
        </div>
      </div>

      <PromptEditorSheet
        open={promptOpen}
        onOpenChange={setPromptOpen}
        section={selected}
        onSave={(components) => savePromptComponents(selected.id, components)}
      />
      <ValidatePanel open={validateOpen} onOpenChange={setValidateOpen} />
      <CompareBaseSheet open={compareOpen} onOpenChange={setCompareOpen} />
      <SchemaGovernanceSheet open={governanceOpen} onOpenChange={setGovernanceOpen} />
    </div>
  )
}
