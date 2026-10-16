import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  ArrowDownToLine,
  Pencil,
  Sparkles,
  TriangleAlert,
  GitBranch,
  CircleCheck,
  Clock,
} from "lucide-react"
import type { BadgeKind, SectionState } from "@/lib/mock-data"

// Status color language is defined by the product spec:
// green = canonical/current/validated, amber = stale/warning,
// purple = AI-specific, blue = primary/info, red = conflict/destructive.

const badgeStyles: Record<BadgeKind, { label: string; cls: string; Icon: typeof Pencil }> = {
  inherited: { label: "Inherited", cls: "bg-muted text-muted-foreground border-border", Icon: ArrowDownToLine },
  overridden: { label: "Overridden", cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Pencil },
  custom: { label: "Custom", cls: "bg-violet-50 text-violet-700 border-violet-200", Icon: Sparkles },
  warning: { label: "Warning", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: TriangleAlert },
  dependency: { label: "Dependency", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: GitBranch },
}

export function InheritanceBadge({ kind, className }: { kind: BadgeKind; className?: string }) {
  const { label, cls, Icon } = badgeStyles[kind]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        cls,
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

const sectionStateStyles: Record<SectionState, { cls: string; Icon: typeof Clock; label: string }> = {
  Current: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CircleCheck, label: "Current" },
  "Working Changes": { cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Pencil, label: "Working Changes" },
  "Change Set Open": { cls: "bg-violet-50 text-violet-700 border-violet-200", Icon: GitBranch, label: "Change Set Open" },
  "Potentially Stale": { cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: TriangleAlert, label: "Potentially Stale" },
}

export function SectionStateBadge({ state, className }: { state: SectionState; className?: string }) {
  const { cls, Icon, label } = sectionStateStyles[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
        cls,
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

export function StatusDot({ state, className }: { state: SectionState; className?: string }) {
  const color: Record<SectionState, string> = {
    Current: "bg-emerald-500",
    "Working Changes": "bg-blue-500",
    "Change Set Open": "bg-violet-500",
    "Potentially Stale": "bg-amber-500",
  }
  return <span className={cn("inline-block size-2 rounded-full", color[state], className)} />
}

export function CanonicalBadge({ version, className }: { version: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-emerald-200 bg-emerald-50 text-emerald-700", className)}>
      <CircleCheck className="size-3" />
      Canonical {version}
    </Badge>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs", className)}>{children}</span>
}
