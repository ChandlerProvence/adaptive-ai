"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useStore, type ScreenName } from "@/lib/store"
import { getRecord, versionLabel } from "@/lib/config"
import { Workflow, Library, GitPullRequestArrow, Layers, SlidersHorizontal, ScrollText } from "lucide-react"

const NAV: { name: ScreenName; label: string; Icon: typeof Workflow }[] = [
  { name: "contexts", label: "Contexts", Icon: SlidersHorizontal },
  { name: "workflows", label: "Workflows", Icon: Workflow },
  { name: "catalog", label: "Catalog", Icon: Library },
  { name: "changesets", label: "Change Sets", Icon: GitPullRequestArrow },
  { name: "audit", label: "Audit", Icon: ScrollText },
]

// Which top-level nav item is highlighted for a given (possibly nested) view.
const VIEW_TO_NAV: Record<string, ScreenName> = {
  documents: "contexts",
  workflows: "workflows",
  "workflow-editor": "workflows",
  catalog: "catalog",
  inserts: "catalog",
  changesets: "changesets",
  "changeset-review": "changesets",
  "version-history": "contexts",
  graph: "contexts",
  contexts: "contexts",
  audit: "audit",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { catalog, view, navigate, instanceId, runs } = useStore()
  const activeNav = VIEW_TO_NAV[view.name]
  const run = runs.find((item) => item.id === instanceId)
  const mission = view.name === "documents" && run ? catalog.records.find((record) => record.id === run.context.id && record.version === run.context.version) : undefined
  const familyId = view.name === "contexts" ? view.params?.context : mission?.forkedFrom && mission.forkedFrom.id !== mission.id ? mission.forkedFrom.id : mission?.id
  const family = familyId ? catalog.records.find((record) => record.kind === "context" && record.id === familyId && (!record.forkedFrom || record.forkedFrom.id === record.id)) : undefined
  const trailWorkflow = view.name === "documents" && run ? getRecord(catalog, run.workflow) : undefined

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Imperium</span>
            <span className="text-[10px] text-sidebar-foreground/60">Workflow &amp; Authoring</span>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV.map(({ name, label, Icon }) => {
            const active = activeNav === name
            return (
              <button
                key={name}
                onClick={() => navigate(name)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
          <div className="flex items-center gap-2 text-sm">
            {family ? (
              view.name === "documents" ? (
                <button onClick={() => navigate("contexts", { context: family.id })} className="font-semibold hover:underline">
                  {family.name}
                </button>
              ) : (
                <span className="font-semibold">{family.name}</span>
              )
            ) : (
              <span className="font-semibold">Imperium</span>
            )}
            {mission && family && mission.id !== family.id ? (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-semibold">{mission.name}</span>
              </>
            ) : null}
            {trailWorkflow && trailWorkflow.kind === "workflow" ? (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">
                  {trailWorkflow.name} {versionLabel(trailWorkflow.version)}
                </span>
              </>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  )
}
