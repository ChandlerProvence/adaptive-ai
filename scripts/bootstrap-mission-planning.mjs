/**
 * Writes the mission-planning catalog when historical_reference is not available.
 * Phase schemas are separate workflows. Mission Planning composes those six phases.
 */
import fs from "node:fs"
import path from "node:path"
import { enrichMissionPlanning } from "./enrich-mission-planning.mjs"

const root = path.resolve(import.meta.dirname, "..")
const out = path.join(root, "data", "mission-planning")
const LLM = { id: "llm.gpt_4o", version: 0 }
const published = "published"

const PHASES = [
  {
    id: "receive_the_mission",
    title: "Receive the Mission",
    workflow: "workflow.mp_receive",
    purpose: "planning",
    steps: [
      { id: "current_environment", title: "Current Environment", task: "currentEnvironment", name: "Current Environment", deps: [] },
      { id: "running_estimate", title: "Running Estimate", task: "runningEstimate", name: "Running Estimate", deps: ["current_environment"] },
    ],
  },
  {
    id: "mission_analysis",
    title: "Mission Analysis",
    workflow: "workflow.mp_mission_analysis",
    purpose: "planning",
    steps: [
      { id: "higher_hq_analysis", title: "Analysis of Higher HQ Mission", task: "higherHqAnalysis", name: "Higher HQ Analysis", deps: ["current_environment"] },
      { id: "mission_statement", title: "Mission Statement", task: "mission_statement_generation", name: "Mission Statement", deps: ["higher_hq_analysis", "running_estimate"], inserts: ["narrative_analysis", "assumptions", "assumption_analysis"] },
      { id: "intelligence_preparation", title: "Intelligence Preparation", task: "intelligencePreparation", name: "Intelligence Preparation", deps: ["current_environment"], inserts: ["correlation"] },
      { id: "correlation_of_forces", title: "Correlation of Forces and Means", task: "cbtPower", name: "Correlation of Forces and Means", deps: ["intelligence_preparation", "running_estimate"] },
      { id: "identified_tasks", title: "Identified Tasks", task: "identifiedTasks", name: "Identified Tasks", deps: ["higher_hq_analysis", "mission_statement"] },
      { id: "intent_and_guidance", title: "Commander's Intent and Planning Guidance", task: "intentAndGuidance", name: "Commander's Intent", deps: ["higher_hq_analysis"], inserts: ["narrative_analysis"] },
      { id: "priorities", title: "Priorities", task: "priorities", name: "Priorities", deps: ["intent_and_guidance", "identified_tasks"] },
    ],
  },
  {
    id: "coa_development",
    title: "COA Development",
    workflow: "workflow.mp_coa_development",
    purpose: "decision_support",
    steps: [
      { id: "coa_options", title: "COA Options", task: "coaOptions", name: "COA Options", deps: ["mission_statement", "identified_tasks", "priorities", "correlation_of_forces"] },
      { id: "coa", title: "COA", task: "coa_option", name: "COA", deps: ["coa_options"] },
      { id: "initial_forces", title: "Array of Initial Forces", task: "initialForces", name: "Array of Initial Forces", deps: ["correlation_of_forces", "coa_options"] },
      { id: "broad_concept", title: "Broad Concept", task: "broadConcept", name: "Broad Concept", deps: ["coa_options", "initial_forces"] },
      { id: "assign_hqs", title: "Assign Headquarters", task: "assignHQs", name: "Assign Headquarters", deps: ["broad_concept"] },
      { id: "coa_statement_and_sketch", title: "COA Statement and Sketch", task: "coaStatementAndSketch", name: "COA Statement and Sketch", deps: ["broad_concept", "assign_hqs"] },
    ],
  },
  {
    id: "coa_analysis",
    title: "COA Analysis",
    workflow: "workflow.mp_coa_analysis",
    purpose: "decision_support",
    steps: [
      { id: "friendly_forces", title: "Friendly Forces", task: "friendlyForces", name: "Friendly Forces", deps: ["initial_forces"] },
      { id: "wargaming_method", title: "Wargaming Method", task: "wargamingMethod", name: "Wargaming Method", deps: ["coa", "broad_concept"], inserts: ["assumptions", "assumption_analysis"] },
      { id: "wargaming_assessment", title: "Wargaming Assessment", task: "wargamingAssessment", name: "Wargaming Assessment", deps: ["wargaming_method"] },
    ],
  },
  {
    id: "coa_comparison",
    title: "COA Comparison",
    workflow: "workflow.mp_coa_comparison",
    purpose: "decision_support",
    steps: [
      { id: "evaluation_criteria", title: "Evaluation Criteria", task: "evaluationCriteria", name: "Evaluation Criteria", deps: ["intent_and_guidance"] },
      { id: "compare_coas", title: "Compare COAs", task: "compareCoas", name: "Compare COAs", deps: ["evaluation_criteria", "coa_options", "wargaming_assessment"], inserts: ["disagreements"] },
      { id: "decision_matrix", title: "Decision Matrix", task: "decisionMatrix", name: "Decision Matrix", deps: ["compare_coas"] },
      { id: "selection", title: "Selection", task: "selection", name: "Selection", deps: ["decision_matrix"], inserts: ["disagreements"] },
    ],
  },
  {
    id: "coa_approval",
    title: "COA Approval",
    workflow: "workflow.mp_coa_approval",
    purpose: "execution_support",
    steps: [
      { id: "approved_commander_intent", title: "Approved Commander's Intent", task: "intentAndGuidance", name: "Commander's Intent", deps: ["selection", "intent_and_guidance"] },
      { id: "approved_mission_statement", title: "Approved Mission Statement", task: "mission_statement_generation", name: "Mission Statement", deps: ["selection", "mission_statement"], inserts: ["assumptions", "assumption_analysis"] },
    ],
  },
]

const INSERTS = {
  narrative_analysis: { name: "Narrative Analysis", category: "analysis", executionMode: "in", schema: true },
  assumption_analysis: { name: "Assumption Analysis", category: "analysis", executionMode: "in", schema: true },
  assumptions: { name: "Assumptions", category: "analysis", executionMode: "in", schema: false },
  disagreements: { name: "Disagreements", category: "validation", executionMode: "post", schema: true },
  correlation: { name: "Correlation", category: "comparison", executionMode: "in", schema: true },
}

const PURPOSES = {
  planning: "Forward-looking planning. State assumptions explicitly and keep more than one course of action in view.",
  decision_support: "Compare courses of action so a commander can decide. Keep the evidence for each option visible.",
  execution_support: "Turn the selected course into direction the staff can carry forward.",
}

function ref(id) {
  return { id, version: 0 }
}

function write(dir, file, record) {
  const folder = path.join(out, dir)
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, file), JSON.stringify(record, null, 2) + "\n")
}

fs.rmSync(out, { recursive: true, force: true })

const basePrompt = {
  role: "You are supporting the staff for the pinned mission. Perform the pinned task and produce its artifact type.",
  objective: "Complete the pinned task for the pinned mission.",
  instructions: "Scope the output to the pinned purpose: audience, intended use, release level, time sensitivity, and risk tolerance.\n\nAPPROACH THIS TASK USING CHAIN-OF-THOUGHT REASONING. Show your reasoning process step-by-step, then provide the final artifact.\n\nSTEP 1: EVIDENCE ANALYSIS\n- Review each evidence block systematically\n- Identify key facts, claims, and data points from each source\n\nSTEP 2: PATTERN IDENTIFICATION\n- Look for patterns across evidence sources\n\nSTEP 3: SYNTHESIS AND INTERPRETATION\n- Synthesize evidence into coherent insights\n\nSTEP 4: ARTIFACT CONSTRUCTION\n- Structure your findings according to the required artifact format",
  constraints: "CRITICAL REQUIREMENTS - NO HALLUCINATION:\n1. EVERY claim, fact, assessment, or finding MUST be directly supported by the provided evidence\n2. DO NOT invent, assume, or infer information not explicitly stated in the evidence\n3. DO NOT use general knowledge or training data - ONLY use the provided evidence\n4. If evidence is insufficient for a required field, state \"Insufficient evidence\" rather than inventing content\n5. EVERY statement must be traceable to a specific evidence source\n6. Prioritize evidence from preferred/trusted sources when available\n7. If you cannot substantiate a claim with evidence, explicitly state the limitation",
  output: "Show the reasoning, then provide the final artifact in the required format.",
}
write("prompts", "prompt.mp_default.json", {
  kind: "prompt",
  id: "prompt.mp_default",
  version: 0,
  name: "Default Planning Prompt",
  status: published,
  body: basePrompt,
})
write("prompts", "prompt.mp_mdmp_base.json", {
  kind: "prompt",
  id: "prompt.mp_mdmp_base",
  version: 0,
  name: "MDMP Base",
  status: published,
  forkedFrom: ref("prompt.mp_default"),
  overrides: {
    role: "You are supporting a planner for the pinned mission. Perform the pinned MDMP task and produce its artifact type.",
    output: "DISPLAY_TEXT (UI NARRATIVE PANEL):\n- Write 2-6 paragraphs of readable briefing prose\n- Summarize key conclusions; reference evidence in structured fields via citations\n- display_text must not contain JSON, code fences, or field names from the schema\n\nShow the reasoning, then provide the final artifact in the required format.",
  },
})
write("prompts", "prompt.mp_mdmp_assumptions.json", {
  kind: "prompt",
  id: "prompt.mp_mdmp_assumptions",
  version: 0,
  name: "Assumptions",
  status: published,
  forkedFrom: ref("prompt.mp_mdmp_base"),
  overrides: { objective: "MDMP STEP: Assumptions. Identify and document planning assumptions for the mission." },
})

const owner = new Map()
for (const phase of PHASES) {
  for (const step of phase.steps) owner.set(step.id, phase)
}

const tasks = new Map()
for (const phase of PHASES) {
  for (const step of phase.steps) {
    if (tasks.has(step.task)) continue
    tasks.set(step.task, step)
    const promptId = step.task === "coa_option" ? "prompt.mp_coa_option" : `prompt.mp_mdmp_${step.task}`
    const schemaId = step.task === "coa_option" ? "schema.mp_coa_option" : `schema.mp_${step.task}`
    write("prompts", `${promptId}.json`, {
      kind: "prompt",
      id: promptId,
      version: 0,
      name: step.name,
      status: published,
      forkedFrom: ref("prompt.mp_mdmp_base"),
      overrides: { objective: `${phase.title} / ${step.title}. Produce this step for the pinned mission.` },
    })
    write("artifact-schemas", `${schemaId}.json`, {
      kind: "artifact_schema",
      id: schemaId,
      version: 0,
      name: step.name,
      status: published,
      body: { summary: `${step.title} for ${phase.title}.`, requiredSections: [step.task === "coa_option" ? "coa" : "items"] },
    })
    write("tasks", `task.mp_${step.task}.json`, {
      kind: "task",
      id: `task.mp_${step.task}`,
      version: 0,
      name: step.name,
      status: published,
      body: {
        summary: `${step.title}. Use the inherited situation, and record only what this step adds.`,
        prompt: ref(promptId),
        artifactSchema: ref(schemaId),
        llm: LLM,
        requiredInputs: [],
      },
    })
  }
}

for (const [id, insert] of Object.entries(INSERTS)) {
  const promptId = id === "assumptions" ? "prompt.mp_mdmp_assumptions" : "prompt.mp_mdmp_base"
  const body = {
    category: insert.category,
    executionMode: insert.executionMode,
    summary: id === "assumptions" ? "Identify and document planning assumptions for the mission. Categorize them and cite evidence." : `${insert.name} for the step it is attached to.`,
    prompt: ref(promptId),
  }
  if (insert.schema) {
    const schemaId = `schema.mp_${id}`
    write("artifact-schemas", `${schemaId}.json`, {
      kind: "artifact_schema",
      id: schemaId,
      version: 0,
      name: insert.name,
      status: published,
      body: { summary: insert.name, requiredSections: ["items"] },
    })
    body.artifactSchema = ref(schemaId)
  }
  write("custom-inserts", `insert.mp_${id}.json`, {
    kind: "custom_insert",
    id: `insert.mp_${id}`,
    version: 0,
    name: insert.name,
    status: published,
    body,
  })
}

for (const [key, summary] of Object.entries(PURPOSES)) {
  write("purposes", `purpose.mp_${key}.json`, {
    kind: "purpose",
    id: `purpose.mp_${key}`,
    version: 0,
    name: key.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    status: published,
    body: {
      summary,
      audience: "Commander",
      tone: "Analytical",
      evidenceRequirement: "Cite supplied evidence for every claim. Mark insufficient evidence explicitly.",
      riskTolerance: "Moderate",
      detail: "High",
    },
  })
}

write("contexts", "mission-planning.json", {
  kind: "context",
  id: "context.mission_planning",
  version: 0,
  name: "Mission Planning",
  status: published,
  body: {
    contextType: "mission",
    statement: "Plan a mission from receipt through approval, using the joint planning process.",
    organization: "Planning staff",
    timeWindow: "The operation's time window",
    areaOfResponsibility: "The command's assigned area of responsibility",
    standingGuidance:
      "Apply the joint planning process. Develop more than one course of action, keep assumptions explicit, and wait for approval before treating one course as the decision.",
    evidenceStandard: "Cite supplied evidence for every claim. Mark insufficient evidence explicitly.",
    knownConstraints: [
      "Claims require supplied evidence",
      "Every mission inherits this staff, standing guidance, evidence standard, and area of responsibility",
    ],
  },
})

for (const phase of PHASES) {
  const nodes = phase.steps.map((step) => {
    const dependencies = []
    const upstream = []
    for (const dep of step.deps) {
      const source = owner.get(dep)
      if (source.id === phase.id) dependencies.push(dep)
      else upstream.push({ workflow: ref(source.workflow), nodeId: dep })
    }
    const node = {
      id: step.id,
      title: step.title,
      executable: true,
      task: ref(`task.mp_${step.task}`),
      dependencies,
    }
    if (upstream.length) node.upstream = upstream
    if (step.inserts?.length) node.inserts = step.inserts.map((id) => ref(`insert.mp_${id}`))
    return node
  })
  write("workflows", `${phase.workflow}.json`, {
    kind: "workflow",
    id: phase.workflow,
    version: 0,
    name: phase.title,
    status: published,
    body: {
      defaults: {
        llm: LLM,
        purpose: ref(`purpose.mp_${phase.purpose}`),
        evidenceRequirement: "Cite supplied evidence. Mark insufficient evidence explicitly.",
        detail: "High",
      },
      nodes,
    },
  })
}

write("workflows", "workflow.mission_planning.json", {
  kind: "workflow",
  id: "workflow.mission_planning",
  version: 0,
  name: "Mission Planning",
  status: published,
  body: {
    defaults: {
      llm: LLM,
      purpose: ref("purpose.mp_planning"),
      evidenceRequirement: "Cite supplied evidence. Mark insufficient evidence explicitly.",
      detail: "High",
    },
    nodes: PHASES.map((phase) => ({
      id: phase.id,
      title: phase.title,
      executable: false,
      workflow: ref(phase.workflow),
      purpose: ref(`purpose.mp_${phase.purpose}`),
      dependencies: [...new Set(phase.steps.flatMap((step) => step.deps.map((dep) => owner.get(dep)?.id).filter((id) => id && id !== phase.id)))],
    })),
  },
})

console.log(`Wrote structural mission planning catalog to ${out}`)
enrichMissionPlanning()
