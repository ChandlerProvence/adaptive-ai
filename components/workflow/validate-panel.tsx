"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CircleCheck, TriangleAlert, Sparkles } from "lucide-react"

const CHECKS = [
  "Task references valid",
  "Purpose references valid",
  "Prompt references valid",
  "Artifact Schemas valid",
  "Dependency graph valid",
  "No unsupported circular dependencies",
  "Required variables resolved",
  "Downstream input contracts compatible",
]

const ADVISORIES = [
  "Narrative Assessment uses Source Comparison, but only one source is currently configured as a required input.",
  "The Purpose for Recommendation changed, but its Task configuration still inherits the Base Workflow settings.",
]

export function ValidatePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Workflow Validation</SheetTitle>
          <SheetDescription>Deterministic checks and AI-assisted advisory review.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">Deterministic Validation</h3>
                <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  <CircleCheck className="size-3" />
                  {CHECKS.length} checks passed
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {CHECKS.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm">
                    <CircleCheck className="size-4 shrink-0 text-emerald-600" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-violet-600" />
                <h3 className="text-sm font-semibold">AI-Assisted Review</h3>
                <span className="text-xs text-muted-foreground">Advisory, not blocking</span>
              </div>
              <div className="flex flex-col gap-3">
                {ADVISORIES.map((a, i) => (
                  <Alert key={i} className="border-amber-200 bg-amber-50 text-amber-900">
                    <TriangleAlert className="size-4 text-amber-600" />
                    <AlertTitle>Advisory {i + 1}</AlertTitle>
                    <AlertDescription className="text-amber-800">{a}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
