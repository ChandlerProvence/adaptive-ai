import type { VersionRef } from "./types.ts"

/** A run is a context profile plus the workflow schema version pinned to it. */
export interface Run {
  id: string
  name: string
  summary: string
  context: VersionRef
  workflow: VersionRef
  document: "coa" | "strategic" | "mission"
}

export const RUNS: Run[] = [
  {
    id: "run-mission-planning",
    name: "Mission planning",
    summary: "Joint planning process, pinned to Mission Planning v.0.",
    context: { id: "context.mission_planning", version: 0 },
    workflow: { id: "workflow.mission_planning", version: 0 },
    document: "mission",
  },
]

export function getRun(id: string): Run | undefined {
  return RUNS.find((run) => run.id === id)
}

export function runsForContext(contextId: string): Run[] {
  return RUNS.filter((run) => run.context.id === contextId)
}

export function documentKind(workflowId: string): Run["document"] {
  if (workflowId.startsWith("workflow.coa")) return "coa"
  if (workflowId.includes("strategic")) return "strategic"
  return "mission"
}
