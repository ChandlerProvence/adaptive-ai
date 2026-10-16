/**
 * Maps historical_reference mission-planning files into data/mission-planning
 * as versioned catalog records. Published bases stay whole. Forks store only the delta.
 * The historical LLM file contains a secret and is not copied. Tasks use llm.gpt_4o.
 */
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const historical = path.join(root, "historical_reference")
const out = path.join(root, "data", "mission-planning")
const LLM = { id: "llm.gpt_4o", version: 0 }
const published = "published"

const INSERTS = {
  narrative_analysis: { category: "analysis", executionMode: "in" },
  assumption_analysis: { category: "analysis", executionMode: "in" },
  assumptions: { category: "analysis", executionMode: "in", artifactSchema: false },
  disagreements: { category: "validation", executionMode: "post" },
  correlation: { category: "comparison", executionMode: "in" },
}
const COA_INDEXES = new Set(["coa1", "coa2", "coa3"])
const SHARED_TASKS = new Set([
  "coaAssumptions",
  "updatedAssumptions",
  "approvedMissionStatement",
  "approvedCdrIntent",
  "commanders_intent_extraction",
])
const TASK_NAMES = {
  mission_statement_generation: "Mission Statement",
  intentAndGuidance: "Commander's Intent",
}
const SKIP_PROMPTS = new Set([
  "mdmp_coa2.yaml",
  "mdmp_coa3.yaml",
  "mdmp_coaAssumptions.yaml",
  "mdmp_updatedAssumptions.yaml",
  "mdmp_approvedMissionStatement.yaml",
  "mdmp_approvedCdrIntent.yaml",
])
const SKIP_SCHEMAS = new Set([
  "coa2.schema.json",
  "coa3.schema.json",
  "assumptions.schema.json",
  "coaAssumptions.schema.json",
  "updatedAssumptions.schema.json",
  "approvedMissionStatement.schema.json",
  "approvedCdrIntent.schema.json",
  "commanders_intent.schema.json",
])

const INPUTS = {
  currentEnvironment: ["Operation details", "Intelligence uploads"],
  runningEstimate: ["Running estimate uploads", "OPORDs and campaign plans", "Higher HQ mission statement"],
  assumptions: ["OPORDs and campaign plans", "Planning products", "Commander's standing orders"],
  higherHqAnalysis: ["OPORDs and campaign plans", "Higher HQ mission statement", "Planning products"],
  mission_statement_generation: ["OPORDs and campaign plans", "Planning products", "Commander's standing orders"],
  intelligencePreparation: ["Planning products", "Intelligence uploads"],
  cbtPower: ["OPORDs and campaign plans", "Planning products"],
  identifiedTasks: ["OPORDs and campaign plans", "Planning products", "Commander's standing orders"],
  intentAndGuidance: ["Commander's standing orders", "Planning products"],
  priorities: ["Commander's standing orders", "Planning products"],
  coaOptions: ["Commander's intent"],
  coa_option: ["COA options"],
  initialForces: ["Operation details", "Intelligence uploads"],
  friendlyForces: ["Current forces documents"],
  coaAssumptions: ["Assumptions developed outside this process"],
}

function parseYaml(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n/)
  function block(minIndent, index) {
    const value = {}
    let i = index
    while (i < lines.length) {
      const raw = lines[i]
      if (!raw.trim() || raw.trim().startsWith("#")) {
        i += 1
        continue
      }
      const indent = raw.match(/^ */)[0].length
      if (indent < minIndent) break
      if (indent > minIndent) {
        i += 1
        continue
      }
      const match = raw.slice(indent).match(/^([^:#][^:]*):\s*(.*)$/)
      if (!match) {
        i += 1
        continue
      }
      const key = match[1].trim().replace(/^["']|["']$/g, "")
      const rest = match[2]
      if (rest === "|" || rest === ">") {
        const collected = []
        i += 1
        while (i < lines.length) {
          const next = lines[i]
          if (next.trim() && next.match(/^ */)[0].length <= indent) break
          collected.push(next)
          i += 1
        }
        value[key] = dedent(collected)
      } else if (rest === "") {
        const nested = block(indent + 2, i + 1)
        value[key] = nested.value
        i = nested.index
      } else {
        value[key] = rest.trim().replace(/^["']|["']$/g, "")
        i += 1
      }
    }
    return { value, index: i }
  }
  return block(0, 0).value
}

function dedent(lines) {
  const content = lines.filter((line) => line.trim())
  const indent = content.reduce((min, line) => Math.min(min, line.match(/^ */)[0].length), 80)
  return lines
    .map((line) => (line.trim() ? line.slice(indent) : ""))
    .join("\n")
    .trim()
}

function promptNodes(text) {
  const body = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\nedges:/)[0]
  const chunks = body.split(/\n\s*- id:\s*/)
  const nodes = {}
  for (const chunk of chunks.slice(1)) {
    const id = chunk.match(/^"?([^"\n]+)"?/)?.[1]
    const marker = chunk.search(/\|\n/)
    if (!id || marker < 0) continue
    nodes[id] = dedent(chunk.slice(marker + 2).split("\n"))
  }
  return nodes
}

function flattenPrompt(file) {
  const text = fs.readFileSync(file, "utf8")
  const parsed = parseYaml(text)
  const nodes = promptNodes(text)
  return {
    role: nodes.system_role || parsed.description || "You are supporting a mission planner.",
    objective: nodes.mdmp_step_context || parsed.description || "Complete the planning step for the pinned mission.",
    instructions: nodes.cot_instructions || "Use the pinned mission context and the task description. Produce the artifact described by the schema.",
    constraints: nodes.requirements || "Use only supplied evidence. Mark insufficient evidence explicitly.",
    output: nodes.display_text_rules || "Produce the artifact described by the schema, with a readable narrative.",
  }
}

function delta(base, next) {
  const overrides = {}
  for (const key of ["role", "objective", "instructions", "constraints", "output"]) {
    if (next[key] !== base[key]) overrides[key] = next[key]
  }
  return overrides
}

function firstText(map, preferred) {
  if (!map || typeof map !== "object") return ""
  for (const key of preferred) {
    if (typeof map[key] === "string" && map[key].trim()) return map[key].trim()
  }
  const found = Object.values(map).find((value) => typeof value === "string" && value.trim())
  return typeof found === "string" ? found.trim() : ""
}

function titleFrom(id) {
  return id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function write(dir, file, record) {
  const folder = path.join(out, dir)
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, file), JSON.stringify(record, null, 2) + "\n")
}

function ref(id) {
  return { id, version: 0 }
}

if (!fs.existsSync(historical)) {
  console.error("historical_reference is not present. data/mission-planning was left unchanged.")
  process.exit(1)
}

fs.rmSync(out, { recursive: true, force: true })

const promptDir = path.join(historical, "configs", "prompt_templates")
const basePrompt = flattenPrompt(path.join(promptDir, "mdmp_base.yaml"))
const defaultPrompt = flattenPrompt(path.join(promptDir, "default.yaml"))
write("prompts", "prompt.mp_mdmp_base.json", {
  kind: "prompt",
  id: "prompt.mp_mdmp_base",
  version: 0,
  name: "MDMP Base",
  status: published,
  body: basePrompt,
})
write("prompts", "prompt.mp_default.json", {
  kind: "prompt",
  id: "prompt.mp_default",
  version: 0,
  name: "Default Planning Prompt",
  status: published,
  body: defaultPrompt,
})

const promptRefs = new Map([
  ["mdmp_base.yaml", "prompt.mp_mdmp_base"],
  ["default.yaml", "prompt.mp_default"],
])

for (const file of fs.readdirSync(promptDir).filter((name) => name.endsWith(".yaml"))) {
  if (file === "mdmp_base.yaml" || file === "default.yaml" || SKIP_PROMPTS.has(file)) continue
  const parentId = file.startsWith("mdmp_") ? "prompt.mp_mdmp_base" : "prompt.mp_default"
  const parentBody = parentId === "prompt.mp_mdmp_base" ? basePrompt : defaultPrompt
  const coa = file === "mdmp_coa1.yaml"
  const id = coa ? "prompt.mp_coa_option" : `prompt.mp_${file.replace(/\.yaml$/, "")}`
  const overrides = delta(parentBody, flattenPrompt(path.join(promptDir, file)))
  if (typeof overrides.objective === "string") overrides.objective = overrides.objective.replaceAll("COA 1", "COA")
  promptRefs.set(file, id)
  write("prompts", `${id}.json`, {
    kind: "prompt",
    id,
    version: 0,
    name: coa ? "COA" : titleFrom(file.replace(/\.yaml$/, "").replace(/^mdmp_/, "")),
    status: published,
    forkedFrom: ref(parentId),
    overrides,
  })
}
promptRefs.set("mdmp_coa2.yaml", "prompt.mp_coa_option")
promptRefs.set("mdmp_coa3.yaml", "prompt.mp_coa_option")

const schemaDir = path.join(historical, "schemas")
const schemaOut = path.join(out, "schemas")
fs.mkdirSync(schemaOut, { recursive: true })
const schemaRefs = new Map()
for (const file of fs.readdirSync(schemaDir).filter((name) => name.endsWith(".schema.json"))) {
  if (SKIP_SCHEMAS.has(file)) continue
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), "utf8"))
  const coa = file === "coa1.schema.json"
  const storedName = coa ? "coa.schema.json" : file
  fs.copyFileSync(path.join(schemaDir, file), path.join(schemaOut, storedName))
  const id = coa ? "schema.mp_coa_option" : `schema.mp_${file.replace(/\.schema\.json$/, "")}`
  schemaRefs.set(file, id)
  const required = Array.isArray(schema.required) ? schema.required.map(String) : []
  const requiredSections = required.filter((name) => !["artifact_type", "schema_version", "context", "citations"].includes(name))
  write("artifact-schemas", `${id}.json`, {
    kind: "artifact_schema",
    id,
    version: 0,
    name: coa ? "COA" : schema.title || file,
    status: published,
    body: {
      summary: schema.description || schema.title || file,
      requiredSections: requiredSections.length ? requiredSections : required,
      sourceFile: `schemas/${storedName}`,
    },
  })
}
schemaRefs.set("coa2.schema.json", "schema.mp_coa_option")
schemaRefs.set("coa3.schema.json", "schema.mp_coa_option")

const taskDir = path.join(historical, "configs", "task_profiles")
const tasks = new Map()
for (const file of fs.readdirSync(taskDir).filter((name) => name.endsWith(".yaml"))) {
  const profile = parseYaml(fs.readFileSync(path.join(taskDir, file), "utf8"))
  tasks.set(profile.task_id, profile)
}

function taskRecord(taskId, name, profile) {
  const schemaFile = profile.artifact?.schema_ref
  const promptFile = profile.prompt_template
  if (!schemaRefs.has(schemaFile)) throw new Error(`${taskId} schema ${schemaFile} was not imported`)
  if (!promptRefs.has(promptFile)) throw new Error(`${taskId} prompt ${promptFile} was not imported`)
  const id = `task.mp_${taskId}`
  write("tasks", `${id}.json`, {
    kind: "task",
    id,
    version: 0,
    name,
    status: published,
    body: {
      summary: String(profile.description || name).replace(/\s+/g, " ").trim(),
      prompt: ref(promptRefs.get(promptFile)),
      artifactSchema: ref(schemaRefs.get(schemaFile)),
      llm: LLM,
      requiredInputs: INPUTS[taskId] ?? [],
    },
  })
  return id
}

for (const [taskId, profile] of tasks) {
  if (INSERTS[taskId] || COA_INDEXES.has(taskId) || SHARED_TASKS.has(taskId)) continue
  taskRecord(taskId, TASK_NAMES[taskId] ?? profile.name, profile)
}
const coaOption = tasks.get("coa1")
taskRecord("coa_option", "COA", { ...coaOption, task_id: "coa_option" })

for (const [taskId, insert] of Object.entries(INSERTS)) {
  const profile = tasks.get(taskId)
  const id = `insert.mp_${taskId}`
  const body = {
    category: insert.category,
    executionMode: insert.executionMode,
    summary: String(profile.description).replace(/\s+/g, " ").trim(),
    prompt: ref(promptRefs.get(profile.prompt_template)),
  }
  if (insert.artifactSchema !== false) body.artifactSchema = ref(schemaRefs.get(profile.artifact.schema_ref))
  write("custom-inserts", `${id}.json`, {
    kind: "custom_insert",
    id,
    version: 0,
    name: profile.name.replace(/^MDMP /, ""),
    status: published,
    body,
  })
}

const purposeDir = path.join(historical, "configs", "purpose_profiles")
for (const file of fs.readdirSync(purposeDir).filter((name) => name.endsWith(".yaml"))) {
  const profile = parseYaml(fs.readFileSync(path.join(purposeDir, file), "utf8"))
  const key = file.replace(/\.yaml$/, "")
  const id = `purpose.mp_${key}`
  const summary = String(profile.description || titleFrom(key)).replace(/\s+/g, " ").trim()
  write("purposes", `${id}.json`, {
    kind: "purpose",
    id,
    version: 0,
    name: titleFrom(key),
    status: published,
    body: {
      summary,
      audience: firstText(profile.audience, ["commander", "executive", "planner"]),
      tone: summary.split(". ")[0],
      evidenceRequirement: "Cite supplied evidence for every claim. Mark insufficient evidence explicitly.",
      riskTolerance: firstText(profile.risk_tolerance, ["low", "moderate", "high"]),
      detail: firstText(profile.time_sensitivity, ["medium", "high", "low"]),
    },
  })
}

const baseContext = "context.mission_planning"
write("contexts", "mission-planning.json", {
  kind: "context",
  id: baseContext,
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

function taskRef(taskId) {
  return ref(`task.mp_${taskId}`)
}
function insertRef(taskId) {
  return ref(`insert.mp_${taskId}`)
}
function purposeRef(key) {
  return ref(`purpose.mp_${key}`)
}

function step(phaseId, spec, owner) {
  const dependencies = []
  const upstream = []
  for (const dep of spec.deps) {
    const source = owner.get(dep)
    if (source === phaseId) dependencies.push(dep)
    else if (source) upstream.push({ workflow: ref(PHASE_WORKFLOWS[source].id), nodeId: dep })
  }
  const node = {
    id: spec.id,
    title: spec.title,
    executable: true,
    task: taskRef(spec.task),
    dependencies,
  }
  if (upstream.length) node.upstream = upstream
  if (spec.prompt) node.prompt = ref(`prompt.mp_${spec.prompt}`)
  if (spec.schema) node.artifactSchema = ref(`schema.mp_${spec.schema}`)
  if (spec.inserts?.length) node.inserts = spec.inserts.map(insertRef)
  return node
}

const PHASE_WORKFLOWS = {
  receive_the_mission: { id: "workflow.mp_receive", file: "workflow.mp_receive.json", purpose: "planning" },
  mission_analysis: { id: "workflow.mp_mission_analysis", file: "workflow.mp_mission_analysis.json", purpose: "planning" },
  coa_development: { id: "workflow.mp_coa_development", file: "workflow.mp_coa_development.json", purpose: "decision_support" },
  coa_analysis: { id: "workflow.mp_coa_analysis", file: "workflow.mp_coa_analysis.json", purpose: "decision_support" },
  coa_comparison: { id: "workflow.mp_coa_comparison", file: "workflow.mp_coa_comparison.json", purpose: "decision_support" },
  coa_approval: { id: "workflow.mp_coa_approval", file: "workflow.mp_coa_approval.json", purpose: "execution_support" },
}

const phases = [
  {
    id: "receive_the_mission",
    title: "Receive the Mission",
    purpose: "planning",
    steps: [
      { id: "current_environment", title: "Current Environment", task: "currentEnvironment", deps: [] },
      { id: "running_estimate", title: "Running Estimate", task: "runningEstimate", deps: ["current_environment"] },
    ],
  },
  {
    id: "mission_analysis",
    title: "Mission Analysis",
    purpose: "planning",
    steps: [
      { id: "higher_hq_analysis", title: "Analysis of Higher HQ Mission", task: "higherHqAnalysis", deps: ["current_environment"] },
      { id: "mission_statement", title: "Mission Statement", task: "mission_statement_generation", deps: ["higher_hq_analysis", "running_estimate"], inserts: ["narrative_analysis", "assumptions", "assumption_analysis"] },
      { id: "intelligence_preparation", title: "Intelligence Preparation", task: "intelligencePreparation", deps: ["current_environment"], inserts: ["correlation"] },
      { id: "correlation_of_forces", title: "Correlation of Forces and Means", task: "cbtPower", deps: ["intelligence_preparation", "running_estimate"] },
      { id: "identified_tasks", title: "Identified Tasks", task: "identifiedTasks", deps: ["higher_hq_analysis", "mission_statement"] },
      { id: "intent_and_guidance", title: "Commander's Intent and Planning Guidance", task: "intentAndGuidance", deps: ["higher_hq_analysis"], inserts: ["narrative_analysis"] },
      { id: "priorities", title: "Priorities", task: "priorities", deps: ["intent_and_guidance", "identified_tasks"] },
    ],
  },
  {
    id: "coa_development",
    title: "COA Development",
    purpose: "decision_support",
    steps: [
      { id: "coa_options", title: "COA Options", task: "coaOptions", deps: ["mission_statement", "identified_tasks", "priorities", "correlation_of_forces"] },
      { id: "coa", title: "COA", task: "coa_option", deps: ["coa_options"] },
      { id: "initial_forces", title: "Array of Initial Forces", task: "initialForces", deps: ["correlation_of_forces", "coa_options"] },
      { id: "broad_concept", title: "Broad Concept", task: "broadConcept", deps: ["coa_options", "initial_forces"] },
      { id: "assign_hqs", title: "Assign Headquarters", task: "assignHQs", deps: ["broad_concept"] },
      { id: "coa_statement_and_sketch", title: "COA Statement and Sketch", task: "coaStatementAndSketch", deps: ["broad_concept", "assign_hqs"] },
    ],
  },
  {
    id: "coa_analysis",
    title: "COA Analysis",
    purpose: "decision_support",
    steps: [
      { id: "friendly_forces", title: "Friendly Forces", task: "friendlyForces", deps: ["initial_forces"] },
      { id: "wargaming_method", title: "Wargaming Method", task: "wargamingMethod", deps: ["coa", "broad_concept"], inserts: ["assumptions", "assumption_analysis"] },
      { id: "wargaming_assessment", title: "Wargaming Assessment", task: "wargamingAssessment", deps: ["wargaming_method"] },
    ],
  },
  {
    id: "coa_comparison",
    title: "COA Comparison",
    purpose: "decision_support",
    steps: [
      { id: "evaluation_criteria", title: "Evaluation Criteria", task: "evaluationCriteria", deps: ["intent_and_guidance"] },
      { id: "compare_coas", title: "Compare COAs", task: "compareCoas", deps: ["evaluation_criteria", "coa_options", "wargaming_assessment"], inserts: ["disagreements"] },
      { id: "decision_matrix", title: "Decision Matrix", task: "decisionMatrix", deps: ["compare_coas"] },
      { id: "selection", title: "Selection", task: "selection", deps: ["decision_matrix"], inserts: ["disagreements"] },
    ],
  },
  {
    id: "coa_approval",
    title: "COA Approval",
    purpose: "execution_support",
    steps: [
      { id: "approved_commander_intent", title: "Approved Commander's Intent", task: "intentAndGuidance", deps: ["selection", "intent_and_guidance"] },
      { id: "approved_mission_statement", title: "Approved Mission Statement", task: "mission_statement_generation", deps: ["selection", "mission_statement"], inserts: ["assumptions", "assumption_analysis"] },
    ],
  },
]

const owner = new Map()
for (const phase of phases) {
  for (const item of phase.steps) owner.set(item.id, phase.id)
}

for (const phase of phases) {
  const meta = PHASE_WORKFLOWS[phase.id]
  write("workflows", meta.file, {
    kind: "workflow",
    id: meta.id,
    version: 0,
    name: phase.title,
    status: published,
    body: {
      defaults: {
        llm: LLM,
        purpose: purposeRef(phase.purpose),
        evidenceRequirement: "Cite supplied evidence. Mark insufficient evidence explicitly.",
        detail: "High",
      },
      nodes: phase.steps.map((item) => step(phase.id, item, owner)),
    },
  })
}

const composition = phases.map((phase) => {
  const dependencies = [...new Set(phase.steps.flatMap((item) => item.deps.map((dep) => owner.get(dep)).filter((source) => source && source !== phase.id)))]
  return {
    id: phase.id,
    title: phase.title,
    executable: false,
    workflow: ref(PHASE_WORKFLOWS[phase.id].id),
    purpose: purposeRef(phase.purpose),
    dependencies,
  }
})

write("workflows", "workflow.mission_planning.json", {
  kind: "workflow",
  id: "workflow.mission_planning",
  version: 0,
  name: "Mission Planning",
  status: published,
  body: {
    defaults: {
      llm: LLM,
      purpose: purposeRef("planning"),
      evidenceRequirement: "Cite supplied evidence. Mark insufficient evidence explicitly.",
      detail: "High",
    },
    nodes: composition,
  },
})

const leaked = []
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) scan(full)
    else if (fs.readFileSync(full, "utf8").includes("sk-")) leaked.push(full)
  }
}
scan(out)
if (leaked.length) throw new Error(`Refusing to leave secrets in ${leaked.join(", ")}`)
console.log(`Wrote mission planning catalog to ${out}`)
