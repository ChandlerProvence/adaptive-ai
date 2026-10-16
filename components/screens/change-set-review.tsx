"use client"

import * as React from "react"
import { useStore, CURRENT_USER } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { deterministicDiff, aiAnalysis, CHANGE_CLASSES, CLASS_HELP, type ChangeClass } from "@/lib/change-analysis"
import {
  ArrowLeft,
  GitMerge,
  ArrowRight,
  Info,
  Sparkles,
  TriangleAlert,
  XCircle,
  Undo2,
  ShieldAlert,
  Hash,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"

const CLASS_STYLE: Record<ChangeClass, string> = {
  Editorial: "border-slate-200 bg-slate-50 text-slate-700",
  Clarifying: "border-sky-200 bg-sky-50 text-sky-700",
  Contextual: "border-violet-200 bg-violet-50 text-violet-700",
  Semantic: "border-amber-200 bg-amber-50 text-amber-800",
  Structural: "border-blue-200 bg-blue-50 text-blue-700",
  Conflicting: "border-red-200 bg-red-50 text-red-700",
}

const STATUS_STYLE: Record<string, string> = {
  Submitted: "border-blue-200 bg-blue-50 text-blue-700",
  Approved: "border-blue-200 bg-blue-50 text-blue-700",
  Merged: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-red-200 bg-red-50 text-red-700",
  Withdrawn: "border-slate-200 bg-slate-50 text-slate-600",
  Superseded: "border-amber-200 bg-amber-50 text-amber-700",
}

export function ChangeSetReview() {
  const {
    view,
    changeSets,
    docSections,
    navigate,
    approveMerge,
    rejectChangeSet,
    withdrawChangeSet,
    can,
    allowSelfApproval,
  } = useStore()
  const [comment, setComment] = React.useState("")

  const id = view.params?.id ?? changeSets[0]?.id
  const cs = changeSets.find((c) => c.id === id) ?? changeSets[0]

  const diff = React.useMemo(() => (cs ? deterministicDiff(cs.baseHtml, cs.candidateHtml) : null), [cs])
  const dependents = React.useMemo(
    () => (cs ? docSections.filter((s) => s.dependencies.some((d) => d.name === cs.section)).map((s) => s.title) : []),
    [cs, docSections],
  )

  if (!cs || !diff) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Change Set not found.</div>
    )
  }

  const ai = aiAnalysis(cs.sectionId, diff, dependents)
  const target = docSections.find((s) => s.id === cs.sectionId)
  const isOpen = cs.status === "Submitted" || cs.status === "Approved"
  const baseMoved = isOpen && !!target && target.canonicalVersion !== cs.base
  const isAuthor = cs.createdBy === CURRENT_USER
  const selfBlocked = isAuthor && !allowSelfApproval
  const canMerge = isOpen && can("approve") && can("merge") && !selfBlocked
  const nextVersion = `V${parseInt(cs.base.replace("V", ""), 10) + 1}`
  const revisions = [{ actor: cs.createdBy, action: "edited working draft", time: cs.submittedAt }]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("changesets")}>
          <ArrowLeft data-icon="inline-start" />
          Change Sets
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{cs.id}</span>
            <span className="text-sm">{cs.section}</span>
            <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[cs.status])}>
              {cs.status}
            </Badge>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            Base {cs.base}
            <ArrowRight className="size-3" />
            {cs.status === "Merged" ? `Merged as ${cs.mergedVersion}` : `Candidate → ${nextVersion}`}
            <span className="ml-2 inline-flex items-center gap-1">
              <Hash className="size-3" />
              {cs.candidateHash}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isOpen && isAuthor && (
            <Button variant="ghost" size="sm" onClick={() => withdrawChangeSet(cs.id)}>
              <Undo2 data-icon="inline-start" />
              Withdraw
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button size="sm" disabled={!canMerge}>
                  <GitMerge data-icon="inline-start" />
                  Approve &amp; Merge
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {baseMoved ? "Base version has changed" : `Merge ${cs.id} into ${cs.section} ${nextVersion}?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {baseMoved
                    ? `${cs.section} is now at ${target?.canonicalVersion}, but this Change Set was built on ${cs.base}. The merge will be refused and the Change Set marked Superseded. Rebase the working draft and submit a new Change Set.`
                    : `Merges the frozen candidate snapshot (${cs.candidateHash}) — not the live working draft. This creates ${cs.section} ${nextVersion} as the new canonical baseline${
                        dependents.length ? ` and marks ${dependents.join(", ")} Potentially Stale` : ""
                      }. Later working edits are preserved.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => approveMerge(cs.id)}>
                  {baseMoved ? "Attempt merge" : "Approve & Merge"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-6">
            {baseMoved && (
              <Alert className="border-red-200 bg-red-50 text-red-900">
                <ShieldAlert className="size-4 text-red-600" />
                <AlertTitle>Stale base — merge blocked by optimistic concurrency</AlertTitle>
                <AlertDescription className="text-red-800">
                  Canonical is now {target?.canonicalVersion}; this Change Set was built on {cs.base}. Merging would
                  silently discard the intervening version.
                </AlertDescription>
              </Alert>
            )}
            {cs.status === "Superseded" && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <TriangleAlert className="size-4 text-amber-600" />
                <AlertTitle>Superseded</AlertTitle>
                <AlertDescription className="text-amber-800">
                  Another Change Set merged against the same base first. Its edits remain in the working draft for a
                  new submission.
                </AlertDescription>
              </Alert>
            )}
            {cs.reviewComment && (
              <Alert>
                <Info className="size-4" />
                <AlertTitle>Reviewer comment</AlertTitle>
                <AlertDescription>{cs.reviewComment}</AlertDescription>
              </Alert>
            )}
            {isOpen && selfBlocked && (
              <Alert>
                <Lock className="size-4" />
                <AlertTitle>Self-approval disabled by policy</AlertTitle>
                <AlertDescription>
                  You authored this Change Set. Another Reviewer or Admin must approve it.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="side">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="side">Side by side</TabsTrigger>
                  <TabsTrigger value="candidate">Candidate only</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <span className="text-emerald-700">+{diff.added} words</span>
                  <span className="text-red-700">−{diff.removed} words</span>
                  <span>
                    {diff.paragraphsAdded} added · {diff.paragraphsModified} modified · {diff.paragraphsRemoved} removed
                  </span>
                </div>
              </div>
              <TabsContent value="side" className="mt-3">
                <div className="grid grid-cols-2 gap-4">
                  <DiffPane label={`Base ${cs.base} (canonical)`} html={diff.baseHtml} />
                  <DiffPane label={`Candidate snapshot ${cs.candidateHash}`} html={diff.candidateHtml} />
                </div>
              </TabsContent>
              <TabsContent value="candidate" className="mt-3">
                <DiffPane label={`Candidate snapshot ${cs.candidateHash}`} html={diff.candidateHtml} />
              </TabsContent>
            </Tabs>

            <section className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold">Revision events ({revisions.length})</h2>
                <span className="text-xs text-muted-foreground">
                  Collapsed into this Change Set — not reviewed individually
                </span>
              </div>
              <ul className="divide-y divide-border">
                {revisions.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="font-medium">{r.actor}</span>
                    <span className="text-muted-foreground">{r.action}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.time}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </ScrollArea>

        <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-violet-600" />
                  <h2 className="text-sm font-semibold">AI change analysis</h2>
                </div>
                <p className="text-sm text-muted-foreground">{ai.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CHANGE_CLASSES.map((c) => {
                    const active = ai.classes.includes(c) || (c === "Conflicting" && ai.conflicts.length > 0)
                    return (
                      <Badge
                        key={c}
                        variant="outline"
                        title={CLASS_HELP[c]}
                        className={cn("text-[10px]", active ? CLASS_STYLE[c] : "border-dashed text-muted-foreground/60")}
                      >
                        {c}
                      </Badge>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Advisory only. Classification assists the reviewer; it never approves or blocks a merge.
                </p>
              </div>

              <Separator />

              <AnalysisList title="Material changes">
                {ai.material.length === 0 && <Empty>None detected.</Empty>}
                {ai.material.map((m) => (
                  <li key={m.text} className="flex flex-col gap-1 rounded-md border border-border p-2.5">
                    <span className="text-sm">{m.text}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px]", CLASS_STYLE[m.cls])}>
                        {m.cls}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        confidence {Math.round(m.confidence * 100)}%
                      </span>
                    </span>
                  </li>
                ))}
              </AnalysisList>

              <AnalysisList title="Editorial-only">
                {ai.editorial.length === 0 && <Empty>None.</Empty>}
                {ai.editorial.map((e) => (
                  <li key={e} className="text-sm text-muted-foreground">
                    {e}
                  </li>
                ))}
              </AnalysisList>

              <AnalysisList title="Potential conflicts">
                {ai.conflicts.length === 0 && <Empty>No contradictions with other canonical sections.</Empty>}
                {ai.conflicts.map((c) => (
                  <li key={c} className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    {c}
                  </li>
                ))}
              </AnalysisList>

              <AnalysisList title="Downstream impact on merge">
                {ai.downstream.length === 0 && <Empty>No dependent sections.</Empty>}
                {ai.downstream.map((d) => (
                  <li key={d.section} className="flex flex-col gap-0.5 text-sm">
                    <span className="font-medium">{d.section} → Potentially Stale</span>
                    <span className="text-xs text-muted-foreground">{d.reason}</span>
                  </li>
                ))}
              </AnalysisList>

              <Separator />

              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision</h3>
                <Textarea
                  placeholder="Review comment (required to reject)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={!isOpen || !can("approve")}
                  className="min-h-20 text-sm"
                />
                <Button
                  variant="outline"
                  disabled={!isOpen || !can("approve") || comment.trim().length === 0}
                  onClick={() => {
                    rejectChangeSet(cs.id, comment.trim())
                    setComment("")
                  }}
                >
                  <XCircle data-icon="inline-start" />
                  Reject with comment
                </Button>
                {!can("approve") && (
                  <p className="text-xs text-muted-foreground">Your role cannot approve or reject Change Sets.</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  )
}

function DiffPane({ label, html }: { label: string; html: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground">{label}</div>
      <div className="prose-editor px-5 py-4 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function AnalysisList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="text-xs text-muted-foreground">{children}</li>
}
