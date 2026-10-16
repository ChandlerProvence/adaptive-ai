"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  STRATEGIC_SECTIONS,
  type WorkflowNodeConfig,
  type DocSection,
  type ChangeSet,
  type CanonicalVersion,
  type Role,
  type AuditEntry,
} from "./mock-data"
import { seedDocSections } from "./doc-seed"
import { shortHash } from "./section-state"
import {
  coaCatalog,
  createContextProfile,
  createMissionContext,
  createCatalogDraft,
  createInsertDraft,
  createWorkflowDraft,
  saveContextVersion,
  documentKind,
  editDraft,
  forkVersion,
  getRecord,
  materialize,
  preparePhaseRun,
  publishVersion,
  resolveNode,
  RUNS,
  saveCatalogEdit,
  saveRootWorkflowDraft,
  validateArtifactText,
  versionLabel,
  type ArtifactSchemaBody,
  type Catalog,
  type CatalogRecord,
  type CatalogDraftKind,
  type ContextInput,
  type InsertDraftInput,
  type MissionInput,
  type Run,
  type StepRunResult,
  type VersionRef,
  type WorkflowOverrides,
} from "./config"

export interface StepExecution extends StepRunResult {
  id: string
  runId: string
  artifact?: string
  validation?: { valid: boolean; errors: { path: string; message: string }[] }
}

export type ScreenName =
  | "documents"
  | "workflows"
  | "workflow-editor"
  | "catalog"
  | "inserts"
  | "contexts"
  | "changesets"
  | "changeset-review"
  | "version-history"
  | "graph"
  | "audit"

export type SchemaLifecycle = "Draft" | "Validated" | "Published" | "Deprecated"

interface View {
  name: ScreenName
  params?: Record<string, string>
}

export const CURRENT_USER = "User"

// Canonical content where the working draft has already diverged at load time.
const CANONICAL_AT_LOAD: Record<string, string> = {
  "sec-narrative":
    "<h2>Narrative Assessment</h2><p>Two dominant narratives shape the market-entry opportunity. The first frames expansion as a defensive necessity driven by margin compression in the core market. The second frames it as an offensive growth play enabled by an emerging demand pocket in the secondary region.</p><p>Sources materially disagree on the durability of the secondary-region demand signal. Field reporting treats it as structural; competitor filings treat it as promotional and temporary.</p>",
}

function makeDocSections(): DocSection[] {
  return seedDocSections().map((s) => ({ ...s, canonicalHtml: CANONICAL_AT_LOAD[s.id] ?? s.bodyHtml }))
}

const INITIAL_CHANGE_SETS: ChangeSet[] = []

let auditSeq = 100
let corrSeq = 0x8a00

function now() {
  return "2026-09-28 " + new Date().toTimeString().slice(0, 5)
}

interface StoreValue {
  view: View
  navigate: (name: ScreenName, params?: Record<string, string>) => void
  instanceId: string | null
  runs: Run[]
  openRun: (id: string) => void
  createContext: (input: ContextInput) => VersionRef
  saveContext: (ref: VersionRef, input: ContextInput) => VersionRef
  createMission: (familyId: string, input: MissionInput) => void
  startRun: (context: VersionRef, workflow: VersionRef) => string
  pinWorkflow: (runId: string, workflow: VersionRef) => void
  stepRuns: StepExecution[]
  runSteps: (runId: string, workflow: VersionRef, nodeIds: string[]) => void
  checkArtifact: (runId: string, workflow: VersionRef, nodeId: string, artifact: string) => void
  catalog: Catalog
  saveWorkflow: (ref: VersionRef, overrides: WorkflowOverrides, name?: string) => VersionRef
  createWorkflow: (name: string) => VersionRef
  createInsert: (input: InsertDraftInput) => VersionRef
  createCatalogRecord: (kind: CatalogDraftKind, input: { name: string; body: Record<string, unknown> }) => VersionRef
  publishWorkflow: (ref: VersionRef) => void
  saveCatalogRecord: (ref: VersionRef, next: { name: string; body: Record<string, unknown> }) => VersionRef

  // Identity & policy
  role: Role
  setRole: (r: Role) => void
  allowSelfApproval: boolean
  setAllowSelfApproval: (v: boolean) => void
  can: (action: "edit" | "submit" | "approve" | "merge" | "reset" | "regenerate") => boolean

  // Workflow editor
  sections: WorkflowNodeConfig[]
  selectedSectionId: string
  selectSection: (id: string) => void
  updateSection: (id: string, patch: Partial<WorkflowNodeConfig>) => void
  savePromptComponents: (id: string, components: WorkflowNodeConfig["promptComponents"]) => void
  schemaVersion: number
  schemaLifecycle: SchemaLifecycle
  markValidated: () => void
  publishSchema: () => void
  createNextDraft: () => void

  // Document workspace
  docSections: DocSection[]
  selectedDocId: string
  selectDoc: (id: string) => void
  setDocBody: (id: string, html: string) => void
  submitChangeSet: (id: string) => void
  approveMerge: (changeSetId: string) => void
  rejectChangeSet: (changeSetId: string, comment: string) => void
  withdrawChangeSet: (changeSetId: string) => void
  resetWorkingDraft: (id: string) => void
  acknowledgeStale: (id: string) => void
  applyRegeneration: (id: string, newBody: string, meta: { mode: string; accepted: number; total: number }) => void
  simulateConcurrentMerge: (changeSetId: string) => void

  changeSets: ChangeSet[]
  audit: AuditEntry[]
}

const StoreContext = React.createContext<StoreValue | null>(null)

const ROLE_RIGHTS: Record<Role, Set<string>> = {
  Viewer: new Set(),
  Editor: new Set(["edit", "submit", "regenerate"]),
  Reviewer: new Set(["edit", "submit", "regenerate", "approve", "merge", "reset"]),
  Admin: new Set(["edit", "submit", "regenerate", "approve", "merge", "reset"]),
}

export function StoreProvider({ children, missionRecords = [] }: { children: React.ReactNode; missionRecords?: CatalogRecord[] }) {
  const [view, setView] = React.useState<View>({ name: "contexts" })
  const [instanceId, setInstanceId] = React.useState<string | null>(null)
  const [runs, setRuns] = React.useState<Run[]>(() => structuredClone(RUNS))
  const [catalog, setCatalog] = React.useState<Catalog>(() => ({
    records: [...structuredClone(coaCatalog).records, ...structuredClone(missionRecords)],
  }))
  const [role, setRoleState] = React.useState<Role>("Admin")
  const [allowSelfApproval, setAllowSelfApproval] = React.useState(true)
  const [sections, setSections] = React.useState<WorkflowNodeConfig[]>(() => STRATEGIC_SECTIONS.map((s) => ({ ...s })))
  const [selectedSectionId, setSelectedSectionId] = React.useState("sec-narrative")
  const [schemaVersion, setSchemaVersion] = React.useState(3)
  const [schemaLifecycle, setSchemaLifecycle] = React.useState<SchemaLifecycle>("Draft")
  const [docSections, setDocSections] = React.useState<DocSection[]>(makeDocSections)
  const [selectedDocId, setSelectedDocId] = React.useState("sec-narrative")
  const [changeSets, setChangeSets] = React.useState<ChangeSet[]>(INITIAL_CHANGE_SETS)
  const [audit, setAudit] = React.useState<AuditEntry[]>([])

  // Every mutation writes one or more audit records sharing a correlation id.
  const log = React.useCallback(
    (entries: Omit<AuditEntry, "id" | "at" | "correlationId">[]) => {
      const correlationId = `req-${(corrSeq++).toString(16)}`
      const at = now()
      setAudit((prev) => [
        ...entries.map((e) => ({ ...e, id: `a-${auditSeq++}`, at, correlationId })),
        ...prev,
      ])
    },
    [],
  )

  const navigate = React.useCallback((name: ScreenName, params?: Record<string, string>) => {
    setView({ name, params })
  }, [])

  const openRun = React.useCallback((id: string) => {
    setInstanceId(id)
    setView({ name: "documents" })
  }, [])

  const createContext = React.useCallback((input: ContextInput) => {
    const created = createContextProfile(catalog, input)
    setCatalog(created.catalog)
    toast.success(`${input.name.trim()} is ready for efforts`, {
      description: "Add an effort when this situation has a time and place.",
    })
    return created.ref
  }, [catalog])

  const saveContext = React.useCallback((ref: VersionRef, input: ContextInput) => {
    const saved = saveContextVersion(catalog, ref, input)
    setCatalog(saved.catalog)
    toast.success(`Saved ${input.name.trim()} ${versionLabel(saved.ref.version)}`, {
      description: `${versionLabel(ref.version)} stays unchanged. Efforts already created stay on the version they inherited.`,
    })
    return saved.ref
  }, [catalog])

  const createMission = React.useCallback((familyId: string, input: MissionInput) => {
    const family = catalog.records
      .filter((record) => record.kind === "context" && record.id === familyId && record.status === "published")
      .reduce<CatalogRecord | undefined>((chosen, record) => (!chosen || record.version > chosen.version ? record : chosen), undefined)
    if (!family) throw new Error("Create an effort from a published context.")
    const created = createMissionContext(catalog, { id: family.id, version: family.version }, input)
    setCatalog(created.catalog)
    toast.success(`${input.name.trim()} inherits ${family.name}`, {
      description: "No workflow is attached. Add one from the effort when you are ready.",
    })
  }, [catalog])

  const startRun = React.useCallback((context: VersionRef, workflow: VersionRef) => {
    const mission = getRecord(catalog, context)
    const workflowRecord = getRecord(catalog, workflow)
    if (mission.kind !== "context") throw new Error("Add a workflow from an effort.")
    if (workflowRecord.kind !== "workflow" || workflowRecord.status !== "published") {
      throw new Error("Pin a published workflow schema.")
    }
    if (runs.some((run) => run.context.id === context.id && run.context.version === context.version && run.workflow.id === workflow.id && run.workflow.version === workflow.version)) {
      throw new Error(`${workflowRecord.name} ${versionLabel(workflow.version)} is already on this effort.`)
    }
    const run: Run = {
      id: `run-${context.id}-${workflow.id}-${Date.now().toString(36)}`,
      name: mission.name,
      summary: workflowRecord.name,
      context,
      workflow,
      document: documentKind(workflow.id),
    }
    setRuns((current) => [...current, run])
    toast.success(`${workflowRecord.name} ${versionLabel(workflow.version)} added`, {
      description: `${mission.name} pins this schema version. Open it when you want to run it.`,
    })
    return run.id
  }, [catalog, runs])

  const [stepRuns, setStepRuns] = React.useState<StepExecution[]>([])

  const runSteps = React.useCallback((runId: string, workflow: VersionRef, nodeIds: string[]) => {
    const run = runs.find((item) => item.id === runId)
    if (!run) throw new Error("Open a mission before running a step.")
    const completed = stepRuns
      .filter((item) => item.runId === runId && item.status === "prepared")
      .map((item) => ({ workflowId: item.workflow.id, nodeId: item.nodeId, title: item.title, output: item.output }))
    const produced = preparePhaseRun({ catalog, workflow, context: run.context, nodeIds, completed })
    const ready = produced.filter((item) => item.status === "prepared")
    if (!ready.length) {
      toast.error(produced[0]?.output ?? "Those steps have already been run.")
      return
    }
    setStepRuns((current) => [
      ...current.filter((item) => !(item.runId === runId && ready.some((step) => step.workflow.id === item.workflow.id && step.nodeId === item.nodeId))),
      ...ready.map((step) => ({ ...step, runId, id: `exec-${runId}-${step.workflow.id}-${step.nodeId}` })),
    ])
    const blocked = produced.find((item) => item.status === "blocked")
    toast.success(ready.length === 1 ? `Triggered ${ready[0].title}` : `Triggered ${ready.length} steps`, {
      description: blocked?.output ?? "The request was prepared. This system has no connection to the model, so it was not sent.",
    })
  }, [catalog, runs, stepRuns])

  const checkArtifact = React.useCallback((runId: string, workflow: VersionRef, nodeId: string, artifact: string) => {
    const run = runs.find((item) => item.id === runId)
    if (!run) throw new Error("Open a mission before checking an artifact.")
    const resolved = resolveNode({ catalog, workflow, nodeId, context: run.context })
    const schema = materialize<ArtifactSchemaBody>(catalog, resolved.artifactSchema)
    const validation = validateArtifactText(schema, artifact)
    setStepRuns((current) => current.map((item) => (item.runId === runId && item.workflow.id === workflow.id && item.nodeId === nodeId ? { ...item, artifact, validation } : item)))
    if (validation.valid) toast.success(`${resolved.nodeTitle} matches its schema`)
    else toast.error(`${resolved.nodeTitle} does not match its schema`, { description: validation.errors[0] ? `${validation.errors[0].path} ${validation.errors[0].message}` : undefined })
  }, [catalog, runs])

  const pinWorkflow = React.useCallback((runId: string, workflow: VersionRef) => {
    const workflowRecord = getRecord(catalog, workflow)
    if (workflowRecord.kind !== "workflow" || workflowRecord.status !== "published") {
      throw new Error("Pin a published workflow schema.")
    }
    setRuns((current) => current.map((run) => (run.id === runId ? { ...run, workflow, document: documentKind(workflow.id) } : run)))
  }, [catalog])

  const saveWorkflow = React.useCallback((ref: VersionRef, overrides: WorkflowOverrides, name?: string): VersionRef => {
    const record = getRecord(catalog, ref)
    if (record.kind === "workflow" && !record.forkedFrom && record.status !== "published" && record.status !== "deprecated") {
      setCatalog(saveRootWorkflowDraft(catalog, ref, overrides))
      return ref
    }
    if (record.status === "published" || record.status === "deprecated") {
      const drafted = forkVersion(catalog, ref, overrides)
      const created = drafted.records
        .filter((item) => item.id === ref.id)
        .reduce((latest, item) => (item.version > latest.version ? item : latest))
      const named = name?.trim()
        ? {
            records: drafted.records.map((item) => (item.id === created.id && item.version === created.version ? { ...item, name: name.trim() } : item)),
          }
        : drafted
      setCatalog(named)
      return { id: created.id, version: created.version }
    }
    setCatalog(editDraft(catalog, ref, overrides))
    return ref
  }, [catalog])

  const createWorkflow = React.useCallback((name: string) => {
    const created = createWorkflowDraft(catalog, name)
    setCatalog(created.catalog)
    return created.ref
  }, [catalog])

  const createInsert = React.useCallback((input: InsertDraftInput) => {
    const created = createInsertDraft(catalog, input)
    setCatalog(created.catalog)
    return created.ref
  }, [catalog])

  const createCatalogRecord = React.useCallback((kind: CatalogDraftKind, input: { name: string; body: Record<string, unknown> }) => {
    const created = createCatalogDraft(catalog, kind, input)
    setCatalog(created.catalog)
    return created.ref
  }, [catalog])

  const publishWorkflow = React.useCallback((ref: VersionRef) => {
    setCatalog((current) => publishVersion(current, ref))
  }, [])

  const saveCatalogRecord = React.useCallback((ref: VersionRef, next: { name: string; body: Record<string, unknown> }): VersionRef => {
    const saved = saveCatalogEdit(catalog, ref, next)
    setCatalog(saved.catalog)
    const record = getRecord(catalog, ref)
    if (record.status === "published") {
      toast.success(`Saved ${next.name.trim()} ${versionLabel(saved.ref.version)}`, {
        description: `${versionLabel(ref.version)} remains published and unchanged. This draft stores only the delta.`,
      })
    } else {
      toast.success(`Updated ${next.name.trim()} ${versionLabel(saved.ref.version)}`, {
        description: "This draft stores only its delta from the parent version.",
      })
    }
    return saved.ref
  }, [catalog])

  const can = React.useCallback<StoreValue["can"]>((action) => ROLE_RIGHTS[role].has(action), [role])

  const setRole = React.useCallback(
    (r: Role) => {
      setRoleState(r)
      log([{ actor: CURRENT_USER, action: "role switched (prototype)", entity: "Session", previous: role, next: r }])
    },
    [log, role],
  )

  const selectSection = React.useCallback((id: string) => setSelectedSectionId(id), [])

  const updateSection = React.useCallback(
    (id: string, patch: Partial<WorkflowNodeConfig>) => {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      // Editing a validated schema returns it to Draft: published versions are immutable.
      setSchemaLifecycle((l) => (l === "Validated" ? "Draft" : l))
    },
    [],
  )

  const savePromptComponents = React.useCallback(
    (id: string, components: WorkflowNodeConfig["promptComponents"]) => {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, promptComponents: components } : s)))
      setSchemaLifecycle((l) => (l === "Validated" ? "Draft" : l))
    },
    [],
  )

  const markValidated = React.useCallback(() => {
    setSchemaLifecycle("Validated")
    log([{ actor: CURRENT_USER, action: "schema validated", entity: `Narrative Focus V${schemaVersion}`, previous: "DRAFT", next: "VALIDATED" }])
    toast.success("Schema validated", { description: "All deterministic checks passed. The schema can now be published." })
  }, [log, schemaVersion])

  const publishSchema = React.useCallback(() => {
    setSchemaLifecycle("Published")
    log([{ actor: CURRENT_USER, action: "workflow schema published", entity: `Narrative Focus V${schemaVersion}`, previous: "VALIDATED", next: "PUBLISHED" }])
    toast.success(`Narrative Focus V${schemaVersion} published`, {
      description: "This version is now immutable. Existing documents stay pinned to the version they were created with.",
    })
  }, [log, schemaVersion])

  const createNextDraft = React.useCallback(() => {
    const next = schemaVersion + 1
    setSchemaVersion(next)
    setSchemaLifecycle("Draft")
    log([{ actor: CURRENT_USER, action: "schema draft created", entity: `Narrative Focus V${next}`, previous: `V${schemaVersion}`, next: "DRAFT" }])
    toast(`Draft V${next} created from V${schemaVersion}`, { description: `V${schemaVersion} remains published and unchanged.` })
  }, [log, schemaVersion])

  const selectDoc = React.useCallback((id: string) => setSelectedDocId(id), [])

  const setDocBody = React.useCallback((id: string, html: string) => {
    setDocSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, bodyHtml: html, workingState: html === s.canonicalHtml ? "Current" : "Modified" } : s,
      ),
    )
  }, [])

  const submitChangeSet = React.useCallback(
    (id: string) => {
      const sec = docSections.find((s) => s.id === id)
      if (!sec) return
      // One active Change Set per section.
      if (changeSets.some((c) => c.sectionId === id && (c.status === "Submitted" || c.status === "Approved"))) {
        toast.error("This section already has an active Change Set", {
          description: "Approve, reject, or withdraw it before submitting another.",
        })
        return
      }
      const nums = changeSets.map((c) => parseInt(c.id.replace("CS-", ""), 10)).filter(Number.isFinite)
      const csId = changeSets.some((c) => c.id === "CS-018") ? `CS-0${Math.max(...nums) + 1}` : "CS-018"
      const hash = `sha256:${shortHash(sec.bodyHtml)}`
      const cs: ChangeSet = {
        id: csId,
        sectionId: id,
        section: sec.title,
        base: sec.canonicalVersion,
        candidate: `Snapshot ${hash.slice(7, 11)}`,
        contributors: [CURRENT_USER],
        revisionEvents: 1,
        status: "Submitted",
        createdBy: CURRENT_USER,
        submittedAt: now(),
        baseHtml: sec.canonicalHtml,
        candidateHtml: sec.bodyHtml,
        candidateHash: hash,
      }
      setChangeSets((prev) => [cs, ...prev])
      setDocSections((prev) => prev.map((s) => (s.id === id ? { ...s, changeSet: csId } : s)))
      log([
        { actor: CURRENT_USER, action: "candidate snapshot created", entity: `${sec.title} · ${csId}`, previous: "—", next: hash },
        { actor: CURRENT_USER, action: "change set submitted", entity: `${csId} · ${sec.title}`, previous: "—", next: "SUBMITTED" },
      ])
      toast.success(`Change Set ${csId} created`, {
        description: `${csId} is an immutable snapshot. Further edits stay in the working draft for the next Change Set.`,
      })
      navigate("changeset-review", { id: csId })
    },
    [changeSets, docSections, log, navigate],
  )

  const approveMerge = React.useCallback(
    (changeSetId: string) => {
      const cs = changeSets.find((c) => c.id === changeSetId)
      const target = cs && docSections.find((s) => s.id === cs.sectionId)
      if (!cs || !target) return

      if (!can("approve")) {
        toast.error(`${role}s cannot approve Change Sets`)
        return
      }
      if (!allowSelfApproval && cs.createdBy === CURRENT_USER) {
        toast.error("Self-approval is disabled by policy", { description: "Another reviewer must approve this Change Set." })
        return
      }
      // Optimistic concurrency: merge only if canonical has not advanced since the snapshot was taken.
      if (target.canonicalVersion !== cs.base) {
        setChangeSets((prev) => prev.map((c) => (c.id === changeSetId ? { ...c, status: "Superseded" } : c)))
        setDocSections((prev) => prev.map((s) => (s.id === target.id ? { ...s, changeSet: null } : s)))
        log([
          { actor: "System", action: "merge rejected: 409 Conflict", entity: `${cs.id} · ${cs.section}`, previous: `expected ${cs.base}`, next: `actual ${target.canonicalVersion}` },
          { actor: "System", action: "change set superseded", entity: cs.id, previous: "SUBMITTED", next: "SUPERSEDED" },
        ])
        toast.error("409 Conflict — canonical version changed", {
          description: `${cs.section} advanced to ${target.canonicalVersion} after ${cs.id} was based on ${cs.base}. Rebase and resubmit.`,
        })
        return
      }

      const current = parseInt(target.canonicalVersion.replace("V", ""), 10)
      const nextVersion = `V${current + 1}`
      const entry: CanonicalVersion = {
        version: nextVersion,
        label: "Change Set",
        changeSet: cs.id,
        approvedBy: CURRENT_USER,
        date: "2026-09-28",
        contentHash: cs.candidateHash.replace("sha256:", ""),
      }
      const downstream = docSections.filter((s) => s.dependencies.some((d) => d.name === cs.section))

      setChangeSets((prev) =>
        prev.map((c) => (c.id === changeSetId ? { ...c, status: "Merged", mergedVersion: nextVersion } : c)),
      )
      setDocSections((prev) =>
        prev.map((s) => {
          if (s.id === target.id) {
            return {
              ...s,
              canonicalVersion: nextVersion,
              canonicalHtml: cs.candidateHtml,
              changeSet: null,
              // Later working edits are preserved and stay on top of the new canonical.
              workingState: s.bodyHtml === cs.candidateHtml ? "Current" : "Modified",
              history: [...s.history, entry],
            }
          }
          if (s.dependencies.some((d) => d.name === cs.section)) {
            return {
              ...s,
              staleImpact: s.staleImpact ?? "Medium",
              staleSummary: s.staleSummary ?? `${cs.section} advanced to ${nextVersion} via ${cs.id}.`,
              dependencies: s.dependencies.map((d) =>
                d.name === cs.section ? { ...d, current: nextVersion, state: "Changed" as const } : d,
              ),
            }
          }
          return s
        }),
      )
      log([
        { actor: CURRENT_USER, action: "change set approved", entity: `${cs.id} · ${cs.section}`, previous: "SUBMITTED", next: "APPROVED" },
        { actor: CURRENT_USER, action: "canonical version created", entity: `${cs.section} ${nextVersion}`, previous: cs.base, next: nextVersion },
        ...downstream.map((d) => ({
          actor: "System",
          action: "dependency state changed",
          entity: d.title,
          previous: "CURRENT",
          next: "POTENTIALLY_STALE",
        })),
      ])
      toast.success(`${cs.section} ${cs.base} + ${cs.id} → ${nextVersion}`, {
        description: downstream.length
          ? `Marked Potentially Stale: ${downstream.map((d) => d.title).join(", ")}.`
          : "New canonical version created.",
      })
      navigate("documents")
    },
    [allowSelfApproval, can, changeSets, docSections, log, navigate, role],
  )

  const closeChangeSet = React.useCallback(
    (changeSetId: string, status: "Rejected" | "Withdrawn", comment?: string) => {
      const cs = changeSets.find((c) => c.id === changeSetId)
      if (!cs) return
      setChangeSets((prev) => prev.map((c) => (c.id === changeSetId ? { ...c, status, reviewComment: comment } : c)))
      // Working draft is preserved; only the review link is cleared.
      setDocSections((prev) => prev.map((s) => (s.id === cs.sectionId ? { ...s, changeSet: null } : s)))
      log([
        {
          actor: CURRENT_USER,
          action: status === "Rejected" ? "change set rejected" : "change set withdrawn",
          entity: `${cs.id} · ${cs.section}`,
          previous: "SUBMITTED",
          next: status.toUpperCase(),
        },
      ])
      toast(`${cs.id} ${status.toLowerCase()}`, {
        description: "Canonical content is unchanged and the working draft was preserved.",
      })
      navigate("changesets")
    },
    [changeSets, log, navigate],
  )

  const rejectChangeSet = React.useCallback(
    (id: string, comment: string) => closeChangeSet(id, "Rejected", comment),
    [closeChangeSet],
  )
  const withdrawChangeSet = React.useCallback((id: string) => closeChangeSet(id, "Withdrawn"), [closeChangeSet])

  const resetWorkingDraft = React.useCallback(
    (id: string) => {
      const sec = docSections.find((s) => s.id === id)
      if (!sec) return
      setDocSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, bodyHtml: s.canonicalHtml, workingState: "Current" } : s)),
      )
      log([{ actor: CURRENT_USER, action: "working draft reset", entity: sec.title, previous: "MODIFIED", next: `CLEAN (${sec.canonicalVersion})` }])
      toast(`Working draft reset to canonical ${sec.canonicalVersion}`)
    },
    [docSections, log],
  )

  const acknowledgeStale = React.useCallback(
    (id: string) => {
      const sec = docSections.find((s) => s.id === id)
      if (!sec) return
      setDocSections((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, dependencies: s.dependencies.map((d) => ({ ...d, generatedWith: d.current, state: "Current" as const })) }
            : s,
        ),
      )
      log([{ actor: CURRENT_USER, action: "staleness reviewed: no change needed", entity: sec.title, previous: "POTENTIALLY_STALE", next: "CURRENT" }])
      toast("Reviewed — kept existing canonical content", {
        description: "Dependency fingerprint updated; the decision is recorded in the audit log.",
      })
    },
    [docSections, log],
  )

  const applyRegeneration = React.useCallback<StoreValue["applyRegeneration"]>(
    (id, newBody, meta) => {
      const sec = docSections.find((s) => s.id === id)
      if (!sec) return
      const num = parseInt(sec.generation.replace("GEN-", ""), 10)
      const nextGen = `GEN-${num + 101}`
      setDocSections((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                bodyHtml: newBody,
                workingState: newBody === s.canonicalHtml ? "Current" : "Modified",
                previousGeneration: s.generation,
                generation: nextGen,
                proposalReady: false,
                dependencies: s.dependencies.map((d) => ({ ...d, generatedWith: d.current, state: "Current" as const })),
              }
            : s,
        ),
      )
      log([
        { actor: `AI · ${nextGen}`, action: `generation created (${meta.mode})`, entity: sec.title, previous: sec.generation, next: nextGen },
        { actor: CURRENT_USER, action: `accepted ${meta.accepted}/${meta.total} proposed changes`, entity: sec.title, previous: "—", next: "WORKING DRAFT" },
      ])
      toast.success("Proposal applied to working draft", {
        description: "No canonical version was created. Submit a Change Set to make it canonical.",
      })
    },
    [docSections, log],
  )

  // Demonstrates optimistic concurrency: another reviewer merges first, advancing canonical.
  const simulateConcurrentMerge = React.useCallback(
    (changeSetId: string) => {
      const cs = changeSets.find((c) => c.id === changeSetId)
      if (!cs) return
      setDocSections((prev) =>
        prev.map((s) => {
          if (s.id !== cs.sectionId) return s
          const n = parseInt(s.canonicalVersion.replace("V", ""), 10) + 1
          return {
            ...s,
            canonicalVersion: `V${n}`,
            history: [
              ...s.history,
              { version: `V${n}`, label: "Change Set", changeSet: "CS-0xx", approvedBy: "Jordan Lee", date: "2026-09-28", contentHash: "e41c…0b9" },
            ],
          }
        }),
      )
      log([{ actor: "Jordan Lee", action: "canonical version created (concurrent)", entity: cs.section, previous: cs.base, next: "advanced" }])
      toast("Jordan Lee merged another Change Set into this section", {
        description: `Canonical is no longer ${cs.base}. Try merging ${cs.id} to see the conflict check.`,
      })
    },
    [changeSets, log],
  )

  const value: StoreValue = {
    view,
    navigate,
    instanceId,
    runs,
    openRun,
    createContext,
    saveContext,
    createMission,
    startRun,
    pinWorkflow,
    stepRuns,
    runSteps,
    checkArtifact,
    catalog,
    saveWorkflow,
    createWorkflow,
    createInsert,
    createCatalogRecord,
    publishWorkflow,
    saveCatalogRecord,
    role,
    setRole,
    allowSelfApproval,
    setAllowSelfApproval,
    can,
    sections,
    selectedSectionId,
    selectSection,
    updateSection,
    savePromptComponents,
    schemaVersion,
    schemaLifecycle,
    markValidated,
    publishSchema,
    createNextDraft,
    docSections,
    selectedDocId,
    selectDoc,
    setDocBody,
    submitChangeSet,
    approveMerge,
    rejectChangeSet,
    withdrawChangeSet,
    resetWorkingDraft,
    acknowledgeStale,
    applyRegeneration,
    simulateConcurrentMerge,
    changeSets,
    audit,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
