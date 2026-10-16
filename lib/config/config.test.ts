import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { acceptProposal, analyzeChangeSet, createCoaDocument, dependencyHealth, editWorking, generationSignature, latestCanonical, mergeChangeSet, proposeRegeneration, submitChangeSet } from "./documents.ts"
import { freezeManifest } from "./manifest.ts"
import { resolveNode } from "./resolve.ts"
import {
  coaCatalog,
  COA_NODE_ID,
  CONTEXT,
  LLM,
  PROMPT_COA_V0,
  PROMPT_COA_V1,
  TASK_COA,
  WORKFLOW_V0,
  WORKFLOW_V1,
} from "./seed.ts"
import type { Catalog, ContextBody, InsertBody, LlmBody, PromptBody, WorkflowBody } from "./types.ts"
import { preparePhaseRun, prepareStepRun } from "./execute.ts"
import { combineAreas } from "./area.ts"
import { createContextProfile, createMissionContext, saveContextVersion } from "./missions.ts"
import { createCatalogDraft, createInsertDraft, editDraft, forkVersion, materialize, publishVersion, saveCatalogEdit, saveRootWorkflowDraft, validateWorkflow, VersioningError, workflowBody, workflowNodeDelta, createWorkflowDraft } from "./versioning.ts"
import { loadMissionPlanningRecords } from "./load-mission-planning.ts"
import { originForEdit, tallyProvenance } from "./provenance.ts"
import { validateArtifact, validateArtifactText } from "./schema.ts"
import { Editor } from "@tiptap/react"
import { EditorState } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import { Provenance, ProvenanceTracking } from "../../components/provenance.ts"

function layer(resolved: { provenance: { field: string; layer: string }[] }, field: string) {
  return resolved.provenance.find((item) => item.field === field)?.layer
}

describe("template versioning", () => {
  it("keeps published v.0 unchanged when a user fork is created", () => {
    const base = materialize<PromptBody>(coaCatalog, PROMPT_COA_V0)
    const forked = materialize<PromptBody>(coaCatalog, PROMPT_COA_V1)
    assert.equal(base.role, forked.role)
    assert.match(base.instructions, /canonical constraints/)
    assert.doesNotMatch(base.instructions, /sustainment tradeoff/)
    assert.match(forked.instructions, /sustainment tradeoff/)
  })

  it("refuses to edit a published version and stores only the delta on the fork", () => {
    assert.throws(() => editDraft(coaCatalog, LLM, { temperature: 0.9 }), VersioningError)
    const drafted = forkVersion(coaCatalog, LLM, { temperature: 0.9 })
    const draft = drafted.records.find((record) => record.id === LLM.id && record.version === 1)
    assert.ok(draft)
    assert.equal(draft.status, "draft")
    assert.deepEqual(draft.forkedFrom, LLM)
    assert.deepEqual(draft.overrides, { temperature: 0.9 })
    assert.equal(draft.body, undefined)
    const published = publishVersion(drafted, { id: LLM.id, version: 1 })
    assert.throws(() => editDraft(published, { id: LLM.id, version: 1 }, { temperature: 0.1 }), VersioningError)
    const original = materialize<{ temperature: number }>(published, LLM)
    assert.equal(original.temperature, 0.2)
  })

  it("stores added, disabled, and rewired nodes as a workflow delta", () => {
    const base = materialize<WorkflowBody>(coaCatalog, WORKFLOW_V0)
    const next = base.nodes.flatMap((node) => {
      if (node.id === "constraints") return []
      if (node.id === "coa") return [{ ...node, dependencies: ["mission_analysis"] }]
      return [node]
    })
    next.push({
      id: "narrative",
      title: "Narrative",
      executable: true,
      parentNodeId: "analysis",
      task: TASK_COA,
      dependencies: ["mission_analysis"],
    })
    const delta = workflowNodeDelta(base.nodes, next)
    assert.equal(delta.constraints?.enabled, false)
    assert.deepEqual(delta.coa?.dependencies, ["mission_analysis"])
    assert.equal(delta.narrative?.title, "Narrative")
    const drafted = forkVersion(coaCatalog, WORKFLOW_V0, { nodes: delta })
    const body = materialize<WorkflowBody>(drafted, { id: WORKFLOW_V0.id, version: 2 })
    assert.equal(body.nodes.find((node) => node.id === "constraints")?.enabled, false)
    assert.deepEqual(body.nodes.find((node) => node.id === "coa")?.dependencies, ["mission_analysis"])
    assert.equal(body.nodes.find((node) => node.id === "narrative")?.parentNodeId, "analysis")
    assert.equal(validateWorkflow(body).length, 0)
    const published = materialize<PromptBody>(coaCatalog, PROMPT_COA_V0)
    const renamed = saveCatalogEdit(coaCatalog, PROMPT_COA_V0, { name: "Course of action prompt", body: { ...published, objective: "State the sustainment tradeoff." } })
    assert.equal(materialize<PromptBody>(renamed.catalog, PROMPT_COA_V0).objective, published.objective)
    const draft = renamed.catalog.records.find((item) => item.id === PROMPT_COA_V0.id && item.version === renamed.ref.version)
    assert.equal(draft?.status, "draft")
    assert.equal(draft?.name, "Course of action prompt")
    assert.deepEqual(draft?.overrides, { objective: "State the sustainment tradeoff." })
    const revised = saveCatalogEdit(renamed.catalog, renamed.ref, {
      name: "Course of action prompt",
      body: { ...published, objective: "State the sustainment tradeoff.", instructions: "Name the lift limit." },
    })
    const revisedDraft = revised.catalog.records.find((item) => item.id === PROMPT_COA_V0.id && item.version === revised.ref.version)
    assert.deepEqual(revisedDraft?.overrides, { objective: "State the sustainment tradeoff.", instructions: "Name the lift limit." })
    const reverted = saveCatalogEdit(revised.catalog, revised.ref, {
      name: "Course of action prompt",
      body: { ...published, instructions: "Name the lift limit." },
    })
    const revertedDraft = reverted.catalog.records.find((item) => item.id === PROMPT_COA_V0.id && item.version === reverted.ref.version)
    assert.deepEqual(revertedDraft?.overrides, { instructions: "Name the lift limit." })
    assert.throws(() => saveCatalogEdit(coaCatalog, PROMPT_COA_V0, { name: "COA Generation", body: published }), VersioningError)
    const resolved = resolveNode({ catalog: drafted, workflow: { id: WORKFLOW_V0.id, version: 2 }, nodeId: "narrative", context: CONTEXT })
    assert.equal(resolved.task.id, TASK_COA.id)
    const broken = validateWorkflow({ defaults: body.defaults, nodes: body.nodes.map((node) => (node.id === "narrative" ? { ...node, dependencies: ["missing"] } : node)) })
    assert.equal(broken.some((issue) => issue.nodeId === "narrative"), true)
  })

  it("creates an empty workflow draft without a published schema", () => {
    const created = createWorkflowDraft({ records: [] }, "Port security")
    const record = created.catalog.records[0]
    assert.equal(record?.kind, "workflow")
    assert.equal(record?.status, "draft")
    assert.equal(record?.forkedFrom, undefined)
    assert.deepEqual(record && "body" in record ? record.body : undefined, { defaults: {}, nodes: [] })
    const withSection = saveRootWorkflowDraft(created.catalog, created.ref, {
      nodes: { intake: { title: "Intake", executable: true, dependencies: [] } },
    })
    const again = saveRootWorkflowDraft(withSection, created.ref, {
      nodes: { review: { title: "Review", executable: true, dependencies: ["intake"] } },
    })
    const nodes = materialize<WorkflowBody>(again, created.ref).nodes
    assert.deepEqual(nodes.map((node) => node.title), ["Intake", "Review"])
    assert.deepEqual(nodes.find((node) => node.id === "review")?.dependencies, ["intake"])
  })

  it("creates a custom insert draft and keeps later edits in the body", () => {
    const created = createInsertDraft({ records: [] }, {
      name: "Assumption check",
      summary: "List assumptions the plan depends on.",
      category: "validation",
      executionMode: "pre",
    })
    const record = created.catalog.records[0]
    assert.equal(record?.kind, "custom_insert")
    assert.equal(record?.status, "draft")
    assert.equal(record?.forkedFrom, undefined)
    assert.equal(record?.id, "insert.assumption_check")
    assert.deepEqual(record && "body" in record ? record.body : undefined, {
      category: "validation",
      executionMode: "pre",
      summary: "List assumptions the plan depends on.",
    })
    const renamed = saveCatalogEdit(created.catalog, created.ref, {
      name: "Assumption check",
      body: { category: "validation", executionMode: "pre", summary: "Name every assumption before generation." },
    })
    const again = saveCatalogEdit(renamed.catalog, renamed.ref, {
      name: "Assumption review",
      body: { category: "analysis", executionMode: "pre", summary: "Name every assumption before generation." },
    })
    const body = materialize<InsertBody>(again.catalog, again.ref)
    assert.equal(body.summary, "Name every assumption before generation.")
    assert.equal(body.category, "analysis")
    const saved = again.catalog.records.find((item) => item.id === created.ref.id && item.version === 0)
    assert.equal(saved?.name, "Assumption review")
    assert.equal(saved?.overrides, undefined)
  })

  it("creates task, purpose, prompt, and artifact schema drafts", () => {
    const task = createCatalogDraft({ records: [] }, "task", {
      name: "Quay survey",
      body: { summary: "Describe the quay.", requiredInputs: ["Chart"] },
    })
    assert.equal(task.catalog.records[0]?.id, "task.quay_survey")
    assert.equal(task.catalog.records[0]?.status, "draft")
    const taskAgain = saveCatalogEdit(task.catalog, task.ref, {
      name: "Quay survey",
      body: { summary: "Describe the quay and its approaches.", requiredInputs: ["Chart"] },
    })
    const taskKept = saveCatalogEdit(taskAgain.catalog, taskAgain.ref, {
      name: "Quay survey",
      body: { summary: "Describe the quay and its approaches.", requiredInputs: ["Chart", "Tide"] },
    })
    const taskBody = materialize<{ summary: string; requiredInputs: string[] }>(taskKept.catalog, taskKept.ref)
    assert.equal(taskBody.summary, "Describe the quay and its approaches.")
    assert.deepEqual(taskBody.requiredInputs, ["Chart", "Tide"])

    const prompt = createCatalogDraft({ records: [] }, "prompt", {
      name: "Quay brief",
      body: { instructions: "Write the quay description." },
    })
    assert.equal(prompt.catalog.records[0]?.id, "prompt.quay_brief")
    const promptAgain = saveCatalogEdit(prompt.catalog, prompt.ref, {
      name: "Quay brief",
      body: { role: "Harbor analyst", objective: "", instructions: "Write the quay description.", constraints: "", output: "" },
    })
    const promptKept = saveCatalogEdit(promptAgain.catalog, promptAgain.ref, {
      name: "Quay brief",
      body: { role: "Harbor analyst", objective: "Support the landing plan", instructions: "Write the quay description.", constraints: "", output: "" },
    })
    const promptBody = materialize<PromptBody>(promptKept.catalog, promptKept.ref)
    assert.equal(promptBody.role, "Harbor analyst")
    assert.equal(promptBody.instructions, "Write the quay description.")
    assert.equal(promptBody.objective, "Support the landing plan")

    const purpose = createCatalogDraft({ records: [] }, "purpose", { name: "Landing brief", body: { summary: "Brief the landing force." } })
    assert.equal(purpose.catalog.records[0]?.kind, "purpose")
    const schema = createCatalogDraft({ records: [] }, "artifact_schema", { name: "Quay card", body: { summary: "A quay description.", requiredSections: ["Approaches"] } })
    assert.equal(schema.catalog.records[0]?.id, "schema.quay_card")
    assert.deepEqual(materialize<{ requiredSections: string[] }>(schema.catalog, schema.ref).requiredSections, ["Approaches"])
  })
})

describe("resolver", () => {
  const custom = resolveNode({ catalog: coaCatalog, workflow: WORKFLOW_V1, nodeId: COA_NODE_ID, context: CONTEXT })
  const base = resolveNode({ catalog: coaCatalog, workflow: WORKFLOW_V0, nodeId: COA_NODE_ID, context: CONTEXT })

  it("pins context as the situation and resolves purpose framing above it", () => {
    assert.equal(custom.contextBody.contextType, "system")
    assert.match(custom.contextBody.statement, /intelligence workflows/)
    assert.equal("audience" in custom.contextBody, false)
    assert.equal(custom.framing.audience, "Commander")
    assert.equal(layer(custom, "audience"), "purpose_profile")
    assert.equal(custom.provenance.some((item) => item.field === "context"), false)
  })

  it("uses the user prompt v.1 only on the forked workflow", () => {
    assert.equal(base.prompt.version, 0)
    assert.equal(layer(base, "prompt"), "task_profile")
    assert.equal(custom.prompt.version, 1)
    assert.equal(layer(custom, "prompt"), "custom_schema")
    assert.deepEqual(custom.task, base.task)
    assert.equal(custom.artifactSchema.version, 0)
    assert.equal(layer(custom, "artifactSchema"), "task_profile")
    assert.deepEqual(custom.parentWorkflow, WORKFLOW_V0)
    assert.deepEqual(custom.dependencies, ["mission_analysis", "constraints"])
  })

  it("lets a runtime instruction win without changing the pinned prompt", () => {
    const runtime = resolveNode({
      catalog: coaCatalog,
      workflow: WORKFLOW_V1,
      nodeId: COA_NODE_ID,
      context: CONTEXT,
      runtime: { tone: "Urgent", instruction: "Emphasize the northern route." },
    })
    assert.equal(runtime.framing.tone, "Urgent")
    assert.equal(layer(runtime, "tone"), "runtime_user")
    assert.equal(runtime.prompt.version, 1)
    assert.equal(runtime.runtimeInstruction, "Emphasize the northern route.")
  })

  it("freezes a stable manifest that changes when the contract changes", () => {
    const first = freezeManifest(custom)
    const second = freezeManifest(resolveNode({ catalog: coaCatalog, workflow: WORKFLOW_V1, nodeId: COA_NODE_ID, context: CONTEXT }))
    const baseManifest = freezeManifest(base)
    assert.equal(first.id, second.id)
    assert.notEqual(first.id, baseManifest.id)
    assert.equal(first.model, "gpt-4o")
    assert.equal(first.temperature, 0.2)
    const llm = materialize<{ apiKeyEnv: string }>(coaCatalog, LLM)
    assert.equal(llm.apiKeyEnv, "LITELLM_API_KEY")
    assert.equal(JSON.stringify(llm).includes("sk-"), false)
    assert.equal(JSON.stringify(first).includes("sk-"), false)
  })
})

describe("document state", () => {
  it("pins the generation to the manifest and the dependency versions it consumed", () => {
    const state = createCoaDocument()
    const coa = state.sections.find((section) => section.id === "coa")
    assert.ok(coa)
    const generation = coa.generations[0]
    assert.equal(generation.manifest.workflow.version, 1)
    assert.equal(generation.manifest.prompt.version, 1)
    assert.equal(generation.manifestId, generation.manifest.id)
    assert.deepEqual(
      generation.dependencies.map((item) => [item.sectionId, item.canonicalVersion]),
      [
        ["mission_analysis", 1],
        ["constraints", 1],
      ],
    )
    assert.equal(latestCanonical(coa).generationId, generation.id)
    assert.equal(dependencyHealth(coa, [
      { sectionId: "mission_analysis", canonicalVersion: 1 },
      { sectionId: "constraints", canonicalVersion: 1 },
    ]), "current")
    assert.equal(dependencyHealth(coa, [
      { sectionId: "mission_analysis", canonicalVersion: 1 },
      { sectionId: "constraints", canonicalVersion: 2 },
    ]), "potentially_stale")
  })

  it("allows one active change set and rejects a merge against a moved canonical", () => {
    const state = submitChangeSet(createCoaDocument(), "coa", "COA Bravo holds the southern quay.", "Alex Morgan", "CS-COA-1")
    assert.throws(() => submitChangeSet(state, "coa", "Another edit", "Alex Morgan", "CS-COA-2"))
    const merged = mergeChangeSet(state, "CS-COA-1")
    const coa = merged.sections.find((section) => section.id === "coa")
    assert.equal(latestCanonical(coa!).version, 2)
    assert.equal(coa!.changeSets[0].status, "merged")

    const advanced = {
      sections: state.sections.map((section) =>
        section.id === "constraints"
          ? {
              ...section,
              canonical: [...section.canonical, { version: 2, content: "Air lift is now available.", contentHash: "fp:next" }],
            }
          : section.id === "coa"
            ? {
                ...section,
                canonical: [...section.canonical, { version: 2, content: "Concurrent canonical.", contentHash: "fp:other" }],
              }
            : section,
      ),
    }
    assert.throws(() => mergeChangeSet(advanced, "CS-COA-1"), /409 Conflict/)
  })

  it("keeps canonical content unchanged while the working draft records revisions", () => {
    const edited = editWorking(createCoaDocument(), "coa", "COA Bravo holds the southern quay.", { name: "Alex Morgan", kind: "human" })
    const coa = edited.sections.find((section) => section.id === "coa")
    assert.equal(latestCanonical(coa!).version, 1)
    assert.equal(coa!.working?.content, "COA Bravo holds the southern quay.")
    assert.equal(coa!.revisions.length, 1)
    assert.equal(coa!.revisions[0].actor, "human")
  })

  it("freezes the change set snapshot and prepares an LLM explanation without calling the model", () => {
    const llm = materialize<LlmBody>(coaCatalog, LLM)
    const edited = editWorking(createCoaDocument(), "constraints", "Sustainment is limited to organic lift and local fuel.", { name: "Alex Morgan", kind: "human" })
    const submitted = analyzeChangeSet(submitChangeSet(edited, "constraints", "Sustainment is limited to organic lift and local fuel.", "Alex Morgan", "CS-CON-1"), "CS-CON-1", llm)
    const continued = editWorking(submitted, "constraints", "Sustainment is limited to organic lift, local fuel, and barges.", { name: "Alex Morgan", kind: "human" })
    const constraints = continued.sections.find((section) => section.id === "constraints")
    const changeSet = constraints!.changeSets[0]
    assert.equal(changeSet.candidateContent, "Sustainment is limited to organic lift and local fuel.")
    assert.equal(changeSet.analysis?.chat.executed, false)
    assert.equal(changeSet.analysis?.chat.reason, "llm_unavailable_on_this_system")
    assert.equal(changeSet.analysis?.chat.prepared.body.model, "gpt-4o")
    assert.equal(changeSet.analysis?.chat.prepared.body.temperature, 0.2)
    assert.equal(changeSet.analysis?.chat.prepared.url, "https://litellm.iho.leidos.com/v1/chat/completions")
    assert.equal(changeSet.analysis?.chat.prepared.headerName, "x-litellm-api-key")
    assert.equal(changeSet.analysis?.chat.prepared.apiKeyEnv, "LITELLM_API_KEY")
    assert.equal(JSON.stringify(changeSet.analysis).includes("sk-"), false)
    assert.equal(constraints!.revisions.length, 2)
  })

  it("proposes regeneration from the pinned manifest and applies a completion only to the working draft", () => {
    const llm = materialize<LlmBody>(coaCatalog, LLM)
    const base = createCoaDocument()
    const constraintsEdited = submitChangeSet(base, "constraints", "Air lift is now available.", "Alex Morgan", "CS-CON-1")
    const constraintsMerged = mergeChangeSet(constraintsEdited, "CS-CON-1")
    const upstream = constraintsMerged.sections.map((section) => ({
      sectionId: section.id,
      canonicalVersion: latestCanonical(section).version,
      content: latestCanonical(section).content,
    }))
    const proposed = proposeRegeneration(constraintsMerged, { sectionId: "coa", id: "GEN-COA-2", llm, upstream })
    const coa = proposed.sections.find((section) => section.id === "coa")
    assert.equal(coa!.proposal?.case, "dependency_changed")
    assert.equal(coa!.proposal?.workingDiverged, false)
    assert.equal(coa!.proposal?.chat.executed, false)
    assert.equal(coa!.proposal?.chat.prepared.body.model, llm.model)
    assert.match(coa!.proposal?.chat.prepared.body.messages[1].content ?? "", /Air lift is now available/)
    assert.equal(latestCanonical(coa!).content, "COA Alpha uses the northern route and accepts a longer sustainment line.")

    const diverged = editWorking(proposed, "coa", "COA Alpha keeps the northern route and notes a local amendment.", { name: "Alex Morgan", kind: "human" })
    const reproposed = proposeRegeneration(diverged, { sectionId: "coa", id: "GEN-COA-3", llm, upstream, userInstruction: "Emphasize the sustainment line." })
    const amended = reproposed.sections.find((section) => section.id === "coa")
    assert.equal(amended!.proposal?.case, "dependency_changed")
    assert.equal(amended!.proposal?.workingDiverged, true)
    assert.equal(amended!.working?.content, "COA Alpha keeps the northern route and notes a local amendment.")

    const accepted = acceptProposal(proposed, "coa", "COA Alpha uses the northern route and accounts for available air lift.", "AI")
    const acceptedCoa = accepted.sections.find((section) => section.id === "coa")
    assert.equal(latestCanonical(acceptedCoa!).version, 1)
    assert.equal(acceptedCoa!.working?.content, "COA Alpha uses the northern route and accounts for available air lift.")
    assert.equal(acceptedCoa!.generations.length, 2)
    assert.equal(acceptedCoa!.generations[1].previousGenerationId, "GEN-COA-1")
    assert.equal(acceptedCoa!.revisions.at(-1)?.actor, "ai")
    assert.equal(generationSignature(acceptedCoa!.generations[1]).promptTemplate.version, 1)
    assert.equal(acceptedCoa!.proposal, undefined)
    const unchanged = proposeRegeneration(base, {
      sectionId: "coa",
      id: "proposal-unchanged",
      llm,
      upstream: base.sections.map((section) => ({
        sectionId: section.id,
        canonicalVersion: latestCanonical(section).version,
        content: latestCanonical(section).content,
      })),
    })
    assert.equal(unchanged.sections.find((section) => section.id === "coa")?.proposal?.case, "unchanged")
    const instructed = proposeRegeneration(base, {
      sectionId: "coa",
      id: "proposal-context",
      llm,
      upstream: base.sections.map((section) => ({
        sectionId: section.id,
        canonicalVersion: latestCanonical(section).version,
        content: latestCanonical(section).content,
      })),
      userInstruction: "Emphasize manpower constraints.",
    })
    assert.equal(instructed.sections.find((section) => section.id === "coa")?.proposal?.case, "user_context")
  })
})

describe("mission planning import", () => {
  const catalog: Catalog = { records: [...coaCatalog.records, ...loadMissionPlanningRecords()] }
  const workflow = { id: "workflow.mission_planning", version: 0 }
  const mission = { id: "context.mission_planning", version: 0 }

  it("loads the mission planning context, phases, and catalog mappings", () => {
    const body = workflowBody(catalog, workflow)
    assert.deepEqual(
      body.nodes.filter((node) => !node.parentNodeId).map((node) => node.title),
      ["Receive the Mission", "Mission Analysis", "COA Development", "COA Analysis", "COA Comparison", "COA Approval"],
    )
    assert.deepEqual(validateWorkflow(body), [])
    assert.deepEqual(
      body.nodes.map((node) => node.workflow?.id),
      [
        "workflow.mp_receive",
        "workflow.mp_mission_analysis",
        "workflow.mp_coa_development",
        "workflow.mp_coa_analysis",
        "workflow.mp_coa_comparison",
        "workflow.mp_coa_approval",
      ],
    )
    assert.equal(body.nodes.some((node) => node.task), false)
    for (const phase of body.nodes) {
      if (!phase.workflow) continue
      const phaseBody = workflowBody(catalog, phase.workflow)
      assert.deepEqual(validateWorkflow(phaseBody), [])
      assert.ok(phaseBody.nodes.every((node) => node.executable && node.task))
    }
    assert.equal(catalog.records.some((record) => record.id === "task.mp_coa1"), false)
    assert.equal(catalog.records.some((record) => record.id === "task.mp_correlation"), false)
    assert.equal(catalog.records.some((record) => record.kind === "custom_insert" && record.id === "insert.mp_correlation"), true)
    const assumptionsPrompt = catalog.records.find((record) => record.id === "prompt.mp_mdmp_assumptions")
    assert.deepEqual(assumptionsPrompt?.forkedFrom, { id: "prompt.mp_mdmp_base", version: 0 })
    assert.deepEqual(Object.keys(assumptionsPrompt?.overrides ?? {}), ["objective"])
    const assumptionsBody = materialize<{ constraints: string; instructions: string }>(catalog, { id: "prompt.mp_mdmp_assumptions", version: 0 })
    assert.match(assumptionsBody.constraints, /NO HALLUCINATION/)
    assert.match(assumptionsBody.constraints, /DO NOT use general knowledge/)
    assert.match(assumptionsBody.instructions, /CHAIN-OF-THOUGHT/)
    const contexts = catalog.records.filter((record) => record.kind === "context" && (record.id === "context.mission_planning" || record.id.startsWith("context.miso")))
    assert.deepEqual(contexts.map((record) => record.id), ["context.mission_planning"])
    const serialized = JSON.stringify(catalog.records.filter((record) => record.id.startsWith("workflow.mission")))
    assert.equal(serialized.includes("sk-"), false)
  })

  it("resolves the mission planning context against its workflow", () => {
    const situation = materialize<ContextBody>(catalog, mission)
    assert.match(situation.statement, /joint planning process/)
    assert.equal(situation.organization, "Planning staff")
    assert.match(situation.standingGuidance ?? "", /joint planning process/)
    assert.match(situation.evidenceStandard ?? "", /supplied evidence/)
    assert.equal(situation.areaOfResponsibility, "The command's assigned area of responsibility")

    const assumptions = catalog.records.find((record) => record.id === "insert.mp_assumptions")
    assert.equal(assumptions?.kind, "custom_insert")
    assert.equal(assumptions?.name, "Assumptions")
    assert.equal(assumptions && "body" in assumptions ? assumptions.body?.artifactSchema : undefined, undefined)
    assert.equal(catalog.records.some((record) => record.id === "task.mp_assumptions" || record.id === "schema.mp_assumptions"), false)
    assert.equal(workflowBody(catalog, workflow).nodes.some((node) => ["assumptions", "coa_assumptions", "updated_assumptions"].includes(node.id)), false)
    const assumptionInsert = { id: "insert.mp_assumptions", version: 0 }
    const analysis = { id: "workflow.mp_mission_analysis", version: 0 }
    const coaAnalysis = { id: "workflow.mp_coa_analysis", version: 0 }
    const approval = { id: "workflow.mp_coa_approval", version: 0 }
    const development = { id: "workflow.mp_coa_development", version: 0 }
    for (const [phase, nodeId] of [
      [analysis, "mission_statement"],
      [coaAnalysis, "wargaming_method"],
      [approval, "approved_mission_statement"],
    ] as const) {
      assert.ok(resolveNode({ catalog, workflow: phase, nodeId, context: mission }).inserts.some((item) => item.id === assumptionInsert.id))
    }
    assert.equal(resolveNode({ catalog, workflow: approval, nodeId: "approved_mission_statement", context: mission }).task.id, "task.mp_mission_statement_generation")
    assert.equal(resolveNode({ catalog, workflow: approval, nodeId: "approved_commander_intent", context: mission }).task.id, "task.mp_intentAndGuidance")
    assert.equal(
      catalog.records.some((record) =>
        ["task.mp_coaAssumptions", "task.mp_updatedAssumptions", "task.mp_approvedMissionStatement", "task.mp_approvedCdrIntent", "task.mp_commanders_intent_extraction"].includes(record.id),
      ),
      false,
    )
    assert.equal(resolveNode({ catalog, workflow: analysis, nodeId: "mission_statement", context: mission }).purpose.id, "purpose.mp_planning")

    const coa = resolveNode({ catalog, workflow: development, nodeId: "coa", context: mission })
    assert.equal(coa.task.id, "task.mp_coa_option")
    assert.equal(coa.prompt.id, "prompt.mp_coa_option")
    assert.equal(coa.artifactSchema.id, "schema.mp_coa_option")
    assert.equal(coa.purpose.id, "purpose.mp_decision_support")
    assert.equal(catalog.records.some((record) => record.id === "prompt.mp_mdmp_coa2" || record.id === "schema.mp_coa3"), false)
    const wargame = resolveNode({ catalog, workflow: coaAnalysis, nodeId: "wargaming_method", context: mission })
    assert.deepEqual(wargame.dependencies, [])
    assert.deepEqual(
      workflowBody(catalog, coaAnalysis).nodes.find((node) => node.id === "wargaming_method")?.upstream?.map((item) => item.nodeId),
      ["coa", "broad_concept"],
    )
    assert.equal(resolveNode({ catalog, workflow: analysis, nodeId: "correlation_of_forces", context: mission }).task.id, "task.mp_cbtPower")
  })

  it("stores a mission as a sibling fork and leaves the situation unchanged", () => {
    const created = createMissionContext(catalog, mission, {
      name: "Strait transit",
      areaOfInterest: "Strait of Hormuz",
      areaOfResponsibility: "Fifth Fleet",
      timeWindow: "48 hours",
      statement: "Protect transit through the strait.",
    })
    const record = created.catalog.records.find((item) => item.id === created.ref.id && item.version === 0)
    assert.equal(record?.name, "Strait transit")
    assert.equal(record?.status, "published")
    assert.deepEqual(record?.forkedFrom, mission)
    assert.deepEqual(record?.overrides, {
      statement: "Protect transit through the strait.",
      timeWindow: "48 hours",
      areaOfInterest: "Strait of Hormuz",
      areaOfResponsibility: "Fifth Fleet",
    })
    const parent = materialize<ContextBody>(created.catalog, mission)
    assert.match(parent.statement, /joint planning process/)
    assert.equal(parent.areaOfInterest, undefined)
    const body = materialize<ContextBody>(created.catalog, created.ref)
    assert.equal(body.areaOfInterest, "Strait of Hormuz")
    assert.equal(body.areaOfResponsibility, "Fifth Fleet")
    assert.equal(body.organization, "Planning staff")
    assert.equal(body.standingGuidance, parent.standingGuidance)
    assert.equal(body.evidenceStandard, parent.evidenceStandard)
    assert.equal(body.statement, "Protect transit through the strait.")
  })

  it("creates a published context and an effort that adds time and geography", () => {
    const created = createContextProfile(catalog, {
      name: "Harbor command",
      statement: "Secure ports for the assigned fleet.",
      organization: "Naval component staff. The maritime operations center directs port security.",
      standingGuidance: "Keep assumptions explicit.",
      evidenceStandard: "Cite the source for every claim.",
      knownConstraints: "No unsourced weather claims\nHold fires inside the port",
    })
    const context = created.catalog.records.find((item) => item.id === created.ref.id)
    assert.equal(context?.status, "published")
    assert.equal(context?.forkedFrom, undefined)
    assert.equal(context && "body" in context ? context.body?.organization : "", "Naval component staff. The maritime operations center directs port security.")
    assert.deepEqual(context && "body" in context ? context.body?.knownConstraints : [], ["No unsourced weather claims", "Hold fires inside the port"])
    const effort = createMissionContext(created.catalog, created.ref, {
      name: "Night transit",
      timeWindow: "12 hours",
      areaOfInterest: "Inner harbor",
    })
    const effortRecord = effort.catalog.records.find((item) => item.id === effort.ref.id)
    assert.deepEqual(effortRecord?.forkedFrom, created.ref)
    assert.deepEqual(effortRecord?.overrides, { timeWindow: "12 hours", areaOfInterest: "Inner harbor" })
    const resolved = materialize<ContextBody>(effort.catalog, effort.ref)
    assert.equal(resolved.statement, "Secure ports for the assigned fleet.")
    assert.equal(resolved.organization, "Naval component staff. The maritime operations center directs port security.")
    assert.equal(resolved.timeWindow, "12 hours")
    assert.equal(resolved.areaOfInterest, "Inner harbor")
    assert.equal(resolved.evidenceStandard, "Cite the source for every claim.")
    const france = { type: "Polygon" as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    const germany = { type: "MultiPolygon" as const, coordinates: [[[[2, 2], [3, 2], [3, 3], [2, 2]]]] }
    const outline = combineAreas([france, germany])
    assert.equal(outline?.type, "MultiPolygon")
    const mapped = createMissionContext(created.catalog, created.ref, {
      name: "Mapped transit",
      areaOfInterest: "France, Germany",
      areaOfInterestGeometry: outline,
    })
    const mappedBody = materialize<ContextBody>(mapped.catalog, mapped.ref)
    assert.equal(mappedBody.areaOfInterest, "France, Germany")
    assert.deepEqual(mappedBody.areaOfInterestGeometry, outline)
    assert.equal(mappedBody.organization, "Naval component staff. The maritime operations center directs port security.")
  })

  it("publishes the next context version and leaves the edited version unchanged", () => {
    const created = createContextProfile(catalog, {
      name: "Harbor command",
      statement: "Secure ports for the assigned fleet.",
      organization: "Naval component staff.",
      standingGuidance: "Keep assumptions explicit.",
      knownConstraints: "No unsourced weather claims",
    })
    const saved = saveContextVersion(created.catalog, created.ref, {
      name: "Harbor command",
      statement: "Secure ports and inland waterways for the assigned fleet.",
      organization: "Naval component staff.",
      standingGuidance: "Keep assumptions explicit.",
      knownConstraints: "No unsourced weather claims",
    })
    assert.deepEqual(saved.ref, { id: created.ref.id, version: 1 })
    const previous = saved.catalog.records.find((item) => item.id === created.ref.id && item.version === 0)
    const next = saved.catalog.records.find((item) => item.id === created.ref.id && item.version === 1)
    assert.equal(previous?.status, "published")
    assert.equal(next?.status, "published")
    assert.deepEqual(next?.forkedFrom, created.ref)
    assert.deepEqual(next?.overrides, { statement: "Secure ports and inland waterways for the assigned fleet." })
    assert.equal(materialize<ContextBody>(saved.catalog, created.ref).statement, "Secure ports for the assigned fleet.")
    assert.equal(materialize<ContextBody>(saved.catalog, saved.ref).statement, "Secure ports and inland waterways for the assigned fleet.")
    assert.equal(materialize<ContextBody>(saved.catalog, saved.ref).organization, "Naval component staff.")
    const again = saveContextVersion(saved.catalog, saved.ref, {
      name: "Fleet ports",
      statement: "Secure ports and inland waterways for the assigned fleet.",
      organization: "Naval component staff.",
      standingGuidance: "Keep assumptions explicit.",
      knownConstraints: "No unsourced weather claims",
    })
    assert.equal(again.ref.version, 2)
    assert.throws(
      () =>
        saveContextVersion(saved.catalog, saved.ref, {
          name: "Harbor command",
          statement: "Secure ports and inland waterways for the assigned fleet.",
          organization: "Naval component staff.",
          standingGuidance: "Keep assumptions explicit.",
          knownConstraints: "No unsourced weather claims",
        }),
      VersioningError,
    )
  })

  it("prepares a step run and holds the next step until that one has been triggered", () => {
    const records = loadMissionPlanningRecords()
    const catalog = { records: [...coaCatalog.records, ...records] }
    const context = { id: "context.mission_planning", version: 0 }
    const workflow = { id: "workflow.mp_receive", version: 0 }
    const first = prepareStepRun({ catalog, workflow, nodeId: "current_environment", context, completed: [] })
    assert.equal(first.status, "prepared")
    assert.equal(first.chat?.executed, false)
    assert.match(first.objective, /PMESII/)
    assert.match(first.chat?.prepared.body.messages[0].content ?? "", /NO HALLUCINATION/)
    assert.match(first.chat?.prepared.body.messages[0].content ?? "", /Required sections: display_text, factors/)
    assert.match(first.chat?.prepared.body.messages[1].content ?? "", /MISSION CONTEXT/)
    assert.doesNotMatch(first.chat?.prepared.body.messages.map((message) => message.content).join("\n") ?? "", /\{\{/)
    const held = prepareStepRun({ catalog, workflow, nodeId: "running_estimate", context, completed: [] })
    assert.equal(held.status, "blocked")
    assert.deepEqual(held.waitingOn, ["Current Environment"])
    const phase = preparePhaseRun({ catalog, workflow, context, nodeIds: ["current_environment", "running_estimate"], completed: [] })
    assert.deepEqual(phase.map((item) => item.status), ["prepared", "prepared"])
  })

  it("validates an artifact against the step JSON Schema", () => {
    const schema = loadMissionPlanningRecords().find((record) => record.id === "schema.mp_currentEnvironment")
    assert.equal(schema?.kind, "artifact_schema")
    if (schema?.kind !== "artifact_schema" || !schema.body) throw new Error("missing schema")
    const valid = validateArtifact(schema.body, {
      artifact_type: "CURRENT_ENVIRONMENT",
      schema_version: "1.0.0",
      context: {
        mission_id: "tab-check",
        mission_type: "mission",
        organization_id: "Planning staff",
        team_id: "planning",
        aoi: "Strait of Hormuz",
        time_window: "48 hours",
        task_id: "currentEnvironment",
        purpose_id: "purpose.mp_planning",
      },
      display_text: "The supplied evidence does not yet describe the operational environment.",
      factors: [],
      citations: [],
    })
    assert.equal(valid.valid, true)
    const invalid = validateArtifact(schema.body, { artifact_type: "CURRENT_ENVIRONMENT" })
    assert.equal(invalid.valid, false)
    assert.ok(invalid.errors.some((error) => error.path === "/display_text"))
    const unparsed = validateArtifactText(schema.body, "{")
    assert.equal(unparsed.valid, false)
    assert.match(unparsed.errors[0]?.message ?? "", /not valid JSON/)
  })

  it("tags AI text, human-added text, and human-modified text differently", () => {
    assert.equal(originForEdit("ai", []), "ai")
    assert.equal(originForEdit("ai", ["human-added"]), "ai")
    assert.equal(originForEdit("human", []), "human-added")
    assert.equal(originForEdit("human", ["human-added"]), "human-added")
    assert.equal(originForEdit("human", ["ai"]), "human-modified")
    assert.equal(originForEdit("human", ["untagged"]), "human-modified")
    assert.equal(originForEdit("human", ["human-modified"]), "human-modified")
    assert.equal(originForEdit("human", ["human-added", "ai"]), "human-modified")
    const html = '<p><span data-origin="ai">Alpha</span> <span data-origin="human-added">added</span> <span data-origin="human-modified">edit</span></p>'
    assert.deepEqual(tallyProvenance(html), { ai: 5, humanAdded: 5, humanModified: 4 })
  })

  it("marks editor text as AI, human-added, or human-modified", () => {
    const origins = (state: EditorState) => {
      const found: string[] = []
      state.doc.descendants((node) => {
        if (!node.isText) return
        const mark = node.marks.find((item) => item.type.name === "provenance")
        found.push(`${mark?.attrs.origin ?? "untagged"}:${node.text}`)
      })
      return found
    }
    const tracked = (trackAs: "human" | "ai", content: Record<string, unknown>) => {
      const editor = new Editor({
        extensions: [StarterKit, Provenance, ProvenanceTracking.configure({ trackAs })],
        content,
      })
      const state = EditorState.create({
        schema: editor.schema,
        doc: editor.state.doc,
        plugins: editor.extensionManager.plugins.filter(Boolean),
      })
      editor.destroy()
      return state
    }
    const humanBase = tracked("human", { type: "doc", content: [{ type: "paragraph" }] })
    const human = humanBase.apply(humanBase.tr.insertText("Harbor"))
    assert.deepEqual(origins(human), ["human-added:Harbor"])

    const completionBase = tracked("ai", { type: "doc", content: [{ type: "paragraph" }] })
    const completion = completionBase.apply(completionBase.tr.insertText("Model text"))
    assert.deepEqual(origins(completion), ["ai:Model text"])

    const draftBase = tracked("human", {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Harbor is open.", marks: [{ type: "provenance", attrs: { origin: "ai" } }] }],
      }],
    })
    const draft = draftBase.apply(draftBase.tr.insertText("closed", 11, 15))
    assert.deepEqual(origins(draft), ["ai:Harbor is ", "human-modified:closed", "ai:."])
  })
})
