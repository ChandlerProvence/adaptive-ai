/** Configuration versions start at v.0. A published version is immutable. A user modification is a new version that stores only its delta. */

export type Lifecycle = "draft" | "validated" | "published" | "deprecated"

export type CatalogKind =
  | "context"
  | "task"
  | "purpose"
  | "prompt"
  | "artifact_schema"
  | "custom_insert"
  | "workflow"
  | "llm"

export interface VersionRef {
  id: string
  version: number
}

export interface RecordBase {
  id: string
  version: number
  name: string
  status: Lifecycle
  /** Published version this record was forked from. Absent on a root version. */
  forkedFrom?: VersionRef
}

/** Outline stored beside an area name so the same shape can be shown again. */
export type AreaGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] }

export interface ContextBody {
  contextType: "mission" | "customer" | "project" | "system" | "incident" | "research" | "opportunity"
  statement: string
  /** Standing organization this context describes. Efforts inherit it. */
  organization: string
  /** Standing time window. An effort replaces it when the effort names its own window. */
  timeWindow: string
  knownConstraints: string[]
  /** Command guidance every effort in this context inherits. */
  standingGuidance?: string
  /** Evidence rule every product in this context inherits. */
  evidenceStandard?: string
  /** Geography belongs on an effort. A context may still carry a standing area an effort inherits. */
  areaOfInterest?: string
  areaOfResponsibility?: string
  /** Present when the area name came from countries or a drawn outline. */
  areaOfInterestGeometry?: AreaGeometry
  areaOfResponsibilityGeometry?: AreaGeometry
}

/** A product this step needs from a step in another workflow schema. */
export interface UpstreamRef {
  workflow: VersionRef
  nodeId: string
}

export interface TaskBody {
  summary: string
  prompt: VersionRef
  artifactSchema: VersionRef
  llm: VersionRef
  requiredInputs: string[]
}

export interface PurposeBody {
  summary: string
  audience: string
  tone: string
  evidenceRequirement: string
  riskTolerance: string
  detail: string
}

export interface PromptBody {
  role: string
  objective: string
  instructions: string
  constraints: string
  output: string
}

export interface ArtifactSchemaBody {
  summary: string
  requiredSections: string[]
  /** Repo-relative path of the JSON Schema document, when one was imported. */
  sourceFile?: string
  /** The JSON Schema document. Loaded with the catalog so a run can validate an artifact. */
  document?: Record<string, unknown>
}

export type InsertMode = "pre" | "in" | "post"

export interface InsertBody {
  category: "analysis" | "comparison" | "validation" | "enhancement" | "transformation"
  executionMode: InsertMode
  summary: string
  prompt?: VersionRef
  artifactSchema?: VersionRef
}

export interface LlmBody {
  provider: string
  baseUrl: string
  apiKeyEnv: string
  apiKeyHeader: string
  model: string
  temperature: number
  embeddingModel: string
}

export interface WorkflowNode {
  id: string
  title: string
  parentNodeId?: string
  executable: boolean
  /** Absent or true means the node is in the workflow. False keeps the parent node and drops this one from the effective schema. */
  enabled?: boolean
  task?: VersionRef
  purpose?: VersionRef
  prompt?: VersionRef
  artifactSchema?: VersionRef
  llm?: VersionRef
  inserts?: VersionRef[]
  dependencies?: string[]
  /** Steps in other workflow schemas whose products this step consumes. */
  upstream?: UpstreamRef[]
  /** When set, this node is a phase of a larger schema and binds that phase's published workflow. */
  workflow?: VersionRef
  evidenceRequirement?: string
  detail?: string
}

export interface WorkflowDefaults {
  llm?: VersionRef
  purpose?: VersionRef
  evidenceRequirement?: string
  detail?: string
}

export interface WorkflowBody {
  defaults: WorkflowDefaults
  nodes: WorkflowNode[]
}

/** Node patches are keyed by node id so a fork does not copy the whole workflow. */
export interface WorkflowOverrides {
  defaults?: Partial<WorkflowDefaults>
  nodes?: Record<string, Partial<Omit<WorkflowNode, "id">>>
}

export type CatalogRecord =
  | (RecordBase & { kind: "context"; body?: ContextBody; overrides?: Partial<ContextBody> })
  | (RecordBase & { kind: "task"; body?: TaskBody; overrides?: Partial<TaskBody> })
  | (RecordBase & { kind: "purpose"; body?: PurposeBody; overrides?: Partial<PurposeBody> })
  | (RecordBase & { kind: "prompt"; body?: PromptBody; overrides?: Partial<PromptBody> })
  | (RecordBase & { kind: "artifact_schema"; body?: ArtifactSchemaBody; overrides?: Partial<ArtifactSchemaBody> })
  | (RecordBase & { kind: "custom_insert"; body?: InsertBody; overrides?: Partial<InsertBody> })
  | (RecordBase & { kind: "workflow"; body?: WorkflowBody; overrides?: WorkflowOverrides })
  | (RecordBase & { kind: "llm"; body?: LlmBody; overrides?: Partial<LlmBody> })

export interface Catalog {
  records: CatalogRecord[]
}

export const PRECEDENCE_LAYERS = [
  "system_defaults",
  "workflow_defaults",
  "parent_node",
  "task_profile",
  "purpose_profile",
  "workflow_node",
  "custom_schema",
  "runtime_user",
] as const

export type PrecedenceLayer = (typeof PRECEDENCE_LAYERS)[number]

export const PRECEDENCE_LAYER_LABELS: Record<PrecedenceLayer, string> = {
  system_defaults: "System defaults",
  workflow_defaults: "Workflow schema defaults",
  parent_node: "Parent node defaults",
  task_profile: "Task profile",
  purpose_profile: "Purpose profile",
  workflow_node: "Workflow node overrides",
  custom_schema: "Custom schema overrides",
  runtime_user: "Runtime user overrides",
}

export interface Framing {
  audience: string
  tone: string
  evidenceRequirement: string
  riskTolerance: string
  detail: string
}

export interface FieldProvenance {
  field: string
  layer: PrecedenceLayer
  display: string
}

export interface ResolvedNode {
  workflow: VersionRef
  parentWorkflow?: VersionRef
  context: VersionRef
  contextBody: ContextBody
  nodeId: string
  nodeTitle: string
  task: VersionRef
  purpose: VersionRef
  prompt: VersionRef
  artifactSchema: VersionRef
  llm: VersionRef
  inserts: VersionRef[]
  dependencies: string[]
  framing: Framing
  promptBody: PromptBody
  llmBody: LlmBody
  runtimeInstruction?: string
  provenance: FieldProvenance[]
}

export interface RuntimeManifest {
  id: string
  workflow: VersionRef
  parentWorkflow?: VersionRef
  context: VersionRef
  nodeId: string
  nodeTitle: string
  task: VersionRef
  purpose: VersionRef
  prompt: VersionRef
  artifactSchema: VersionRef
  llm: VersionRef
  inserts: VersionRef[]
  dependencies: string[]
  framing: Framing
  promptBody: PromptBody
  model: string
  temperature: number
  runtimeInstruction?: string
  provenance: FieldProvenance[]
}
