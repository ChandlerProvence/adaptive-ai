import type { Catalog, CatalogRecord, InsertBody, VersionRef, WorkflowBody, WorkflowNode, WorkflowOverrides } from "./types.ts"

export class VersioningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VersioningError"
  }
}

export function versionLabel(version: number): string {
  return `v.${version}`
}

export function sameRef(a: VersionRef, b: VersionRef): boolean {
  return a.id === b.id && a.version === b.version
}

export function getRecord(catalog: Catalog, ref: VersionRef): CatalogRecord {
  const found = catalog.records.find((record) => record.id === ref.id && record.version === ref.version)
  if (!found) {
    throw new VersioningError(`No catalog record ${ref.id} ${versionLabel(ref.version)}`)
  }
  return found
}

export function recordsFor(catalog: Catalog, id: string): CatalogRecord[] {
  return catalog.records.filter((record) => record.id === id).sort((a, b) => a.version - b.version)
}

function nextVersion(catalog: Catalog, id: string): number {
  const versions = recordsFor(catalog, id)
  if (!versions.length) throw new VersioningError(`Cannot fork unknown catalog id ${id}`)
  return versions[versions.length - 1].version + 1
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mergeNode(node: WorkflowNode, patch: Partial<WorkflowNode>): WorkflowNode {
  const merged: WorkflowNode = { ...node, ...patch }
  if (merged.parentNodeId === "") delete merged.parentNodeId
  return merged
}

function applyNodePatches(nodes: WorkflowNode[], patches: WorkflowOverrides["nodes"]): WorkflowNode[] {
  if (!patches) return nodes
  const patched = nodes.map((node) => {
    const patch = patches[node.id]
    return patch ? mergeNode(node, patch) : node
  })
  for (const [id, patch] of Object.entries(patches)) {
    if (!patch || patched.some((node) => node.id === id) || patch.title === undefined) continue
    patched.push(mergeNode({ id, title: patch.title, executable: patch.executable ?? true }, patch))
  }
  return patched
}

function sameNodeRef(a?: VersionRef, b?: VersionRef): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.id === b.id && a.version === b.version
}

/** Structural and binding changes between two materialized node lists. A removed node is stored as enabled: false. */
export function workflowNodeDelta(base: WorkflowNode[], next: WorkflowNode[]): NonNullable<WorkflowOverrides["nodes"]> {
  const patches: NonNullable<WorkflowOverrides["nodes"]> = {}
  const baseById = new Map(base.map((node) => [node.id, node]))
  for (const node of next) {
    const previous = baseById.get(node.id)
    if (!previous) {
      const { id, ...rest } = node
      patches[id] = rest
      continue
    }
    const patch: Partial<WorkflowNode> = {}
    if (node.title !== previous.title) patch.title = node.title
    if (node.executable !== previous.executable) patch.executable = node.executable
    if ((node.parentNodeId ?? "") !== (previous.parentNodeId ?? "")) patch.parentNodeId = node.parentNodeId ?? ""
    if ((node.enabled ?? true) !== (previous.enabled ?? true)) patch.enabled = node.enabled ?? true
    if (!sameNodeRef(node.task, previous.task) && node.task) patch.task = node.task
    if (!sameNodeRef(node.purpose, previous.purpose) && node.purpose) patch.purpose = node.purpose
    if (!sameNodeRef(node.prompt, previous.prompt) && node.prompt) patch.prompt = node.prompt
    if (!sameNodeRef(node.artifactSchema, previous.artifactSchema) && node.artifactSchema) patch.artifactSchema = node.artifactSchema
    if (!sameNodeRef(node.llm, previous.llm) && node.llm) patch.llm = node.llm
    if (JSON.stringify(node.inserts ?? []) !== JSON.stringify(previous.inserts ?? [])) patch.inserts = node.inserts ?? []
    if (JSON.stringify(node.dependencies ?? []) !== JSON.stringify(previous.dependencies ?? [])) patch.dependencies = node.dependencies ?? []
    if (JSON.stringify(node.upstream ?? []) !== JSON.stringify(previous.upstream ?? [])) patch.upstream = node.upstream ?? []
    if (!sameNodeRef(node.workflow, previous.workflow) && node.workflow) patch.workflow = node.workflow
    if ((node.evidenceRequirement ?? "") !== (previous.evidenceRequirement ?? "")) patch.evidenceRequirement = node.evidenceRequirement
    if ((node.detail ?? "") !== (previous.detail ?? "")) patch.detail = node.detail
    if (Object.keys(patch).length) patches[node.id] = patch
  }
  for (const previous of base) {
    if (!next.some((node) => node.id === previous.id)) patches[previous.id] = { enabled: false }
  }
  return patches
}

export interface WorkflowIssue {
  nodeId: string
  message: string
}

/** An executable node needs a task. Every parent and dependency must name an active node. */
export function validateWorkflow(body: WorkflowBody): WorkflowIssue[] {
  const active = body.nodes.filter((node) => node.enabled !== false)
  const ids = new Set(active.map((node) => node.id))
  const issues: WorkflowIssue[] = []
  for (const node of active) {
    if (node.executable && !node.task) issues.push({ nodeId: node.id, message: `${node.title} is executable and needs a published task.` })
    if (node.parentNodeId && !ids.has(node.parentNodeId)) {
      issues.push({ nodeId: node.id, message: `${node.title} is nested under ${node.parentNodeId}, which is not an active node.` })
    }
    for (const dependency of node.dependencies ?? []) {
      if (!ids.has(dependency)) {
        issues.push({ nodeId: node.id, message: `${node.title} depends on ${dependency}, which is not an active node in this schema.` })
      }
    }
  }
  return issues
}

/** Merge a fork delta onto a materialized body. Arrays are replaced. Workflow nodes are patched by id. */
export function applyOverrides<T>(body: T, overrides: unknown): T {
  if (overrides === undefined) return body
  if (Array.isArray(body) || Array.isArray(overrides) || !isPlainObject(body) || !isPlainObject(overrides)) {
    return clone(overrides) as T
  }
  const source = body as Record<string, unknown>
  const next: Record<string, unknown> = { ...source }
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "nodes" && Array.isArray(source.nodes) && isPlainObject(value)) {
      next.nodes = applyNodePatches(source.nodes as WorkflowNode[], value as WorkflowOverrides["nodes"])
      continue
    }
    const current = source[key]
    if (isPlainObject(current) && isPlainObject(value)) {
      next[key] = applyOverrides(current, value)
    } else {
      next[key] = clone(value)
    }
  }
  return next as T
}

export function materialize<T>(catalog: Catalog, ref: VersionRef): T {
  const chain: CatalogRecord[] = []
  const seen = new Set<string>()
  let current: VersionRef | undefined = ref
  while (current) {
    const key = `${current.id}@${current.version}`
    if (seen.has(key)) throw new VersioningError(`Version cycle at ${key}`)
    seen.add(key)
    const record = getRecord(catalog, current)
    chain.push(record)
    current = record.forkedFrom
  }
  chain.reverse()
  const root = chain[0]
  if (root.body === undefined) {
    throw new VersioningError(`${root.id} ${versionLabel(root.version)} has no body`)
  }
  let value = clone(root.body) as T
  for (const record of chain) {
    value = applyOverrides(value, record.overrides)
  }
  return value
}

export function withRecord(catalog: Catalog, record: CatalogRecord): Catalog {
  return {
    records: [...catalog.records.filter((item) => !(item.id === record.id && item.version === record.version)), clone(record)],
  }
}

/**
 * A user modification of a published version creates the next version.
 * The parent stays unchanged. The new record stores the delta only.
 */
export function forkVersion(catalog: Catalog, ref: VersionRef, overrides: CatalogRecord["overrides"]): Catalog {
  const parent = getRecord(catalog, ref)
  if (parent.status !== "published") {
    throw new VersioningError(`Fork ${parent.id} from a published version. ${versionLabel(parent.version)} is ${parent.status}.`)
  }
  const record = {
    id: parent.id,
    version: nextVersion(catalog, parent.id),
    kind: parent.kind,
    name: parent.name,
    status: "draft" as const,
    forkedFrom: { id: parent.id, version: parent.version },
    overrides: clone(overrides),
  } as CatalogRecord
  return withRecord(catalog, record)
}

function workflowDraftId(catalog: Catalog, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "workflow"
  let id = `workflow.${slug}`
  let suffix = 2
  while (catalog.records.some((record) => record.id === id)) {
    id = `workflow.${slug}_${suffix}`
    suffix += 1
  }
  return id
}

/** A new workflow schema. It has its own id, starts at v.0, and does not fork a published schema. */
export function createWorkflowDraft(catalog: Catalog, name: string): { catalog: Catalog; ref: VersionRef } {
  const trimmed = name.trim()
  if (!trimmed) throw new VersioningError("A workflow schema needs a name.")
  const id = workflowDraftId(catalog, trimmed)
  const record = {
    kind: "workflow" as const,
    id,
    version: 0,
    name: trimmed,
    status: "draft" as const,
    body: { defaults: {}, nodes: [] },
  }
  return { catalog: withRecord(catalog, record), ref: { id, version: 0 } }
}

const INSERT_CATEGORIES = ["analysis", "comparison", "validation", "enhancement", "transformation"] as const
const INSERT_MODES = ["pre", "in", "post"] as const

export interface InsertDraftInput {
  name: string
  summary: string
  category: InsertBody["category"]
  executionMode: InsertBody["executionMode"]
  prompt?: VersionRef
  artifactSchema?: VersionRef
}

/** A new custom insert. It has its own id, starts as draft v.0, and does not fork a published insert. */
export function createInsertDraft(catalog: Catalog, input: InsertDraftInput): { catalog: Catalog; ref: VersionRef } {
  const name = input.name.trim()
  if (!name) throw new VersioningError("A custom insert needs a name.")
  const summary = input.summary.trim()
  if (!summary) throw new VersioningError("A custom insert needs a summary.")
  if (!INSERT_CATEGORIES.includes(input.category)) throw new VersioningError("Choose an insert category.")
  if (!INSERT_MODES.includes(input.executionMode)) throw new VersioningError("Choose when the insert runs.")
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "insert"
  let id = `insert.${slug}`
  let suffix = 2
  while (catalog.records.some((record) => record.id === id)) {
    id = `insert.${slug}_${suffix}`
    suffix += 1
  }
  const body: InsertBody = { category: input.category, executionMode: input.executionMode, summary }
  if (input.prompt) body.prompt = input.prompt
  if (input.artifactSchema) body.artifactSchema = input.artifactSchema
  const record = {
    kind: "custom_insert" as const,
    id,
    version: 0,
    name,
    status: "draft" as const,
    body,
  }
  return { catalog: withRecord(catalog, record), ref: { id, version: 0 } }
}

export type CatalogDraftKind = "task" | "purpose" | "prompt" | "artifact_schema"

const DRAFT_PREFIX: Record<CatalogDraftKind, string> = {
  task: "task",
  purpose: "purpose",
  prompt: "prompt",
  artifact_schema: "schema",
}

function uniqueRecordId(catalog: Catalog, prefix: string, name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || prefix
  let id = `${prefix}.${slug}`
  let suffix = 2
  while (catalog.records.some((record) => record.id === id)) {
    id = `${prefix}.${slug}_${suffix}`
    suffix += 1
  }
  return id
}

function draftText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function draftLines(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function draftRef(value: unknown): VersionRef | undefined {
  if (!value || typeof value !== "object") return undefined
  const ref = value as Partial<VersionRef>
  if (!ref.id || typeof ref.version !== "number") return undefined
  return { id: ref.id, version: ref.version }
}

/** A new task, purpose, prompt, or artifact schema. It has its own id, starts as draft v.0, and does not fork a published record. */
export function createCatalogDraft(
  catalog: Catalog,
  kind: CatalogDraftKind,
  input: { name: string; body: Record<string, unknown> },
): { catalog: Catalog; ref: VersionRef } {
  const name = input.name.trim()
  if (!name) throw new VersioningError("A catalog record needs a name.")
  const source = input.body
  let body: Record<string, unknown>
  if (kind === "task") {
    const summary = draftText(source.summary)
    if (!summary) throw new VersioningError("A task needs a summary.")
    body = { summary, requiredInputs: draftLines(source.requiredInputs) }
    const prompt = draftRef(source.prompt)
    const artifactSchema = draftRef(source.artifactSchema)
    const llm = draftRef(source.llm)
    if (prompt) body.prompt = prompt
    if (artifactSchema) body.artifactSchema = artifactSchema
    if (llm) body.llm = llm
  } else if (kind === "purpose") {
    const summary = draftText(source.summary)
    if (!summary) throw new VersioningError("A purpose needs a summary.")
    body = {
      summary,
      audience: draftText(source.audience),
      tone: draftText(source.tone),
      evidenceRequirement: draftText(source.evidenceRequirement),
      riskTolerance: draftText(source.riskTolerance),
      detail: draftText(source.detail),
    }
  } else if (kind === "prompt") {
    const instructions = draftText(source.instructions)
    if (!instructions) throw new VersioningError("A prompt needs instructions.")
    body = {
      role: draftText(source.role),
      objective: draftText(source.objective),
      instructions,
      constraints: draftText(source.constraints),
      output: draftText(source.output),
    }
  } else {
    const summary = draftText(source.summary)
    if (!summary) throw new VersioningError("An artifact schema needs a summary.")
    body = { summary, requiredSections: draftLines(source.requiredSections) }
  }
  const id = uniqueRecordId(catalog, DRAFT_PREFIX[kind], name)
  const record = { kind, id, version: 0, name, status: "draft" as const, body } as CatalogRecord
  return { catalog: withRecord(catalog, record), ref: { id, version: 0 } }
}

/** A root draft stores the whole schema in its body. A fork stores only the delta. */
export function saveRootWorkflowDraft(catalog: Catalog, ref: VersionRef, overrides: WorkflowOverrides): Catalog {
  const record = getRecord(catalog, ref)
  if (record.kind !== "workflow") throw new VersioningError(`${ref.id} is not a workflow`)
  if (record.forkedFrom) throw new VersioningError("A forked workflow stores only its delta.")
  if (record.status === "published" || record.status === "deprecated") {
    throw new VersioningError(`${record.id} ${versionLabel(record.version)} is ${record.status} and cannot be edited`)
  }
  const current = materialize<WorkflowBody>(catalog, ref)
  return withRecord(catalog, {
    ...record,
    body: {
      defaults: overrides.defaults ? { ...current.defaults, ...overrides.defaults } : current.defaults,
      nodes: applyNodePatches(current.nodes, overrides.nodes),
    },
    overrides: undefined,
  } as CatalogRecord)
}

/** Drafts accept further edits. Published versions do not. */
export function editDraft(catalog: Catalog, ref: VersionRef, overrides: CatalogRecord["overrides"]): Catalog {
  const record = getRecord(catalog, ref)
  if (record.status === "published" || record.status === "deprecated") {
    throw new VersioningError(`${record.id} ${versionLabel(record.version)} is ${record.status} and cannot be edited`)
  }
  return withRecord(catalog, { ...record, overrides: clone(overrides) } as CatalogRecord)
}

/** Fields that differ from the parent body. Nested objects store only their changed keys. Arrays are replaced. */
export function recordDelta(base: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const overrides: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
    const current = base[key]
    const value = next[key]
    if (JSON.stringify(current) === JSON.stringify(value)) continue
    if (isPlainObject(current) && isPlainObject(value)) {
      const nested = recordDelta(current, value)
      if (Object.keys(nested).length) overrides[key] = nested
      continue
    }
    if (value !== undefined) overrides[key] = clone(value)
  }
  return overrides
}

/**
 * Save a catalog edit. A published record stays unchanged and the save becomes the next draft.
 * A draft stores only its delta from the parent. A workflow schema is saved from the workflow editor.
 */
export function saveCatalogEdit(
  catalog: Catalog,
  ref: VersionRef,
  next: { name: string; body: Record<string, unknown> },
): { catalog: Catalog; ref: VersionRef } {
  const record = getRecord(catalog, ref)
  if (record.kind === "workflow") {
    throw new VersioningError("Save a workflow schema from the workflow editor.")
  }
  if (record.status === "deprecated") {
    throw new VersioningError(`${record.id} ${versionLabel(record.version)} is deprecated and cannot be edited`)
  }
  const name = next.name.trim()
  if (!name) throw new VersioningError("A catalog record needs a name.")
  if ((record.status === "draft" || record.status === "validated") && !record.forkedFrom) {
    return { catalog: withRecord(catalog, { ...record, name, body: next.body, overrides: undefined } as CatalogRecord), ref }
  }
  const parentRef = record.status === "draft" && record.forkedFrom ? record.forkedFrom : ref
  const overrides = recordDelta(materialize<Record<string, unknown>>(catalog, parentRef), next.body)
  if (record.status === "published") {
    if (!Object.keys(overrides).length && name === record.name) throw new VersioningError("No changes to save.")
    const drafted = forkVersion(catalog, ref, overrides as CatalogRecord["overrides"])
    const created = recordsFor(drafted, ref.id).at(-1)
    if (!created) throw new VersioningError(`Fork of ${ref.id} was not created`)
    const saved = { id: created.id, version: created.version }
    return { catalog: withRecord(drafted, { ...created, name }), ref: saved }
  }
  const edited = editDraft(catalog, ref, overrides as CatalogRecord["overrides"])
  return { catalog: withRecord(edited, { ...getRecord(edited, ref), name }), ref }
}

export function publishVersion(catalog: Catalog, ref: VersionRef): Catalog {
  const record = getRecord(catalog, ref)
  if (record.status === "deprecated") {
    throw new VersioningError(`${record.id} ${versionLabel(record.version)} is deprecated`)
  }
  return withRecord(catalog, { ...record, status: "published" } as CatalogRecord)
}

export function workflowBody(catalog: Catalog, ref: VersionRef): WorkflowBody {
  const record = getRecord(catalog, ref)
  if (record.kind !== "workflow") throw new VersioningError(`${ref.id} is not a workflow`)
  return materialize<WorkflowBody>(catalog, ref)
}
