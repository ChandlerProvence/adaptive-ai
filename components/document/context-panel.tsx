"use client"

import type { DocSection } from "@/lib/mock-data"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CanonicalBadge } from "@/components/status-badge"
import { SectionStatePanel } from "@/components/document/section-state-panel"
import { FileClock, ScrollText, Workflow, CircleCheck, TriangleAlert } from "lucide-react"

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
}

export function ContextPanel({
  section,
  onManifest,
  onHistory,
  onGraph,
}: {
  section: DocSection
  onManifest: () => void
  onHistory: () => void
  onGraph: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="context" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b border-border px-3 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="context" className="flex-1">
              Context
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="flex-1">
              Dependencies
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {/* Context / configuration */}
          <TabsContent value="context" className="mt-0 flex flex-col gap-5 p-4">
            <SectionStatePanel section={section} />
            <Separator />
            <div>
              <Label>Generation Configuration</Label>
              <dl className="flex flex-col gap-1.5 text-sm">
                {[
                  ["Workflow Schema", section.config.workflowSchema],
                  ["Context", section.config.context],
                  ["Task", section.config.task],
                  ["Purpose", section.config.purpose],
                  ["Prompt", section.config.prompt],
                  ["Artifact Schema", section.config.artifactSchema],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <Label>Custom Inserts</Label>
              <div className="flex flex-wrap gap-1.5">
                {section.config.customInserts.map((c) => (
                  <Badge key={c} variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <Label>Provenance</Label>
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">Generation</dt>
                  <dd className="font-mono text-xs">{section.generation}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">Canonical</dt>
                  <dd>
                    <CanonicalBadge version={section.canonicalVersion} />
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={onManifest} className="justify-start">
                <ScrollText data-icon="inline-start" />
                View Runtime Manifest
              </Button>
              <Button variant="outline" size="sm" onClick={onHistory} className="justify-start">
                <FileClock data-icon="inline-start" />
                View Version History
              </Button>
              <Button variant="outline" size="sm" onClick={onGraph} className="justify-start">
                <Workflow data-icon="inline-start" />
                View Dependency Graph
              </Button>
            </div>
          </TabsContent>

          {/* Dependencies */}
          <TabsContent value="dependencies" className="mt-0 flex flex-col gap-4 p-4">
            <Label>Upstream Dependencies</Label>
            {section.dependencies.length === 0 && (
              <p className="text-sm text-muted-foreground">This section has no upstream dependencies.</p>
            )}
            <div className="flex flex-col gap-2">
              {section.dependencies.map((d) => {
                const changed = d.state === "Changed"
                return (
                  <div
                    key={d.name}
                    className={`rounded-md border px-3 py-2 ${
                      changed ? "border-amber-200 bg-amber-50" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.name}</span>
                      {changed ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-[10px]">
                          <TriangleAlert className="size-3" />
                          Changed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
                        >
                          <CircleCheck className="size-3" />
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Generated with <span className="font-mono">{d.generatedWith}</span>
                      </span>
                      {changed && (
                        <>
                          <span>→</span>
                          <span className="font-medium text-amber-700">
                            now <span className="font-mono">{d.current}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
