import type { Catalog, CatalogRecord, VersionRef } from "./types.ts"

export const CONTEXT: VersionRef = { id: "context.intel", version: 0 }
export const PURPOSE: VersionRef = { id: "purpose.planning", version: 0 }
export const LLM: VersionRef = { id: "llm.gpt_4o", version: 0 }
export const TASK_COA: VersionRef = { id: "task.coa_generation", version: 0 }
export const TASK_MISSION: VersionRef = { id: "task.mission_analysis", version: 0 }
export const TASK_CONSTRAINTS: VersionRef = { id: "task.constraint_extraction", version: 0 }
export const PROMPT_COA_V0: VersionRef = { id: "prompt.coa_generation", version: 0 }
export const PROMPT_COA_V1: VersionRef = { id: "prompt.coa_generation", version: 1 }
export const PROMPT_MISSION: VersionRef = { id: "prompt.mission_analysis", version: 0 }
export const PROMPT_CONSTRAINTS: VersionRef = { id: "prompt.constraint_extraction", version: 0 }
export const SCHEMA_COA: VersionRef = { id: "schema.coa_package", version: 0 }
export const SCHEMA_MISSION: VersionRef = { id: "schema.mission_analysis", version: 0 }
export const SCHEMA_CONSTRAINTS: VersionRef = { id: "schema.constraint_set", version: 0 }
export const INSERT_RISK: VersionRef = { id: "insert.risk_analysis", version: 0 }
export const WORKFLOW_V0: VersionRef = { id: "workflow.coa", version: 0 }
export const WORKFLOW_V1: VersionRef = { id: "workflow.coa", version: 1 }
export const STRATEGIC_WORKFLOW: VersionRef = { id: "workflow.strategic_narrative", version: 3 }

export const COA_NODE_ID = "coa"

const published = { status: "published" as const }

function root(record: CatalogRecord): CatalogRecord {
  return record
}

export const coaCatalog: Catalog = {
  records: [
    root({
      kind: "llm",
      id: LLM.id,
      version: 0,
      name: "GPT-4o",
      ...published,
      body: {
        provider: "litellm",
        baseUrl: "https://litellm.iho.leidos.com/v1",
        apiKeyEnv: "LITELLM_API_KEY",
        apiKeyHeader: "x-litellm-api-key",
        model: "gpt-4o",
        temperature: 0.2,
        embeddingModel: "text-embedding-3-small",
      },
    }),
    root({
      kind: "context",
      id: CONTEXT.id,
      version: 0,
      name: "Intel",
      ...published,
      body: {
        contextType: "system",
        statement: "Intelligence support for situations that have not yet named an operation. Placeholder for intelligence workflows.",
        organization: "Intelligence staff",
        timeWindow: "The current intelligence cycle",
        areaOfResponsibility: "The supported command's area of responsibility",
        standingGuidance: "Describe what is known, what is assessed, and what is unknown. Separate evidence from inference.",
        evidenceStandard: "Cite supplied evidence. Mark gaps explicitly.",
        knownConstraints: ["Assessments require a source or an explicit uncertainty"],
      },
    }),
    root({
      kind: "purpose",
      id: PURPOSE.id,
      version: 0,
      name: "Planning",
      ...published,
      body: {
        summary: "Produce planning material a commander can use to choose a course of action.",
        audience: "Commander",
        tone: "Decision-support, direct",
        evidenceRequirement: "Cite canonical constraints and mission analysis",
        riskTolerance: "Low",
        detail: "High",
      },
    }),
    root({
      kind: "prompt",
      id: PROMPT_MISSION.id,
      version: 0,
      name: "Mission Analysis",
      ...published,
      body: {
        role: "You are a planning analyst.",
        objective: "State the mission problem the course of action must solve.",
        instructions: "Restate the mission, the time window, and the facts that bound feasible action.",
        constraints: "Use only the context profile and cited canonical inputs.",
        output: "Produce a mission analysis with problem, facts, and bounds.",
      },
    }),
    root({
      kind: "prompt",
      id: PROMPT_CONSTRAINTS.id,
      version: 0,
      name: "Constraint Extraction",
      ...published,
      body: {
        role: "You are a planning analyst.",
        objective: "Extract the constraints that a course of action must respect.",
        instructions: "List binding constraints and distinguish them from preferences.",
        constraints: "Do not invent sustainment capacity that the context does not provide.",
        output: "Produce a constraint set with binding constraints and the source of each.",
      },
    }),
    root({
      kind: "prompt",
      id: PROMPT_COA_V0.id,
      version: 0,
      name: "COA Generation",
      ...published,
      body: {
        role: "You are a course-of-action planner.",
        objective: "Develop feasible courses of action for the mission.",
        instructions: "Develop distinct courses of action that satisfy the mission within the canonical constraints.",
        constraints: "Every course of action must remain inside the published constraint set.",
        output: "Produce a COA package with named courses of action, concept, and risk.",
      },
    }),
    {
      kind: "prompt",
      id: PROMPT_COA_V1.id,
      version: 1,
      name: "COA Generation",
      ...published,
      forkedFrom: PROMPT_COA_V0,
      overrides: {
        instructions:
          "Develop distinct courses of action that satisfy the mission within the canonical constraints. For each course of action, make the sustainment tradeoff explicit.",
      },
    },
    root({
      kind: "artifact_schema",
      id: SCHEMA_MISSION.id,
      version: 0,
      name: "Mission Analysis",
      ...published,
      body: {
        summary: "Accepted mission analysis states the problem, the facts, and the bounds.",
        requiredSections: ["Problem", "Facts", "Bounds"],
      },
    }),
    root({
      kind: "artifact_schema",
      id: SCHEMA_CONSTRAINTS.id,
      version: 0,
      name: "Constraint Set",
      ...published,
      body: {
        summary: "Accepted constraint set lists binding constraints and their sources.",
        requiredSections: ["Binding Constraints", "Sources"],
      },
    }),
    root({
      kind: "artifact_schema",
      id: SCHEMA_COA.id,
      version: 0,
      name: "COA Package",
      ...published,
      body: {
        summary: "Accepted COA package names each course of action and states concept, sustainment, and risk.",
        requiredSections: ["Courses of Action", "Concept", "Sustainment", "Risk"],
      },
    }),
    root({
      kind: "task",
      id: TASK_MISSION.id,
      version: 0,
      name: "Mission Analysis",
      ...published,
      body: {
        summary: "State the mission problem before courses of action are built.",
        prompt: PROMPT_MISSION,
        artifactSchema: SCHEMA_MISSION,
        llm: LLM,
        requiredInputs: ["context"],
      },
    }),
    root({
      kind: "task",
      id: TASK_CONSTRAINTS.id,
      version: 0,
      name: "Constraint Extraction",
      ...published,
      body: {
        summary: "Extract binding constraints from the situation.",
        prompt: PROMPT_CONSTRAINTS,
        artifactSchema: SCHEMA_CONSTRAINTS,
        llm: LLM,
        requiredInputs: ["context"],
      },
    }),
    root({
      kind: "task",
      id: TASK_COA.id,
      version: 0,
      name: "COA Generation",
      ...published,
      body: {
        summary: "Produce courses of action from mission analysis and constraints.",
        prompt: PROMPT_COA_V0,
        artifactSchema: SCHEMA_COA,
        llm: LLM,
        requiredInputs: ["mission_analysis", "constraints"],
      },
    }),
    root({
      kind: "custom_insert",
      id: INSERT_RISK.id,
      version: 0,
      name: "Risk Analysis",
      ...published,
      body: {
        category: "analysis",
        executionMode: "in",
        summary: "Surface the risk each course of action accepts.",
      },
    }),
    root({
      kind: "workflow",
      id: WORKFLOW_V0.id,
      version: 0,
      name: "Course of Action",
      ...published,
      body: {
        defaults: {
          llm: LLM,
          purpose: PURPOSE,
          detail: "High",
          evidenceRequirement: "Supporting sources required",
        },
        nodes: [
          {
            id: "analysis",
            title: "Analysis",
            executable: false,
            purpose: PURPOSE,
            evidenceRequirement: "Cite canonical sources",
            detail: "High",
          },
          {
            id: "mission_analysis",
            title: "Mission Analysis",
            parentNodeId: "analysis",
            executable: true,
            task: TASK_MISSION,
            dependencies: [],
          },
          {
            id: "constraints",
            title: "Constraints",
            parentNodeId: "analysis",
            executable: true,
            task: TASK_CONSTRAINTS,
            dependencies: [],
          },
          {
            id: COA_NODE_ID,
            title: "Course of Action",
            parentNodeId: "analysis",
            executable: true,
            task: TASK_COA,
            inserts: [INSERT_RISK],
            dependencies: ["mission_analysis", "constraints"],
          },
        ],
      },
    }),
    {
      kind: "workflow",
      id: WORKFLOW_V1.id,
      version: 1,
      name: "Course of Action",
      ...published,
      forkedFrom: WORKFLOW_V0,
      overrides: {
        nodes: {
          [COA_NODE_ID]: { prompt: PROMPT_COA_V1 },
        },
      },
    },
    root({
      kind: "workflow",
      id: STRATEGIC_WORKFLOW.id,
      version: 3,
      name: "Strategic Assessment — Narrative Focus",
      ...published,
      body: {
        defaults: { detail: "High" },
        nodes: [
          { id: "exec-summary", title: "Executive Summary", executable: true, dependencies: ["recommendation"] },
          { id: "exec-context", title: "Executive Context", executable: true, dependencies: [] },
          { id: "environment", title: "Environment", executable: true, dependencies: ["exec-context"] },
          { id: "narrative", title: "Narrative Assessment", executable: true, dependencies: ["environment"] },
          { id: "constraints", title: "Constraints", executable: true, dependencies: [] },
          { id: "alternatives", title: "Alternatives", executable: true, dependencies: ["constraints"] },
          { id: "risk", title: "Risk Assessment", executable: true, dependencies: ["alternatives"] },
          { id: "recommendation", title: "Recommendation", executable: true, dependencies: ["narrative", "alternatives", "risk"] },
        ],
      },
    }),
  ],
}

export const KIND_LABELS: Record<CatalogRecord["kind"], string> = {
  context: "Contexts",
  task: "Tasks",
  purpose: "Purposes",
  prompt: "Prompts",
  artifact_schema: "Artifact Schemas",
  custom_insert: "Custom Inserts",
  workflow: "Workflow Schemas",
  llm: "LLM Catalog",
}
