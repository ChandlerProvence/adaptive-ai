// Central mock data + type model for the Adaptive AI Workflow & Authoring prototype.
// All state is client-side. Nothing here talks to a real backend or LLM.

export type BadgeKind = "inherited" | "overridden" | "custom" | "warning" | "dependency"

export type ExecutionMode = "Pre-Generation" | "In-Generation" | "Post-Generation"

export type WorkflowStatus = "Published" | "Draft"

export type SectionState = "Current" | "Working Changes" | "Change Set Open" | "Potentially Stale"

export type DependencyState = "Current" | "Changed"

export interface WorkflowSummary {
  id: string
  name: string
  version: string
  kind: "Base" | "Custom"
  nodes: number
  lastPublished: string
  status: WorkflowStatus
  description: string
  // Custom-only fields
  basedOn?: string
  owner?: string
  lastEdited?: string
  changesFromParent?: string[]
}

export interface PromptComponent {
  key: string
  label: string
  content: string
  baseContent: string
  overridden: boolean
}

export interface WorkflowNodeConfig {
  id: string
  title: string
  level: number // 1 = section, 2 = subsection
  badge: BadgeKind
  purpose: string
  purposeSummary: string
  task: string
  taskSummary: string
  prompt: string
  basePrompt: string
  analyticalEnhancements: string[]
  requiredInputs: string[]
  modelConfig: string
  dependencies: { name: string; version: string }[]
  artifactSchema: string
  runtimeVariables: string[]
  validationRules: string[]
  executionBehavior: string
  inheritedSettings: string[]
  overrides: string[]
  bodyHtml: string
  promptComponents: PromptComponent[]
}

export interface CustomInsert {
  id: string
  name: string
  version: string
  category: "Analysis" | "Comparison" | "Validation" | "Enhancement" | "Transformation"
  executionMode: ExecutionMode
  purpose: string
  inputSummary: string
  output: string
  requiredInputs?: string[]
  optionalInputs?: string[]
  prompt?: string
  artifactSchema?: string
}

export interface DependencyRef {
  name: string
  generatedWith: string
  current: string
  state: DependencyState
}

export interface CanonicalVersion {
  version: string
  label: string
  changeSet?: string
  approvedBy?: string
  date: string
  contentHash: string
}

export interface DocSection {
  id: string
  title: string
  canonicalVersion: string
  workingState: "Current" | "Modified"
  changeSet: string | null
  generation: string
  previousGeneration?: string
  bodyHtml: string
  /** Content of the current canonical version; the working draft (bodyHtml) may diverge from it. */
  canonicalHtml: string
  /** A regeneration proposal exists that has not yet been applied. */
  proposalReady?: boolean
  dependencies: DependencyRef[]
  history: CanonicalVersion[]
  staleReason?: string
  staleImpact?: "Low" | "Medium" | "High"
  staleSummary?: string
  config: {
    workflowSchema: string
    task: string
    purpose: string
    prompt: string
    artifactSchema: string
    customInserts: string[]
    context: string
  }
}

export type ChangeSetStatus = "Submitted" | "Approved" | "Rejected" | "Merged" | "Withdrawn" | "Superseded"

export interface ChangeSet {
  id: string
  sectionId: string
  section: string
  base: string
  candidate: string
  contributors: string[]
  revisionEvents: number
  status: ChangeSetStatus
  createdBy: string
  submittedAt: string
  baseHtml: string
  candidateHtml: string
  candidateHash: string
  mergedVersion?: string
  reviewComment?: string
}

export type Role = "Viewer" | "Editor" | "Reviewer" | "Admin"

export const PERMISSIONS: { action: string; roles: Record<Role, "Yes" | "No" | "Optional" | "Configurable"> }[] = [
  { action: "View canonical", roles: { Viewer: "Yes", Editor: "Yes", Reviewer: "Yes", Admin: "Yes" } },
  { action: "View working", roles: { Viewer: "Optional", Editor: "Yes", Reviewer: "Yes", Admin: "Yes" } },
  { action: "Edit", roles: { Viewer: "No", Editor: "Yes", Reviewer: "Yes", Admin: "Yes" } },
  { action: "Submit Change Set", roles: { Viewer: "No", Editor: "Yes", Reviewer: "Yes", Admin: "Yes" } },
  { action: "Approve", roles: { Viewer: "No", Editor: "No", Reviewer: "Yes", Admin: "Yes" } },
  { action: "Merge", roles: { Viewer: "No", Editor: "No", Reviewer: "Configurable", Admin: "Yes" } },
  { action: "Reset working state", roles: { Viewer: "No", Editor: "No", Reviewer: "Optional", Admin: "Yes" } },
]

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  entity: string
  previous: string
  next: string
  correlationId: string
}

export const BASE_WORKFLOWS: WorkflowSummary[] = [
  {
    id: "wf-mission-v5",
    name: "Mission Planning",
    version: "V5",
    kind: "Base",
    nodes: 11,
    lastPublished: "2026-08-14",
    status: "Published",
    description: "End-to-end mission planning with staged objective, constraint, and course-of-action analysis.",
  },
  {
    id: "wf-ops-v5",
    name: "Operational Assessment",
    version: "V5",
    kind: "Base",
    nodes: 9,
    lastPublished: "2026-07-30",
    status: "Published",
    description: "Assess operational posture, readiness, and near-term execution risk across functions.",
  },
  {
    id: "wf-strategic-v4",
    name: "Strategic Assessment",
    version: "V4",
    kind: "Base",
    nodes: 8,
    lastPublished: "2026-09-02",
    status: "Published",
    description: "Structured strategic assessment from environment through recommendation with evidence contracts.",
  },
  {
    id: "wf-technical-v3",
    name: "Technical Assessment",
    version: "V3",
    kind: "Base",
    nodes: 7,
    lastPublished: "2026-06-18",
    status: "Published",
    description: "Evaluate technical feasibility, architecture options, and integration risk.",
  },
  {
    id: "wf-proposal-v2",
    name: "Proposal Development",
    version: "V2",
    kind: "Base",
    nodes: 6,
    lastPublished: "2026-05-22",
    status: "Published",
    description: "Compose structured proposals with requirement coverage and evaluation alignment.",
  },
  {
    id: "wf-research-v3",
    name: "Research Analysis",
    version: "V3",
    kind: "Base",
    nodes: 8,
    lastPublished: "2026-08-01",
    status: "Published",
    description: "Synthesize source material into evidence-graded analytical findings.",
  },
]

export const CUSTOM_WORKFLOWS: WorkflowSummary[] = [
  {
    id: "wf-strategic-narrative-v3",
    name: "Strategic Assessment — Narrative Focus",
    version: "V3",
    kind: "Custom",
    nodes: 9,
    lastPublished: "2026-09-18",
    status: "Draft",
    description: "Strategic assessment tuned toward narrative dynamics and decision-relevant disagreement.",
    basedOn: "Strategic Assessment V4",
    owner: "Alex Morgan",
    lastEdited: "2026-09-19",
    changesFromParent: ["1 node added", "2 prompts modified", "3 Custom Inserts added", "1 dependency changed"],
  },
]

const NARRATIVE_PROMPT_COMPONENTS: PromptComponent[] = [
  {
    key: "role",
    label: "Role / Perspective",
    content:
      "You are a senior strategic analyst preparing decision-support material for an executive steering group entering a new market.",
    baseContent:
      "You are a strategic analyst preparing an assessment for a decision-making audience.",
    overridden: true,
  },
  {
    key: "objective",
    label: "Objective",
    content:
      "Identify the dominant narratives shaping the opportunity, surface material disagreement between sources, and isolate the evidence that most affects the go / no-go decision.",
    baseContent:
      "Summarize the dominant narratives and key points of agreement and disagreement across sources.",
    overridden: true,
  },
  {
    key: "context",
    label: "Required Context",
    content:
      "Use the Environment and Actor Assessment canonical artifacts as the factual baseline. Treat Market Context as supporting evidence only.",
    baseContent:
      "Use the Environment and Actor Assessment artifacts as the factual baseline.",
    overridden: false,
  },
  {
    key: "instructions",
    label: "Task Instructions",
    content:
      "Group findings by narrative theme. For each theme, state the claim, the strength of supporting evidence, and any contradicting evidence. Explicitly flag narratives that are asserted but unsupported.",
    baseContent:
      "Group findings by theme and note supporting and contradicting evidence for each.",
    overridden: true,
  },
  {
    key: "evidence",
    label: "Evidence Requirements",
    content:
      "Every material claim must cite at least one source. Where sources conflict, prefer the more recent canonical artifact and note the discrepancy.",
    baseContent: "Material claims should cite at least one source.",
    overridden: false,
  },
  {
    key: "constraints",
    label: "Constraints",
    content:
      "Do not introduce recommendations. Do not speculate beyond the provided evidence. Keep terminology consistent with the Executive Context section.",
    baseContent: "Do not introduce recommendations. Do not speculate beyond provided evidence.",
    overridden: false,
  },
  {
    key: "output",
    label: "Output Guidance",
    content:
      "Produce a Narrative Findings artifact with themes, evidence strength, and identified contradictions. Lead with the two most decision-relevant narratives.",
    baseContent:
      "Produce a Narrative Findings artifact with themes and evidence notes.",
    overridden: true,
  },
  {
    key: "evaluation",
    label: "Evaluation Criteria",
    content:
      "A strong result distinguishes well-supported narratives from asserted ones and makes disagreement between sources explicit and traceable.",
    baseContent: "A strong result covers the major narratives with supporting evidence.",
    overridden: false,
  },
]

export const STRATEGIC_SECTIONS: WorkflowNodeConfig[] = [
  {
    id: "sec-exec-summary",
    title: "Executive Summary",
    level: 1,
    badge: "inherited",
    purpose: "Executive Decision Support V3",
    purposeSummary: "Provide a concise decision-oriented synthesis for leadership.",
    task: "Recommendation Development V3",
    taskSummary: "Distill downstream findings into a leadership-ready summary.",
    prompt: "Executive Summary V3",
    basePrompt: "Executive Summary V3",
    analyticalEnhancements: ["Executive Summary"],
    requiredInputs: ["Narrative Assessment", "Recommendation"],
    modelConfig: "Model Configuration A",
    dependencies: [
      { name: "Recommendation", version: "V6" },
      { name: "Narrative Assessment", version: "V4" },
    ],
    artifactSchema: "Executive Brief V2",
    runtimeVariables: ["audience", "decision_window"],
    validationRules: ["Must reference recommendation", "Max 250 words"],
    executionBehavior: "Executes last; depends on downstream sections.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>This assessment evaluates the Market Expansion Initiative and its readiness for an executive go / no-go decision. It synthesizes environmental conditions, competitive narratives, and constraint analysis into a single decision-support view.</p>",
    promptComponents: [],
  },
  {
    id: "sec-exec-context",
    title: "Executive Context",
    level: 1,
    badge: "inherited",
    purpose: "Executive Decision Support V3",
    purposeSummary: "Establish shared framing and scope for the assessment.",
    task: "Constraint Extraction V4",
    taskSummary: "Frame the initiative, scope, and decision question.",
    prompt: "Executive Context V2",
    basePrompt: "Executive Context V2",
    analyticalEnhancements: ["Supporting Context"],
    requiredInputs: ["Context Package"],
    modelConfig: "Model Configuration A",
    dependencies: [],
    artifactSchema: "Context Frame V1",
    runtimeVariables: ["initiative_name"],
    validationRules: ["Scope statement present"],
    executionBehavior: "Executes early; provides framing to downstream sections.",
    inheritedSettings: ["Evidence Required", "Standard Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>The Market Expansion Initiative evaluates entry into two adjacent regional markets over an 18-month horizon. This section establishes scope, decision authority, and the framing questions the assessment must answer.</p>",
    promptComponents: [],
  },
  {
    id: "sec-environment",
    title: "Environment",
    level: 1,
    badge: "inherited",
    purpose: "Analyst Working Draft V2",
    purposeSummary: "Characterize the operating environment and market conditions.",
    task: "Comparative Assessment V3",
    taskSummary: "Assess external market and competitor conditions.",
    prompt: "Environment Analysis V4",
    basePrompt: "Environment Analysis V4",
    analyticalEnhancements: ["Trend Analysis", "Quantitative Detail"],
    requiredInputs: ["Market Data", "Competitor Data"],
    modelConfig: "Model Configuration A",
    dependencies: [{ name: "Executive Context", version: "V2" }],
    artifactSchema: "Environment Findings V3",
    runtimeVariables: ["region_set"],
    validationRules: ["At least two markets characterized"],
    executionBehavior: "Feeds Narrative Assessment and Alternatives.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>Environmental conditions across both target markets are assessed below, covering demand signals, regulatory posture, and competitive intensity.</p>",
    promptComponents: [],
  },
  {
    id: "sec-market-conditions",
    title: "Market Conditions",
    level: 2,
    badge: "inherited",
    purpose: "Analyst Working Draft V2",
    purposeSummary: "Detail demand and pricing dynamics.",
    task: "Comparative Assessment V3",
    taskSummary: "Compare demand and pricing across markets.",
    prompt: "Market Conditions V2",
    basePrompt: "Market Conditions V2",
    analyticalEnhancements: ["Quantitative Detail"],
    requiredInputs: ["Market Data"],
    modelConfig: "Model Configuration A",
    dependencies: [],
    artifactSchema: "Market Findings V2",
    runtimeVariables: [],
    validationRules: [],
    executionBehavior: "Sub-section of Environment.",
    inheritedSettings: ["Evidence Required", "Standard Detail"],
    overrides: [],
    bodyHtml: "<p>Demand growth is uneven across the two markets, with pricing pressure concentrated in the primary region.</p>",
    promptComponents: [],
  },
  {
    id: "sec-competitor-env",
    title: "Competitor Environment",
    level: 2,
    badge: "inherited",
    purpose: "Analyst Working Draft V2",
    purposeSummary: "Characterize competitor positioning.",
    task: "Comparative Assessment V3",
    taskSummary: "Assess competitor posture and likely response.",
    prompt: "Competitor Environment V2",
    basePrompt: "Competitor Environment V2",
    analyticalEnhancements: ["Alternative Comparison"],
    requiredInputs: ["Competitor Data"],
    modelConfig: "Model Configuration A",
    dependencies: [],
    artifactSchema: "Competitor Findings V2",
    runtimeVariables: [],
    validationRules: [],
    executionBehavior: "Sub-section of Environment.",
    inheritedSettings: ["Evidence Required", "Standard Detail"],
    overrides: [],
    bodyHtml: "<p>Two incumbents hold defensible positions in the primary market; the secondary market is more fragmented.</p>",
    promptComponents: [],
  },
  {
    id: "sec-narrative",
    title: "Narrative Assessment",
    level: 1,
    badge: "overridden",
    purpose: "Executive Decision Support V3",
    purposeSummary:
      "Identify the dominant narratives, areas of disagreement, and evidence that materially affect decision-making.",
    task: "Narrative Analysis V2",
    taskSummary: "Extract and grade dominant narratives across source material.",
    prompt: "Narrative Analysis V5",
    basePrompt: "Narrative Analysis V4",
    analyticalEnhancements: ["Source Comparison V1", "Contradiction Detection V2"],
    requiredInputs: ["Source Information"],
    modelConfig: "Model Configuration A",
    dependencies: [
      { name: "Environment", version: "V4" },
      { name: "Actor Assessment", version: "V3" },
    ],
    artifactSchema: "Narrative Findings V2",
    runtimeVariables: ["source_set", "recency_window"],
    validationRules: ["Every theme cites a source", "Contradictions flagged explicitly"],
    executionBehavior: "Feeds Recommendation and Executive Summary.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: ["Prompt changed from V4 to custom V5", "Source Comparison added"],
    bodyHtml:
      "<h2>Narrative Assessment</h2><p>Two dominant narratives shape the market-entry opportunity. The first frames expansion as a defensive necessity driven by margin compression in the core market. The second frames it as an offensive growth play enabled by an emerging demand pocket in the secondary region.</p><p>Sources materially disagree on the durability of the secondary-region demand signal. Field reporting treats it as structural; competitor filings treat it as promotional and temporary. This disagreement is the single most decision-relevant point of contention.</p><p>A supporting narrative asserts limited regulatory friction, but this claim is currently under-evidenced and rests on a single source.</p>",
    promptComponents: NARRATIVE_PROMPT_COMPONENTS,
  },
  {
    id: "sec-constraints",
    title: "Constraints",
    level: 1,
    badge: "inherited",
    purpose: "Analyst Working Draft V2",
    purposeSummary: "Extract binding constraints on the initiative.",
    task: "Constraint Extraction V4",
    taskSummary: "Identify operational, legal, and resource constraints.",
    prompt: "Constraint Extraction V3",
    basePrompt: "Constraint Extraction V3",
    analyticalEnhancements: ["Completeness Check"],
    requiredInputs: ["Policy Package", "Resource Plan"],
    modelConfig: "Model Configuration A",
    dependencies: [{ name: "Executive Context", version: "V2" }],
    artifactSchema: "Constraint Set V2",
    runtimeVariables: [],
    validationRules: ["Each constraint has an owner"],
    executionBehavior: "Feeds Alternatives and Recommendation.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>Binding constraints include a fixed 18-month funding envelope, existing distribution commitments, and a newly introduced customer data residency requirement in the primary market.</p>",
    promptComponents: [],
  },
  {
    id: "sec-alternatives",
    title: "Alternatives",
    level: 1,
    badge: "inherited",
    purpose: "Analyst Working Draft V2",
    purposeSummary: "Develop and compare viable courses of action.",
    task: "Comparative Assessment V3",
    taskSummary: "Construct and compare alternative approaches.",
    prompt: "Alternatives Development V3",
    basePrompt: "Alternatives Development V3",
    analyticalEnhancements: ["Alternative Comparison"],
    requiredInputs: ["Constraint Set"],
    modelConfig: "Model Configuration A",
    dependencies: [{ name: "Constraints", version: "V9" }],
    artifactSchema: "Alternatives Matrix V2",
    runtimeVariables: [],
    validationRules: ["At least three alternatives"],
    executionBehavior: "Feeds Recommendation.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>Three alternatives are developed: sequential single-market entry (A), parallel dual-market entry (B), and a partnership-led entry (C).</p>",
    promptComponents: [],
  },
  {
    id: "sec-risk",
    title: "Risk Assessment",
    level: 1,
    badge: "warning",
    purpose: "Analyst Working Draft V2",
    purposeSummary: "Assess and grade risks across alternatives.",
    task: "Risk Analysis V2",
    taskSummary: "Identify, grade, and prioritize initiative risks.",
    prompt: "Risk Analysis V3",
    basePrompt: "Risk Analysis V3",
    analyticalEnhancements: ["Assumption Analysis"],
    requiredInputs: ["Alternatives Matrix", "Constraint Set"],
    modelConfig: "Model Configuration A",
    dependencies: [
      { name: "Constraints", version: "V9" },
      { name: "Alternatives", version: "V3" },
    ],
    artifactSchema: "Risk Register V2",
    runtimeVariables: [],
    validationRules: ["Each risk graded"],
    executionBehavior: "Feeds Recommendation.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>The dominant risks concentrate around Alternative B, where parallel execution amplifies exposure to the data residency constraint and to competitor response.</p>",
    promptComponents: [],
  },
  {
    id: "sec-recommendation",
    title: "Recommendation",
    level: 1,
    badge: "dependency",
    purpose: "Executive Decision Support V3",
    purposeSummary: "Recommend a course of action with rationale.",
    task: "Recommendation Development V3",
    taskSummary: "Recommend and justify a preferred course of action.",
    prompt: "Recommendation Development V4",
    basePrompt: "Recommendation Development V4",
    analyticalEnhancements: ["Evidence Check"],
    requiredInputs: ["Alternatives Matrix", "Risk Register", "Narrative Findings"],
    modelConfig: "Model Configuration A",
    dependencies: [
      { name: "Narrative Assessment", version: "V4" },
      { name: "Alternatives", version: "V3" },
      { name: "Risk Assessment", version: "V5" },
      { name: "Constraints", version: "V8" },
    ],
    artifactSchema: "Recommendation Brief V2",
    runtimeVariables: [],
    validationRules: ["Recommendation is singular and justified"],
    executionBehavior: "Executes near-last; feeds Executive Summary.",
    inheritedSettings: ["Evidence Required", "High Detail", "Model Configuration A"],
    overrides: [],
    bodyHtml:
      "<p>The assessment recommends Alternative A (sequential single-market entry) as the preferred course of action, preserving optionality on the secondary market pending stronger demand evidence.</p>",
    promptComponents: [],
  },
]

export const CUSTOM_INSERTS: CustomInsert[] = [
  { id: "ci-narrative", name: "Narrative Analysis", version: "V4", category: "Analysis", executionMode: "Pre-Generation", purpose: "Identify dominant narratives, supporting themes, inconsistencies, and changes in narrative over time.", inputSummary: "1 required, 2 optional", output: "Narrative Findings Artifact", requiredInputs: ["Source Information"], optionalInputs: ["Historical Reporting", "Actor Information"], prompt: "Narrative Analysis V4", artifactSchema: "Narrative Findings V2" },
  { id: "ci-risk", name: "Risk Analysis", version: "V2", category: "Analysis", executionMode: "In-Generation", purpose: "Surface, grade, and prioritize risks against alternatives and constraints.", inputSummary: "2 required", output: "Risk Register Artifact", requiredInputs: ["Alternatives", "Constraints"], prompt: "Risk Analysis V3", artifactSchema: "Risk Register V2" },
  { id: "ci-trend", name: "Trend Analysis", version: "V1", category: "Analysis", executionMode: "Pre-Generation", purpose: "Detect and characterize trends across time-series and reporting inputs.", inputSummary: "1 required", output: "Trend Findings", requiredInputs: ["Time Series"] },
  { id: "ci-assumption", name: "Assumption Analysis", version: "V2", category: "Analysis", executionMode: "Post-Generation", purpose: "Extract and test the assumptions underpinning conclusions.", inputSummary: "1 required", output: "Assumption Log" },
  { id: "ci-rootcause", name: "Root Cause Analysis", version: "V1", category: "Analysis", executionMode: "In-Generation", purpose: "Trace observed effects to underlying causes.", inputSummary: "1 required", output: "Cause Map" },
  { id: "ci-source-comp", name: "Source Comparison", version: "V1", category: "Comparison", executionMode: "Pre-Generation", purpose: "Compare claims across sources and quantify agreement and divergence.", inputSummary: "2+ sources", output: "Comparison Matrix", requiredInputs: ["Source A", "Source B"] },
  { id: "ci-alt-comp", name: "Alternative Comparison", version: "V2", category: "Comparison", executionMode: "In-Generation", purpose: "Compare alternatives across weighted criteria.", inputSummary: "1 required", output: "Comparison Matrix" },
  { id: "ci-hist-comp", name: "Historical Comparison", version: "V1", category: "Comparison", executionMode: "Pre-Generation", purpose: "Compare current findings against historical baselines.", inputSummary: "2 required", output: "Delta Report" },
  { id: "ci-version-comp", name: "Current vs Previous Version", version: "V3", category: "Comparison", executionMode: "Post-Generation", purpose: "Diff the current artifact against its prior canonical version.", inputSummary: "2 versions", output: "Version Delta" },
  { id: "ci-agreement", name: "Agreement / Disagreement Analysis", version: "V2", category: "Comparison", executionMode: "Pre-Generation", purpose: "Explicitly map points of agreement and disagreement.", inputSummary: "2+ sources", output: "Agreement Map" },
  { id: "ci-contradiction", name: "Contradiction Detection", version: "V2", category: "Validation", executionMode: "Post-Generation", purpose: "Detect internal contradictions and unsupported assertions.", inputSummary: "1 required", output: "Contradiction Report", requiredInputs: ["Draft Artifact"] },
  { id: "ci-evidence", name: "Evidence Check", version: "V2", category: "Validation", executionMode: "Post-Generation", purpose: "Verify that material claims are supported by cited evidence.", inputSummary: "1 required", output: "Evidence Report" },
  { id: "ci-completeness", name: "Completeness Check", version: "V1", category: "Validation", executionMode: "Post-Generation", purpose: "Check coverage against the artifact schema requirements.", inputSummary: "1 required", output: "Coverage Report" },
  { id: "ci-req-coverage", name: "Requirement Coverage", version: "V2", category: "Validation", executionMode: "Post-Generation", purpose: "Map output against stated requirements.", inputSummary: "2 required", output: "Coverage Matrix" },
  { id: "ci-consistency", name: "Consistency Review", version: "V1", category: "Validation", executionMode: "Post-Generation", purpose: "Review terminology and framing consistency across sections.", inputSummary: "1 required", output: "Consistency Notes" },
  { id: "ci-support-context", name: "Supporting Context", version: "V2", category: "Enhancement", executionMode: "In-Generation", purpose: "Add relevant supporting context to strengthen findings.", inputSummary: "1 required", output: "Augmented Draft" },
  { id: "ci-quant", name: "Quantitative Detail", version: "V1", category: "Enhancement", executionMode: "In-Generation", purpose: "Introduce quantified detail where evidence supports it.", inputSummary: "1 required", output: "Augmented Draft" },
  { id: "ci-expand", name: "Expanded Explanation", version: "V1", category: "Enhancement", executionMode: "In-Generation", purpose: "Expand terse findings into fuller explanations.", inputSummary: "1 required", output: "Augmented Draft" },
  { id: "ci-clarity", name: "Clarity Improvement", version: "V2", category: "Enhancement", executionMode: "Post-Generation", purpose: "Improve readability without changing meaning.", inputSummary: "1 required", output: "Revised Draft" },
  { id: "ci-exec-summary", name: "Executive Summary", version: "V3", category: "Transformation", executionMode: "Post-Generation", purpose: "Condense an artifact into a leadership-ready summary.", inputSummary: "1 required", output: "Executive Brief" },
  { id: "ci-condense", name: "Condense", version: "V1", category: "Transformation", executionMode: "Post-Generation", purpose: "Reduce length while preserving key content.", inputSummary: "1 required", output: "Condensed Draft" },
  { id: "ci-tech-rewrite", name: "Technical Rewrite", version: "V2", category: "Transformation", executionMode: "Post-Generation", purpose: "Rewrite for a technical audience.", inputSummary: "1 required", output: "Technical Draft" },
  { id: "ci-audience", name: "Audience Adaptation", version: "V1", category: "Transformation", executionMode: "Post-Generation", purpose: "Adapt tone and terminology for a target audience.", inputSummary: "1 required", output: "Adapted Draft" },
]

export const INSERT_CATEGORIES = ["Analysis", "Comparison", "Validation", "Enhancement", "Transformation"] as const

export const PURPOSE_OPTIONS = [
  "Executive Decision Support V3",
  "Analyst Working Draft V2",
  "Technical Review V2",
  "Customer Deliverable V4",
]

export const TASK_OPTIONS = [
  "Narrative Analysis V2",
  "Comparative Assessment V3",
  "Risk Analysis V2",
  "Constraint Extraction V4",
  "Recommendation Development V3",
]

// Dependency graph (execution order, distinct from presentation order).
export const GRAPH_EDGES: { source: string; target: string }[] = [
  { source: "sec-exec-context", target: "sec-environment" },
  { source: "sec-environment", target: "sec-narrative" },
  { source: "sec-constraints", target: "sec-alternatives" },
  { source: "sec-narrative", target: "sec-recommendation" },
  { source: "sec-alternatives", target: "sec-recommendation" },
  { source: "sec-risk", target: "sec-recommendation" },
  { source: "sec-recommendation", target: "sec-exec-summary" },
]
