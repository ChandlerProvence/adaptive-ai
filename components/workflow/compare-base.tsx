"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface DiffRow {
  node: string
  field: string
  base: string
  custom: string
  kind: "modified" | "added" | "removed"
}

const DIFF: DiffRow[] = [
  { node: "(workflow)", field: "Node", base: "—", custom: "Narrative Assessment", kind: "added" },
  { node: "Narrative Assessment", field: "Prompt", base: "Narrative Analysis V4", custom: "Narrative Analysis V5", kind: "modified" },
  { node: "Narrative Assessment", field: "Custom Inserts", base: "—", custom: "Source Comparison V1", kind: "added" },
  { node: "Narrative Assessment", field: "Custom Inserts", base: "—", custom: "Contradiction Detection V2", kind: "added" },
  { node: "Recommendation", field: "Dependency", base: "Constraints V8", custom: "Constraints V9", kind: "modified" },
  { node: "Executive Summary", field: "Prompt", base: "Executive Summary V3", custom: "Executive Summary V3", kind: "removed" },
]

const kindStyle: Record<DiffRow["kind"], string> = {
  modified: "border-blue-200 bg-blue-50 text-blue-700",
  added: "border-emerald-200 bg-emerald-50 text-emerald-700",
  removed: "border-amber-200 bg-amber-50 text-amber-700",
}

export function CompareBaseSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const shown = DIFF.filter((d) => d.kind !== "removed")
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Compare to Base</SheetTitle>
          <SheetDescription>
            Strategic Assessment — Narrative Focus V3 vs. base Strategic Assessment V4.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {shown.filter((d) => d.kind === "added").length} added
              </Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                {shown.filter((d) => d.kind === "modified").length} modified
              </Badge>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Node</th>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Base</th>
                    <th className="px-3 py-2 font-medium">Custom</th>
                    <th className="px-3 py-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{d.node}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.field}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.base}</td>
                      <td className="px-3 py-2 font-mono text-xs">{d.custom}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[10px] ${kindStyle[d.kind]}`}>
                          {d.kind}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
