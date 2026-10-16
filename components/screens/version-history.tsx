"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { CanonicalBadge } from "@/components/status-badge"
import { ArrowLeft, GitCommit, Sparkles, GitMerge, ScrollText } from "lucide-react"
import { toast } from "sonner"

export function VersionHistory() {
  const { view, docSections, navigate } = useStore()
  const id = view.params?.id ?? "sec-narrative"
  const section = docSections.find((s) => s.id === id) ?? docSections[0]
  const [selected, setSelected] = React.useState(section.history[section.history.length - 1]?.version ?? "")

  const history = [...section.history].reverse()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("documents")}>
          <ArrowLeft data-icon="inline-start" />
          Document
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold">Version History — {section.title}</h1>
          <span className="text-xs text-muted-foreground">
            Every canonical version is content-addressed and traceable to its Change Set.
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[420px_1fr]">
        {/* Timeline */}
        <div className="flex min-h-0 flex-col border-r border-border bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="relative p-6">
              <div className="absolute bottom-8 left-[35px] top-10 w-px bg-border" />
              <ol className="flex flex-col gap-2">
                {history.map((v, i) => {
                  const isCurrent = i === 0
                  const active = v.version === selected
                  const Icon = v.label === "Initial AI Generation" ? Sparkles : GitMerge
                  return (
                    <li key={v.version}>
                      <button
                        onClick={() => setSelected(v.version)}
                        className={`flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors ${
                          active ? "bg-accent" : "hover:bg-muted"
                        }`}
                      >
                        <span
                          className={`z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${
                            v.label === "Initial AI Generation"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          <Icon className="size-3" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">{v.version}</span>
                            {isCurrent && <CanonicalBadge version="current" />}
                          </div>
                          <span className="text-sm text-muted-foreground">{v.label}</span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            {v.changeSet && (
                              <span className="font-mono text-foreground">{v.changeSet}</span>
                            )}
                            <span>{v.date}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          </ScrollArea>
        </div>

        {/* Detail */}
        <ScrollArea className="min-h-0">
          <div className="mx-auto max-w-2xl p-8">
            {(() => {
              const v = section.history.find((h) => h.version === selected) ?? section.history[0]
              return (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Version {v.version}</h2>
                    <Badge variant="secondary">{v.label}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-border bg-card p-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Change Set</span>
                      <span className="font-mono">{v.changeSet ?? "— (initial generation)"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Date</span>
                      <span className="font-medium">{v.date}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Content Hash</span>
                      <span className="font-mono text-xs">{v.contentHash}</span>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Content Snapshot
                    </p>
                    <div
                      className="prose-editor rounded-md border border-border bg-card px-5 py-4 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Snapshot rendering is illustrative in this prototype — each version stores an immutable,
                      content-addressed copy of the section at approval time.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toast("Diff against previous version (illustrative).")}>
                      <GitCommit data-icon="inline-start" />
                      Compare with previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toast("Runtime manifest for this generation (illustrative).")}>
                      <ScrollText data-icon="inline-start" />
                      View manifest
                    </Button>
                    {selected !== history[0].version && (
                      <Button variant="outline" size="sm" onClick={() => toast("Restore creates a new working draft from this version.")}>
                        Restore to working draft
                      </Button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
