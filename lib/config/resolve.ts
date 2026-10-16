import type {
  Catalog,
  FieldProvenance,
  Framing,
  LlmBody,
  PrecedenceLayer,
  PromptBody,
  PurposeBody,
  ResolvedNode,
  TaskBody,
  VersionRef,
  WorkflowNode,
} from "./types.ts"
import { getRecord, materialize, workflowBody } from "./versioning.ts"

export interface RuntimeOverrides {
  instruction?: string
  audience?: string
  tone?: string
  evidenceRequirement?: string
  riskTolerance?: string
  detail?: string
}

export interface ResolveInput {
  catalog: Catalog
  workflow: VersionRef
  nodeId: string
  context: VersionRef
  runtime?: RuntimeOverrides
}

interface Bag {
  task?: VersionRef
  purpose?: VersionRef
  prompt?: VersionRef
  artifactSchema?: VersionRef
  llm?: VersionRef
  inserts?: VersionRef[]
  dependencies?: string[]
  audience?: string
  tone?: string
  evidenceRequirement?: string
  riskTolerance?: string
  detail?: string
  runtimeInstruction?: string
}

const SYSTEM_FRAMING: Framing = {
  audience: "Decision maker",
  tone: "Analytical, neutral",
  evidenceRequirement: "Supporting sources required",
  riskTolerance: "Moderate",
  detail: "Standard",
}

function refLabel(ref: VersionRef): string {
  return `${ref.id} v.${ref.version}`
}

function setField(bag: Bag, provenance: FieldProvenance[], layer: PrecedenceLayer, field: keyof Bag, value: Bag[keyof Bag], display: string) {
  if (value === undefined) return
  ;(bag[field] as Bag[keyof Bag]) = value
  const index = provenance.findIndex((item) => item.field === field)
  const next = { field, layer, display }
  if (index >= 0) provenance[index] = next
  else provenance.push(next)
}

function applyFraming(bag: Bag, provenance: FieldProvenance[], layer: PrecedenceLayer, framing: Partial<Framing>) {
  for (const field of ["audience", "tone", "evidenceRequirement", "riskTolerance", "detail"] as const) {
    const value = framing[field]
    if (value !== undefined) setField(bag, provenance, layer, field, value, value)
  }
}

function nodePatch(node: WorkflowNode | undefined, bag: Bag, provenance: FieldProvenance[], layer: PrecedenceLayer) {
  if (!node) return
  if (node.task) setField(bag, provenance, layer, "task", node.task, refLabel(node.task))
  if (node.purpose) setField(bag, provenance, layer, "purpose", node.purpose, refLabel(node.purpose))
  if (node.prompt) setField(bag, provenance, layer, "prompt", node.prompt, refLabel(node.prompt))
  if (node.artifactSchema) setField(bag, provenance, layer, "artifactSchema", node.artifactSchema, refLabel(node.artifactSchema))
  if (node.llm) setField(bag, provenance, layer, "llm", node.llm, refLabel(node.llm))
  if (node.inserts) setField(bag, provenance, layer, "inserts", node.inserts, node.inserts.map(refLabel).join(", ") || "none")
  if (node.dependencies) setField(bag, provenance, layer, "dependencies", node.dependencies, node.dependencies.join(", ") || "none")
  applyFraming(bag, provenance, layer, {
    evidenceRequirement: node.evidenceRequirement,
    detail: node.detail,
  })
}

function requireRef(bag: Bag, field: keyof Bag, nodeId: string): VersionRef {
  const value = bag[field]
  if (!value || Array.isArray(value) || typeof value === "string") {
    throw new Error(`Node ${nodeId} did not resolve ${field}`)
  }
  return value
}

/**
 * Resolve one workflow node.
 * Context is an input, pinned on the result, and is not an override layer.
 * Later precedence layers replace earlier values.
 */
export function resolveNode(input: ResolveInput): ResolvedNode {
  const workflowRecord = getRecord(input.catalog, input.workflow)
  if (workflowRecord.kind !== "workflow") throw new Error(`${input.workflow.id} is not a workflow`)
  const contextRecord = getRecord(input.catalog, input.context)
  if (contextRecord.kind !== "context") throw new Error(`${input.context.id} is not a context profile`)

  const body = workflowBody(input.catalog, input.workflow)
  const baseBody = workflowRecord.forkedFrom ? workflowBody(input.catalog, workflowRecord.forkedFrom) : body
  const node = body.nodes.find((item) => item.id === input.nodeId)
  const baseNode = baseBody.nodes.find((item) => item.id === input.nodeId)
  if (!node || node.enabled === false) throw new Error(`Workflow ${input.workflow.id} has no node ${input.nodeId}`)
  const parent = body.nodes.find((item) => item.id === node.parentNodeId && item.enabled !== false)

  const bag: Bag = {}
  const provenance: FieldProvenance[] = []

  applyFraming(bag, provenance, "system_defaults", SYSTEM_FRAMING)

  if (baseBody.defaults.llm) setField(bag, provenance, "workflow_defaults", "llm", baseBody.defaults.llm, refLabel(baseBody.defaults.llm))
  if (baseBody.defaults.purpose) setField(bag, provenance, "workflow_defaults", "purpose", baseBody.defaults.purpose, refLabel(baseBody.defaults.purpose))
  applyFraming(bag, provenance, "workflow_defaults", {
    evidenceRequirement: baseBody.defaults.evidenceRequirement,
    detail: baseBody.defaults.detail,
  })

  nodePatch(parent, bag, provenance, "parent_node")

  const profileNode = baseNode ?? node
  if (profileNode.task) {
    setField(bag, provenance, "task_profile", "task", profileNode.task, refLabel(profileNode.task))
    const task = materialize<TaskBody>(input.catalog, profileNode.task)
    setField(bag, provenance, "task_profile", "prompt", task.prompt, refLabel(task.prompt))
    setField(bag, provenance, "task_profile", "artifactSchema", task.artifactSchema, refLabel(task.artifactSchema))
    setField(bag, provenance, "task_profile", "llm", task.llm, refLabel(task.llm))
  }

  if (bag.purpose) {
    const purpose = materialize<PurposeBody>(input.catalog, bag.purpose)
    applyFraming(bag, provenance, "purpose_profile", purpose)
  }

  if (baseNode) nodePatch(baseNode, bag, provenance, "workflow_node")
  else {
    nodePatch(node, bag, provenance, "custom_schema")
    if (bag.purpose) {
      const purpose = materialize<PurposeBody>(input.catalog, bag.purpose)
      applyFraming(bag, provenance, "purpose_profile", purpose)
    }
  }

  if (workflowRecord.forkedFrom && baseNode) {
    const custom = body.nodes.find((item) => item.id === input.nodeId)
    const changed: Partial<WorkflowNode> = {}
    if (custom?.prompt && !same(custom.prompt, baseNode.prompt)) changed.prompt = custom.prompt
    if (custom?.task && !same(custom.task, baseNode.task)) changed.task = custom.task
    if (custom?.purpose && !same(custom.purpose, baseNode.purpose)) changed.purpose = custom.purpose
    if (custom?.artifactSchema && !same(custom.artifactSchema, baseNode.artifactSchema)) changed.artifactSchema = custom.artifactSchema
    if (custom?.llm && !same(custom.llm, baseNode.llm)) changed.llm = custom.llm
    if (custom?.inserts && JSON.stringify(custom.inserts) !== JSON.stringify(baseNode.inserts)) changed.inserts = custom.inserts
    if (custom?.dependencies && JSON.stringify(custom.dependencies) !== JSON.stringify(baseNode.dependencies)) {
      changed.dependencies = custom.dependencies
    }
    nodePatch(changed as WorkflowNode, bag, provenance, "custom_schema")
    if (changed.task) {
      const task = materialize<TaskBody>(input.catalog, changed.task)
      setField(bag, provenance, "custom_schema", "prompt", task.prompt, refLabel(task.prompt))
      setField(bag, provenance, "custom_schema", "artifactSchema", task.artifactSchema, refLabel(task.artifactSchema))
      setField(bag, provenance, "custom_schema", "llm", task.llm, refLabel(task.llm))
    }
  }

  const runtime = input.runtime
  if (runtime) {
    applyFraming(bag, provenance, "runtime_user", runtime)
    if (runtime.instruction) setField(bag, provenance, "runtime_user", "runtimeInstruction", runtime.instruction, runtime.instruction)
  }

  const task = requireRef(bag, "task", input.nodeId)
  const purpose = requireRef(bag, "purpose", input.nodeId)
  const prompt = requireRef(bag, "prompt", input.nodeId)
  const artifactSchema = requireRef(bag, "artifactSchema", input.nodeId)
  const llm = requireRef(bag, "llm", input.nodeId)

  return {
    workflow: input.workflow,
    parentWorkflow: workflowRecord.forkedFrom,
    context: input.context,
    contextBody: materialize(input.catalog, input.context),
    nodeId: node.id,
    nodeTitle: node.title,
    task,
    purpose,
    prompt,
    artifactSchema,
    llm,
    inserts: bag.inserts ?? [],
    dependencies: bag.dependencies ?? [],
    framing: {
      audience: bag.audience ?? SYSTEM_FRAMING.audience,
      tone: bag.tone ?? SYSTEM_FRAMING.tone,
      evidenceRequirement: bag.evidenceRequirement ?? SYSTEM_FRAMING.evidenceRequirement,
      riskTolerance: bag.riskTolerance ?? SYSTEM_FRAMING.riskTolerance,
      detail: bag.detail ?? SYSTEM_FRAMING.detail,
    },
    promptBody: materialize<PromptBody>(input.catalog, prompt),
    llmBody: materialize<LlmBody>(input.catalog, llm),
    runtimeInstruction: bag.runtimeInstruction,
    provenance,
  }
}

function same(a?: VersionRef, b?: VersionRef): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.id === b.id && a.version === b.version
}
