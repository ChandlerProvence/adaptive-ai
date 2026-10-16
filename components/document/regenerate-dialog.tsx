"use client"

import * as React from "react"
import type { DocSection } from "@/lib/mock-data"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { sectionStateModel } from "@/lib/section-state"
import { TriangleAlert, Sparkles, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Mode = "revise" | "full"

interface ProposedChange {
  id: string
  label: string
  text: string
}

// Canned proposals: each is a discrete change the user can accept or reject individually.
const PROPOSALS: Record<string, ProposedChange[]> = {
  "sec-recommendation": [
    {
      id: "c1",
      label: "Incorporate Constraints V9",
      text: "The newly binding customer data residency requirement (Constraints V9) further disadvantages Alternative B, whose parallel execution would require duplicate compliant data handling in both markets.",
    },
    {
      id: "c2",
      label: "Add decision trigger",
      text: "The recommendation should be revisited if secondary-region demand evidence strengthens within two quarters.",
    },
  ],
  "sec-risk": [
    {
      id: "c1",
      label: "Re-grade Alternative B",
      text: "Under Constraints V9, data residency adds a compliance-execution risk that raises Alternative B from Medium to High.",
    },
  ],
}

const FALLBACK: ProposedChange[] = [
  {
    id: "c1",
    label: "Refresh against latest dependencies",
    text: "This section has been re-checked against the latest upstream versions; no conclusions change.",
  },
]

function appendToLastParagraph(html: string, sentences: string[], highlight: boolean) {
  if (!sentences.length) return html
  const addition = sentences.map((s) => (highlight ? `<span class="diff-add">${s}</span>` : s)).join(" ")
  const idx = html.lastIndexOf("</p>")
  return idx < 0 ? `${html}<p>${addition}</p>` : `${html.slice(0, idx)} ${addition}${html.slice(idx)}`
}

export function RegenerateDialog({
  open,
  onOpenChange,
  section,
  onApply,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  section: DocSection
  onApply: (html: string, meta: { mode: string; accepted: number; total: number }) => void
}) {
  const [phase, setPhase] = React.useState<"running" | "ready">("running")
  const [mode, setMode] = React.useState<Mode>("revise")
  const changes = PROPOSALS[section.id] ?? FALLBACK
  const [accepted, setAccepted] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (!open) return
    setPhase("running")
    setAccepted(Object.fromEntries(changes.map((c) => [c.id, true])))
    const t = setTimeout(() => setPhase("ready"), 1100)
    return () => clearTimeout(t)
  }, [open, mode, changes])

  const model = sectionStateModel(section)
  const changedDeps = section.dependencies.filter((d) => d.state === "Changed")
  const acceptedTexts = changes.filter((c) => accepted[c.id]).map((c) => c.text)
  const preview = appendToLastParagraph(section.bodyHtml, acceptedTexts, true)
  const finalHtml = appendToLastParagraph(section.bodyHtml, acceptedTexts, false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            Regenerate: {section.title}
          </DialogTitle>
          <DialogDescription>
            Produces a proposal against your current working draft. Nothing becomes canonical until a Change Set is
            submitted and approved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {model.dependencyHealth !== "Current" && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <TriangleAlert className="size-4 text-amber-600" />
              <AlertTitle>Why this is being regenerated</AlertTitle>
              <AlertDescription className="text-amber-800">
                {model.staleReasons.join(" ")}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {changedDeps.map((d) => (
                    <Badge key={d.name} variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                      {d.name}: {d.generatedWith} → {d.current}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</span>
              <span className="text-xs text-muted-foreground">
                {mode === "revise"
                  ? "Minimal edits to the existing draft — preserves collaborator wording."
                  : "Regenerates the whole section from its manifest. Human edits may be lost."}
              </span>
            </div>
            <ToggleGroup
              value={[mode]}
              onValueChange={(v) => v[0] && setMode(v[0] as Mode)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="revise">Revise existing</ToggleGroupItem>
              <ToggleGroupItem value="full">Full regenerate</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {phase !== "ready" ? (
            <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border text-sm text-muted-foreground">
              <Spinner className="size-5" />
              Generating proposal from pinned manifest with updated dependencies…
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proposed changes · accept individually
                </p>
                {changes.map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2",
                      accepted[c.id] ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card opacity-70",
                    )}
                  >
                    <Switch
                      checked={!!accepted[c.id]}
                      onCheckedChange={(v) => setAccepted((a) => ({ ...a, [c.id]: v }))}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="text-xs text-muted-foreground">{c.text}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resulting working draft
                </p>
                <ScrollArea className="h-40 rounded-md border border-border bg-card">
                  <div
                    className="prose-editor px-5 py-4 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: preview }}
                  />
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X data-icon="inline-start" />
            Discard proposal
          </Button>
          <Button
            disabled={phase !== "ready" || acceptedTexts.length === 0}
            onClick={() => {
              onApply(finalHtml, {
                mode: mode === "revise" ? "revise" : "full regenerate",
                accepted: acceptedTexts.length,
                total: changes.length,
              })
              onOpenChange(false)
            }}
          >
            <Check data-icon="inline-start" />
            Apply {acceptedTexts.length}/{changes.length} to Working Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
