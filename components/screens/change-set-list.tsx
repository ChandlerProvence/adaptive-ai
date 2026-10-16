"use client"

import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { GitPullRequestArrow, ArrowRight, GitMerge } from "lucide-react"

const statusStyle: Record<string, string> = {
  Submitted: "border-blue-200 bg-blue-50 text-blue-700",
  Approved: "border-blue-200 bg-blue-50 text-blue-700",
  Merged: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-red-200 bg-red-50 text-red-700",
  Withdrawn: "border-slate-200 bg-slate-50 text-slate-600",
  Superseded: "border-amber-200 bg-amber-50 text-amber-700",
}

export function ChangeSetList() {
  const { changeSets, navigate } = useStore()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-border bg-card px-6 py-5">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight">Change Sets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A Change Set is a reviewable snapshot of collaborative edits to a section, from a base canonical version to a
            candidate. Merging a Change Set creates a new Canonical Version.
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-6">
          {changeSets.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GitPullRequestArrow />
                </EmptyMedia>
                <EmptyTitle>No Change Sets yet</EmptyTitle>
                <EmptyDescription>
                  Submit a Change Set from the document workspace to capture a reviewable snapshot.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Change Set</th>
                    <th className="px-4 py-2.5 font-medium">Section</th>
                    <th className="px-4 py-2.5 font-medium">Base → Candidate</th>
                    <th className="px-4 py-2.5 font-medium">Contributors</th>
                    <th className="px-4 py-2.5 font-medium">Revisions</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {changeSets.map((cs) => (
                    <tr key={cs.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{cs.id}</td>
                      <td className="px-4 py-3 font-medium">{cs.section}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          {cs.base}
                          <ArrowRight className="size-3" />
                          <span className="text-foreground">{cs.candidate}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{cs.contributors.join(", ")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{cs.revisionEvents} events</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${statusStyle[cs.status]}`}>
                          {cs.status === "Merged" && <GitMerge className="size-3" />}
                          {cs.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cs.status === "Merged"}
                          onClick={() => navigate("changeset-review", { id: cs.id })}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
