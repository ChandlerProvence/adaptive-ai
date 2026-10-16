import { planUnavailableChat, type UnavailableChat } from "./llm.ts"
import { resolveNode } from "./resolve.ts"
import type { ArtifactSchemaBody, Catalog, InsertBody, PurposeBody, ResolvedNode, TaskBody, VersionRef, WorkflowNode } from "./types.ts"
import { getRecord, materialize, workflowBody } from "./versioning.ts"

export interface CompletedStep {
  workflowId: string
  nodeId: string
  title: string
  output: string
}

export interface StepRunResult {
  workflow: VersionRef
  nodeId: string
  title: string
  status: "prepared" | "blocked"
  waitingOn: string[]
  objective: string
  output: string
  chat?: UnavailableChat
}

/** Resolves one step and prepares its model call. A step waits until every dependency has been run. */
export function prepareStepRun(input: {
  catalog: Catalog
  workflow: VersionRef
  nodeId: string
  context: VersionRef
  completed: CompletedStep[]
}): StepRunResult {
  const node = workflowBody(input.catalog, input.workflow).nodes.find((item) => item.id === input.nodeId && item.enabled !== false)
  if (!node) throw new Error(`Workflow ${input.workflow.id} has no node ${input.nodeId}`)
  const resolved = resolveNode({ catalog: input.catalog, workflow: input.workflow, nodeId: input.nodeId, context: input.context })
  const waitingOn = unmetDependencies(input.catalog, input.workflow, node, input.completed)
  if (waitingOn.length) {
    return {
      workflow: input.workflow,
      nodeId: node.id,
      title: node.title,
      status: "blocked",
      waitingOn,
      objective: resolved.promptBody.objective,
      output: `Waiting on ${waitingOn.join(", ")}.`,
    }
  }

  const task = materialize<TaskBody>(input.catalog, resolved.task)
  const schema = materialize<ArtifactSchemaBody>(input.catalog, resolved.artifactSchema)
  const purpose = materialize<PurposeBody>(input.catalog, resolved.purpose)
  const prior = input.completed.filter((item) => dependsOn(input.workflow, node, item))
  const inserts = resolved.inserts
    .map((item) => {
      const record = getRecord(input.catalog, item)
      return record.kind === "custom_insert" ? materialize<InsertBody>(input.catalog, item) : undefined
    })
    .filter((item): item is InsertBody => item !== undefined)
  const chat = planUnavailableChat(resolved.llmBody, composeStepMessages(resolved, task, schema, purpose, prior, inserts))

  return {
    workflow: input.workflow,
    nodeId: node.id,
    title: node.title,
    status: "prepared",
    waitingOn: [],
    objective: resolved.promptBody.objective,
    output: `Triggered ${node.title}. The request is pinned to ${resolved.llmBody.model}. It was not sent: this system has no connection to the model.`,
    chat,
  }
}

/** Fills the inherited prompt contract with the pinned situation, purpose, schema, and prior products. */
export function composeStepMessages(
  resolved: ResolvedNode,
  task: TaskBody,
  schema: ArtifactSchemaBody,
  purpose: PurposeBody,
  prior: CompletedStep[],
  inserts: InsertBody[],
) {
  const situation = resolved.contextBody
  const evidence = prior.length
    ? prior.map((item, index) => `EVIDENCE ${index + 1} — ${item.title}\n${item.output}`).join("\n\n")
    : "No prior step products are pinned. Where the situation does not supply a fact, mark that field insufficient evidence."
  const sections = schema.requiredSections.length ? schema.requiredSections.join(", ") : "the sections named by the artifact schema"
  return [
    {
      role: "system" as const,
      content: [
        resolved.promptBody.role,
        "TASK STANDARD",
        resolved.promptBody.objective,
        resolved.promptBody.constraints,
        resolved.promptBody.instructions,
        "OUTPUT CONTRACT",
        resolved.promptBody.output,
        `Required sections: ${sections}.`,
        schema.summary,
        "PURPOSE PROFILE",
        `Audience: ${purpose.audience}`,
        `Tone: ${purpose.tone}`,
        `Risk tolerance: ${purpose.riskTolerance}`,
        `Detail: ${purpose.detail}`,
        purpose.summary,
        `Evidence rule: ${purpose.evidenceRequirement}`,
      ].join("\n\n"),
    },
    {
      role: "user" as const,
      content: [
        "MISSION CONTEXT",
        `Mission statement: ${situation.statement}`,
        `Organization: ${situation.organization}`,
        situation.areaOfInterest ? `Area of interest: ${situation.areaOfInterest}` : "",
        situation.areaOfResponsibility ? `Area of responsibility: ${situation.areaOfResponsibility}` : "",
        situation.timeWindow ? `Time window: ${situation.timeWindow}` : "",
        situation.standingGuidance ? `Standing guidance: ${situation.standingGuidance}` : "",
        situation.evidenceStandard ? `Evidence standard: ${situation.evidenceStandard}` : "",
        situation.knownConstraints.length ? `Known constraints: ${situation.knownConstraints.join("; ")}` : "",
        "",
        evidence,
        "",
        "PRODUCE",
        task.summary,
        inserts.length ? `Apply these inserts while producing the artifact: ${inserts.map((item) => item.summary).join("\n")}` : "",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    },
  ]
}

/** Runs the given steps in order. Stops at the first step that is still waiting on another step. */
export function preparePhaseRun(input: {
  catalog: Catalog
  workflow: VersionRef
  context: VersionRef
  nodeIds: string[]
  completed: CompletedStep[]
}): StepRunResult[] {
  const done = [...input.completed]
  const results: StepRunResult[] = []
  for (const nodeId of input.nodeIds) {
    if (done.some((item) => item.workflowId === input.workflow.id && item.nodeId === nodeId)) continue
    const result = prepareStepRun({ catalog: input.catalog, workflow: input.workflow, context: input.context, nodeId, completed: done })
    results.push(result)
    if (result.status !== "prepared") break
    done.push({ workflowId: input.workflow.id, nodeId, title: result.title, output: result.output })
  }
  return results
}

function unmetDependencies(catalog: Catalog, workflow: VersionRef, node: WorkflowNode, completed: CompletedStep[]): string[] {
  const waiting: string[] = []
  for (const id of node.dependencies ?? []) {
    if (completed.some((item) => item.workflowId === workflow.id && item.nodeId === id)) continue
    waiting.push(titleIn(catalog, workflow, id))
  }
  for (const upstream of node.upstream ?? []) {
    if (completed.some((item) => item.workflowId === upstream.workflow.id && item.nodeId === upstream.nodeId)) continue
    waiting.push(titleIn(catalog, upstream.workflow, upstream.nodeId))
  }
  return waiting
}

function dependsOn(workflow: VersionRef, node: WorkflowNode, completed: CompletedStep): boolean {
  if ((node.dependencies ?? []).includes(completed.nodeId) && completed.workflowId === workflow.id) return true
  return (node.upstream ?? []).some((item) => item.workflow.id === completed.workflowId && item.nodeId === completed.nodeId)
}

function titleIn(catalog: Catalog, workflow: VersionRef, nodeId: string): string {
  return workflowBody(catalog, workflow).nodes.find((item) => item.id === nodeId)?.title ?? nodeId
}
