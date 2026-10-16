"use client"

import type { DocSection } from "@/lib/mock-data"
import { sectionStateModel } from "@/lib/section-state"
import { cn } from "@/lib/utils"
import { CircleCheck, Pencil, GitBranch, Sparkles, TriangleAlert, Minus } from "lucide-react"

const tone = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  muted: "border-border bg-muted text-muted-foreground",
} as const

function Row({
  label,
  value,
  hint,
  t,
  Icon,
}: {
  label: string
  value: string
  hint: string
  t: keyof typeof tone
  Icon: typeof CircleCheck
}) {
  return (
    <div className="grid grid-cols-[112px_1fr] items-start gap-2 py-1.5">
      <dt className="pt-0.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className={cn("inline-flex w-fit items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", tone[t])}>
          <Icon className="size-3" />
          {value}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
      </dd>
    </div>
  )
}

export function SectionStatePanel({ section }: { section: DocSection }) {
  const m = sectionStateModel(section)
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Section State</p>
      <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
        Five independent states. A section can be canonical, modified, under review, and stale at the same time.
      </p>
      <dl className="divide-y divide-border rounded-md border border-border px-3">
        <Row label="Canonical" value={m.canonical} hint="Last approved baseline" t="green" Icon={CircleCheck} />
        <Row
          label="Working"
          value={m.working}
          hint={m.working === "Modified" ? "Live draft diverges from canonical" : "Draft matches canonical"}
          t={m.working === "Modified" ? "blue" : "muted"}
          Icon={m.working === "Modified" ? Pencil : Minus}
        />
        <Row
          label="Review"
          value={m.review ? `${m.review} submitted` : "None"}
          hint={m.review ? "Immutable snapshot awaiting decision" : "No active Change Set"}
          t={m.review ? "violet" : "muted"}
          Icon={m.review ? GitBranch : Minus}
        />
        <Row
          label="Dependency"
          value={m.dependencyHealth}
          hint={m.staleReasons[0] ?? "All upstream fingerprints match"}
          t={m.dependencyHealth === "Current" ? "green" : "amber"}
          Icon={m.dependencyHealth === "Current" ? CircleCheck : TriangleAlert}
        />
        <Row
          label="Generation"
          value={m.generation}
          hint={section.previousGeneration ? `Supersedes ${section.previousGeneration}` : "Latest AI generation record"}
          t="violet"
          Icon={Sparkles}
        />
      </dl>
    </div>
  )
}
