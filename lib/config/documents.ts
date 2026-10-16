import { contentHash, fingerprint } from "./hash.ts"
import { planUnavailableChat, type UnavailableChat } from "./llm.ts"
import { freezeManifest } from "./manifest.ts"
import { tallyProvenance, type ProvenanceTally } from "./provenance.ts"
import { resolveNode } from "./resolve.ts"
import { coaCatalog, CONTEXT, COA_NODE_ID, WORKFLOW_V1 } from "./seed.ts"
import type { Catalog, LlmBody, RuntimeManifest, VersionRef } from "./types.ts"

export class DocumentStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DocumentStateError"
  }
}

export type ChangeSetStatus = "submitted" | "approved" | "rejected" | "merged" | "withdrawn"

export interface CanonicalVersion {
  version: number
  content: string
  contentHash: string
  generationId?: string
  changeSetId?: string
}

export interface GenerationDependency {
  sectionId: string
  canonicalVersion: number
  contentHash: string
}

export interface GenerationRecord {
  id: string
  sectionId: string
  manifestId: string
  manifest: RuntimeManifest
  dependencies: GenerationDependency[]
  dependencyFingerprint: string
  contentHash: string
  previousGenerationId?: string
  userContextHash?: string
  createdBy: string
}

export interface GenerationSignature {
  generationId: string
  targetSection: string
  previousGenerationId?: string
  promptTemplate: VersionRef
  model: string
  temperature: number
  dependencyFingerprint: string
  userContextHash?: string
  contentHash: string
  createdBy: string
}

export interface RevisionEvent {
  id: string
  sectionId: string
  sequence: number
  actor: "human" | "ai"
  actorName: string
  reason: "edit" | "proposal_accepted"
  generationId?: string
  contentHash: string
  provenance: ProvenanceTally
}

export interface TextChange {
  changed: boolean
  summary: string
}

export interface ChangeSetAnalysis {
  summary: string
  changed: boolean
  chat: UnavailableChat
}

export type RegenerationCase = "dependency_changed" | "user_context" | "unchanged"

export interface RegenerationProposal {
  id: string
  case: RegenerationCase
  baselineHash: string
  workingDiverged: boolean
  chat: UnavailableChat
}

export interface ChangeSetRecord {
  id: string
  sectionId: string
  baseVersion: number
  candidateContent: string
  candidateHash: string
  status: ChangeSetStatus
  submittedBy: string
  mergedVersion?: number
  analysis?: ChangeSetAnalysis
}

export interface SectionRecord {
  id: string
  title: string
  canonical: CanonicalVersion[]
  working: { baseVersion: number; content: string } | null
  revisions: RevisionEvent[]
  changeSets: ChangeSetRecord[]
  generations: GenerationRecord[]
  proposal?: RegenerationProposal
}

export interface DocumentState {
  sections: SectionRecord[]
}

export function latestCanonical(section: SectionRecord): CanonicalVersion {
  return section.canonical[section.canonical.length - 1]
}

export function dependencyFingerprint(dependencies: GenerationDependency[]): string {
  const input = [...dependencies]
    .sort((a, b) => a.sectionId.localeCompare(b.sectionId))
    .map((item) => `${item.sectionId}:${item.canonicalVersion}:${item.contentHash}`)
    .join("|")
  return `dep:${fingerprint(input)}`
}

function replaceSection(state: DocumentState, section: SectionRecord): DocumentState {
  return { sections: state.sections.map((item) => (item.id === section.id ? section : item)) }
}

function sectionById(state: DocumentState, sectionId: string): SectionRecord {
  const section = state.sections.find((item) => item.id === sectionId)
  if (!section) throw new DocumentStateError(`Unknown section ${sectionId}`)
  return section
}

export function createGeneration(
  state: DocumentState,
  input: {
    id: string
    sectionId: string
    manifest: RuntimeManifest
    dependencies: GenerationDependency[]
    content: string
    asCanonical?: boolean
    /** Stamp this generation onto the current canonical row instead of creating another version. */
    linkCanonical?: boolean
    previousGenerationId?: string
    userContextHash?: string
    createdBy?: string
  },
): DocumentState {
  const section = sectionById(state, input.sectionId)
  const generation: GenerationRecord = {
    id: input.id,
    sectionId: input.sectionId,
    manifestId: input.manifest.id,
    manifest: input.manifest,
    dependencies: input.dependencies.map((item) => ({ ...item })),
    dependencyFingerprint: dependencyFingerprint(input.dependencies),
    contentHash: contentHash(input.content),
    previousGenerationId: input.previousGenerationId,
    userContextHash: input.userContextHash,
    createdBy: input.createdBy ?? "system",
  }
  const canonical = input.asCanonical
    ? [
        ...section.canonical,
        {
          version: section.canonical.length ? latestCanonical(section).version + 1 : 1,
          content: input.content,
          contentHash: generation.contentHash,
          generationId: generation.id,
        },
      ]
    : input.linkCanonical
      ? section.canonical.map((item, index) => (index === section.canonical.length - 1 ? { ...item, generationId: generation.id } : item))
      : section.canonical
  return replaceSection(state, { ...section, canonical, generations: [...section.generations, generation] })
}

export function submitChangeSet(state: DocumentState, sectionId: string, content: string, submittedBy: string, id: string): DocumentState {
  const section = sectionById(state, sectionId)
  if (section.changeSets.some((changeSet) => changeSet.status === "submitted")) {
    throw new DocumentStateError(`Section ${sectionId} already has an active change set`)
  }
  const base = latestCanonical(section)
  const changeSet: ChangeSetRecord = {
    id,
    sectionId,
    baseVersion: base.version,
    candidateContent: content,
    candidateHash: contentHash(content),
    status: "submitted",
    submittedBy,
  }
  return replaceSection(state, { ...section, changeSets: [...section.changeSets, changeSet] })
}

export function mergeChangeSet(state: DocumentState, changeSetId: string): DocumentState {
  const section = state.sections.find((item) => item.changeSets.some((changeSet) => changeSet.id === changeSetId))
  if (!section) throw new DocumentStateError(`Unknown change set ${changeSetId}`)
  const changeSet = section.changeSets.find((item) => item.id === changeSetId)
  if (!changeSet || changeSet.status !== "submitted") throw new DocumentStateError(`Change set ${changeSetId} is not submitted`)
  const current = latestCanonical(section)
  if (current.version !== changeSet.baseVersion) {
    throw new DocumentStateError(`409 Conflict — ${changeSetId} is based on v.${changeSet.baseVersion}, current canonical is v.${current.version}`)
  }
  const nextVersion = current.version + 1
  const canonical: CanonicalVersion = {
    version: nextVersion,
    content: changeSet.candidateContent,
    contentHash: changeSet.candidateHash,
    changeSetId: changeSet.id,
  }
  const working =
    section.working && section.working.content !== changeSet.candidateContent
      ? { baseVersion: nextVersion, content: section.working.content }
      : null
  return replaceSection(state, {
    ...section,
    canonical: [...section.canonical, canonical],
    working,
    changeSets: section.changeSets.map((item) => (item.id === changeSetId ? { ...item, status: "merged" as const, mergedVersion: nextVersion } : item)),
  })
}

export function dependencyHealth(section: SectionRecord, current: { sectionId: string; canonicalVersion: number }[]): "current" | "potentially_stale" {
  const generation = section.generations[section.generations.length - 1]
  if (!generation) return "current"
  const stale = generation.dependencies.some((dependency) => {
    const live = current.find((item) => item.sectionId === dependency.sectionId)
    return live !== undefined && live.canonicalVersion !== dependency.canonicalVersion
  })
  return stale ? "potentially_stale" : "current"
}

function canonicalSection(id: string, title: string, content: string): SectionRecord {
  return {
    id,
    title,
    canonical: [{ version: 1, content, contentHash: contentHash(content) }],
    working: null,
    revisions: [],
    changeSets: [],
    generations: [],
  }
}

/** Initial COA document. The COA section's generation is pinned to the v.1 workflow manifest. */
export function createCoaDocument(catalog: Catalog = coaCatalog): DocumentState {
  const mission = canonicalSection("mission_analysis", "Mission Analysis", "The force secures the port for 72 hours.")
  const constraints = canonicalSection("constraints", "Constraints", "Sustainment is limited to organic lift.")
  const manifest = freezeManifest(resolveNode({ catalog, workflow: WORKFLOW_V1, nodeId: COA_NODE_ID, context: CONTEXT }))
  const coa = canonicalSection("coa", "Course of Action", "COA Alpha uses the northern route and accepts a longer sustainment line.")
  const withCoa: DocumentState = { sections: [mission, constraints, coa] }
  return createGeneration(withCoa, {
    id: "GEN-COA-1",
    sectionId: "coa",
    manifest,
    dependencies: [mission, constraints].map((section) => ({
      sectionId: section.id,
      canonicalVersion: latestCanonical(section).version,
      contentHash: latestCanonical(section).contentHash,
    })),
    content: latestCanonical(coa).content,
    linkCanonical: true,
  })
}

export function generationSignature(generation: GenerationRecord): GenerationSignature {
  return {
    generationId: generation.id,
    targetSection: generation.sectionId,
    previousGenerationId: generation.previousGenerationId,
    promptTemplate: generation.manifest.prompt,
    model: generation.manifest.model,
    temperature: generation.manifest.temperature,
    dependencyFingerprint: generation.dependencyFingerprint,
    userContextHash: generation.userContextHash,
    contentHash: generation.contentHash,
    createdBy: generation.createdBy,
  }
}

export function describeTextChange(base: string, candidate: string): TextChange {
  if (base === candidate) return { changed: false, summary: "The candidate matches the canonical base." }
  let start = 0
  while (start < base.length && start < candidate.length && base[start] === candidate[start]) start += 1
  let baseEnd = base.length
  let candidateEnd = candidate.length
  while (baseEnd > start && candidateEnd > start && base[baseEnd - 1] === candidate[candidateEnd - 1]) {
    baseEnd -= 1
    candidateEnd -= 1
  }
  const removed = base.slice(start, baseEnd)
  const added = candidate.slice(start, candidateEnd)
  return { changed: true, summary: `Replaced “${removed}” with “${added}”.` }
}

export function editWorking(
  state: DocumentState,
  sectionId: string,
  content: string,
  actor: { name: string; kind: "human" | "ai" },
  reason: RevisionEvent["reason"] = "edit",
): DocumentState {
  const section = sectionById(state, sectionId)
  const base = latestCanonical(section)
  const revision: RevisionEvent = {
    id: `rev-${sectionId}-${section.revisions.length + 1}`,
    sectionId,
    sequence: section.revisions.length + 1,
    actor: actor.kind,
    actorName: actor.name,
    reason,
    contentHash: contentHash(content),
    provenance: tallyProvenance(content),
  }
  return replaceSection(state, {
    ...section,
    working: { baseVersion: base.version, content },
    revisions: [...section.revisions, revision],
  })
}

function changeSetSection(state: DocumentState, changeSetId: string): { section: SectionRecord; changeSet: ChangeSetRecord } {
  const section = state.sections.find((item) => item.changeSets.some((changeSet) => changeSet.id === changeSetId))
  if (!section) throw new DocumentStateError(`Unknown change set ${changeSetId}`)
  const changeSet = section.changeSets.find((item) => item.id === changeSetId)
  if (!changeSet) throw new DocumentStateError(`Unknown change set ${changeSetId}`)
  return { section, changeSet }
}

/** Attaches a deterministic diff and a prepared LLM explanation. The model is not called. */
export function analyzeChangeSet(state: DocumentState, changeSetId: string, llm: LlmBody): DocumentState {
  const { section, changeSet } = changeSetSection(state, changeSetId)
  const base = section.canonical.find((item) => item.version === changeSet.baseVersion)
  if (!base) throw new DocumentStateError(`${changeSetId} is based on a missing canonical version`)
  const diff = describeTextChange(base.content, changeSet.candidateContent)
  const chat = planUnavailableChat(llm, [
    {
      role: "system",
      content: "Explain the change set. Base the explanation on the canonical text and the candidate snapshot. Leave the factual diff unchanged.",
    },
    {
      role: "user",
      content: [`Section: ${section.title}`, `Base v.${base.version}: ${base.content}`, `Candidate: ${changeSet.candidateContent}`, `Deterministic diff: ${diff.summary}`].join("\n"),
    },
  ])
  const analysis: ChangeSetAnalysis = { summary: diff.summary, changed: diff.changed, chat }
  return replaceSection(state, {
    ...section,
    changeSets: section.changeSets.map((item) => (item.id === changeSetId ? { ...item, analysis } : item)),
  })
}

export function regenerationCase(
  section: SectionRecord,
  upstream: { sectionId: string; canonicalVersion: number }[],
  userInstruction?: string,
): RegenerationCase {
  if (dependencyHealth(section, upstream) === "potentially_stale") return "dependency_changed"
  if (userInstruction?.trim()) return "user_context"
  return "unchanged"
}

function revisionInstruction(regenCase: RegenerationCase): string {
  if (regenCase === "dependency_changed") {
    return "A dependency canonical version changed. Revise the existing section only where the new canonical information requires it. Preserve unaffected language, organization, conclusions, and facts."
  }
  if (regenCase === "user_context") {
    return "Dependencies are unchanged. Revise the existing section to account for the new user instruction. Preserve facts that the instruction does not address."
  }
  return "The dependency fingerprint is unchanged and there is no new instruction. Use the existing output as the baseline. Preserve facts, organization, and terminology."
}

/**
 * Prepares a regeneration as a proposal. The working draft and the canonical version stay unchanged.
 * The LLM request is recorded and not sent.
 */
export function proposeRegeneration(
  state: DocumentState,
  input: {
    sectionId: string
    id: string
    llm: LlmBody
    upstream: { sectionId: string; canonicalVersion: number; content: string }[]
    userInstruction?: string
  },
): DocumentState {
  const section = sectionById(state, input.sectionId)
  const generation = section.generations[section.generations.length - 1]
  if (!generation) throw new DocumentStateError(`${input.sectionId} has no generation to revise`)
  const canonical = latestCanonical(section)
  const regenCase = regenerationCase(section, input.upstream, input.userInstruction)
  const workingDiverged = section.working !== null && section.working.content !== canonical.content
  const dependencyLines = generation.dependencies.map((dependency) => {
    const live = input.upstream.find((item) => item.sectionId === dependency.sectionId)
    const current = live ? `v.${live.canonicalVersion}: ${live.content}` : "unchanged"
    return `${dependency.sectionId} consumed v.${dependency.canonicalVersion}; current ${current}`
  })
  const prompt = generation.manifest.promptBody
  const chat = planUnavailableChat(input.llm, [
    {
      role: "system",
      content: [prompt.role, prompt.objective, prompt.instructions, prompt.constraints, prompt.output, revisionInstruction(regenCase)].join("\n"),
    },
    {
      role: "user",
      content: [
        `Existing output: ${canonical.content}`,
        workingDiverged ? `Human draft, which must be preserved where it does not overlap the revision: ${section.working?.content}` : "The working draft matches the canonical baseline.",
        input.userInstruction?.trim() ? `User instruction: ${input.userInstruction.trim()}` : "User instruction: none",
        ...dependencyLines,
      ].join("\n"),
    },
  ])
  const proposal: RegenerationProposal = {
    id: input.id,
    case: regenCase,
    baselineHash: canonical.contentHash,
    workingDiverged,
    chat,
  }
  return replaceSection(state, { ...section, proposal })
}

/** Applies a completed model result to the working draft and records a generation. Canonical content stays unchanged. */
export function acceptProposal(state: DocumentState, sectionId: string, completedContent: string, actorName: string): DocumentState {
  const section = sectionById(state, sectionId)
  const proposal = section.proposal
  if (!proposal) throw new DocumentStateError(`${sectionId} has no regeneration proposal`)
  const previous = section.generations[section.generations.length - 1]
  if (!previous) throw new DocumentStateError(`${sectionId} has no generation to revise`)
  const edited = editWorking(state, sectionId, completedContent, { name: actorName, kind: "ai" }, "proposal_accepted")
  const withGeneration = createGeneration(edited, {
    id: proposal.id,
    sectionId,
    manifest: previous.manifest,
    dependencies: previous.dependencies,
    content: completedContent,
    previousGenerationId: previous.id,
    userContextHash: contentHash(proposal.chat.prepared.body.messages.map((message) => message.content).join("\n")),
    createdBy: actorName,
  })
  const next = sectionById(withGeneration, sectionId)
  const revisions = next.revisions.map((revision, index) => (index === next.revisions.length - 1 ? { ...revision, generationId: proposal.id } : revision))
  return replaceSection(withGeneration, { ...next, revisions, proposal: undefined })
}

export function pinnedManifest(state: DocumentState, sectionId: string): RuntimeManifest {
  const section = sectionById(state, sectionId)
  const generation = section.generations[section.generations.length - 1]
  if (!generation) throw new DocumentStateError(`${sectionId} has no generation`)
  return generation.manifest
}

export type { VersionRef }
