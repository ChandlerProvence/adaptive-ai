"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { coaCatalog, getRun, versionLabel } from "@/lib/config"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { RichEditor } from "@/components/rich-editor"
import { SectionStateBadge, StatusDot } from "@/components/status-badge"
import { ContextPanel } from "@/components/document/context-panel"
import { RegenerateDialog } from "@/components/document/regenerate-dialog"
import { RuntimeManifestDrawer, manifestFor } from "@/components/runtime-manifest"
import {
  Sparkles,
  GitPullRequestArrow,
  TriangleAlert,
  Pencil,
  GitBranch,
  CircleCheck,
  Pin,
  RotateCcw,
} from "lucide-react"
import { sectionStateModel, primaryState } from "@/lib/section-state"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

const impactStyle = {
  Low: "border-slate-200 bg-slate-50 text-slate-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-red-200 bg-red-50 text-red-700",
} as const

export function DocumentWorkspace() {
  const {
    docSections,
    selectedDocId,
    selectDoc,
    setDocBody,
    submitChangeSet,
    applyRegeneration,
    resetWorkingDraft,
    acknowledgeStale,
    navigate,
    can,
    instanceId,
  } = useStore()

  const [regenOpen, setRegenOpen] = React.useState(false)
  const [manifestOpen, setManifestOpen] = React.useState(false)

  const section = docSections.find((s) => s.id === selectedDocId) ?? docSections[0]
  const model = sectionStateModel(section)
  const summary = primaryState(section)
  const isStale = model.dependencyHealth !== "Current"
  const hasChangeSet = section.changeSet !== null
  const isModified = section.workingState === "Modified"
  const canSubmit = isModified && !hasChangeSet && can("submit")
  const run = getRun(instanceId ?? "")
  const pinnedWorkflow = run
    ? coaCatalog.records.find((record) => record.id === run.workflow.id && record.version === run.workflow.version)
    : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{run?.name ?? "Market entry assessment"}</h1>
            <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700 text-[10px]">
              <Pin className="size-3" />
              Pinned: {pinnedWorkflow ? `${pinnedWorkflow.name} ${versionLabel(pinnedWorkflow.version)}` : "Strategic Assessment — Narrative Focus v.3"}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Workflow instance pinned to its schema version · 8 sections
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" disabled={!isModified || !can("reset")}>
                  <RotateCcw data-icon="inline-start" />
                  Reset Draft
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset working draft to canonical {section.canonicalVersion}?</AlertDialogTitle>
                <AlertDialogDescription>
                  All uncommitted working edits to {section.title} will be discarded and replaced with the last approved
                  canonical content. Submitted Change Sets and version history are not affected. This action is audited.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => resetWorkingDraft(section.id)}>
                  Reset draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" disabled={!can("regenerate")} onClick={() => setRegenOpen(true)}>
            <Sparkles data-icon="inline-start" />
            Regenerate
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={() => submitChangeSet(section.id)}>
            <GitPullRequestArrow data-icon="inline-start" />
            Submit Change Set
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_340px]">
        {/* Outline */}
        <div className="flex min-h-0 flex-col border-r border-border bg-card">
          <div className="px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document Outline</span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-0.5 px-2 pb-4">
              {docSections.map((s) => {
                const active = s.id === selectedDocId
                return (
                  <button
                    key={s.id}
                    onClick={() => selectDoc(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <StatusDot state={primaryState(s)} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{s.canonicalVersion}</span>
                  </button>
                )
              })}
            </div>
            <div className="mx-3 mb-3 rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Legend</p>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <StatusDot state="Current" /> Current
                </li>
                <li className="flex items-center gap-2">
                  <StatusDot state="Working Changes" /> Working changes
                </li>
                <li className="flex items-center gap-2">
                  <StatusDot state="Change Set Open" /> Change Set open
                </li>
                <li className="flex items-center gap-2">
                  <StatusDot state="Potentially Stale" /> Potentially stale
                </li>
              </ul>
            </div>
          </ScrollArea>
        </div>

        {/* Center editor */}
        <div className="flex min-h-0 flex-col bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-2.5">
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <SectionStateBadge state={summary} />
            {isModified && summary !== "Working Changes" && <SectionStateBadge state="Working Changes" />}
            <span className="font-mono text-xs text-muted-foreground">{section.canonicalVersion}</span>
            {section.changeSet && (
              <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">
                <GitBranch className="size-3" />
                {section.changeSet}
              </Badge>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto max-w-3xl px-8 py-6">
              {/* State banners */}
              {isStale && (
                <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
                  <TriangleAlert className="size-4 text-amber-600" />
                  <AlertTitle className="flex items-center gap-2">
                    Potentially Stale
                    {section.staleImpact && (
                      <Badge variant="outline" className={cn("text-[10px]", impactStyle[section.staleImpact])}>
                        {section.staleImpact} impact
                      </Badge>
                    )}
                  </AlertTitle>
                  <AlertDescription className="text-amber-800">
                    <ul className="flex flex-col gap-0.5">
                      {model.staleReasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    {section.staleSummary && <p className="mt-1">{section.staleSummary}</p>}
                    <p className="mt-1 text-xs">
                      Staleness is conservative: any upstream change marks this section, regardless of how minor. The
                      canonical content ({section.canonicalVersion}) is never auto-changed.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-amber-600 text-white hover:bg-amber-700"
                        disabled={!can("regenerate")}
                        onClick={() => setRegenOpen(true)}
                      >
                        <Sparkles data-icon="inline-start" />
                        Review &amp; Regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 bg-transparent text-amber-800 hover:bg-amber-100"
                        disabled={!can("edit")}
                        onClick={() => acknowledgeStale(section.id)}
                      >
                        Keep as-is
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {isModified && !hasChangeSet && (
                <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-900">
                  <Pencil className="size-4 text-blue-600" />
                  <AlertTitle>Working Changes</AlertTitle>
                  <AlertDescription className="text-blue-800">
                    This section has unsaved working edits that diverge from canonical {section.canonicalVersion}. Submit
                    a Change Set to capture a reviewable snapshot.
                  </AlertDescription>
                </Alert>
              )}

              {hasChangeSet && (
                <Alert className="mb-4 border-violet-200 bg-violet-50 text-violet-900">
                  <GitBranch className="size-4 text-violet-600" />
                  <AlertTitle>Change Set {section.changeSet} open</AlertTitle>
                  <AlertDescription className="text-violet-800">
                    A submitted snapshot is under review. New edits stay in the working document and will feed the next
                    Change Set — they do not modify {section.changeSet}.
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-violet-300 bg-transparent text-violet-800 hover:bg-violet-100"
                        onClick={() => navigate("changeset-review", { id: section.changeSet! })}
                      >
                        Open Change Set Review
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {summary === "Current" && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CircleCheck className="size-4" />
                  This section is current. Its content matches canonical {section.canonicalVersion} and all dependencies
                  are up to date.
                </div>
              )}

              {/* Editor */}
              <div className="rounded-md border border-border bg-card shadow-sm">
                <RichEditor
                  key={section.id}
                  content={section.bodyHtml}
                  onChange={(html) => setDocBody(section.id, html)}
                  editable={can("edit")}
                />
              </div>
              {hasChangeSet && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Editing continues in the working draft. These edits do not modify {section.changeSet} — they will
                  form the next Change Set.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right rail */}
        <div className="min-h-0 border-l border-border bg-card">
          <ContextPanel
            section={section}
            onManifest={() => setManifestOpen(true)}
            onHistory={() => navigate("version-history", { id: section.id })}
            onGraph={() => navigate("graph")}
          />
        </div>
      </div>

      <RegenerateDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        section={section}
        onApply={(html, meta) => applyRegeneration(section.id, html, meta)}
      />
      <RuntimeManifestDrawer
        open={manifestOpen}
        onOpenChange={setManifestOpen}
        data={manifestFor({
          generation: section.generation,
          node: section.title,
          task: section.config.task,
          purpose: section.config.purpose,
          prompt: section.config.prompt,
          artifactSchema: section.config.artifactSchema,
          customInserts: section.config.customInserts,
          dependencies: section.dependencies.map((d) => `${d.name} ${d.current}`),
          contentHash: `sha256:${section.history[section.history.length - 1]?.contentHash ?? "…"}`,
        })}
      />
    </div>
  )
}
