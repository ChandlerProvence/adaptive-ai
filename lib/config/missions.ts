import type { AreaGeometry, Catalog, CatalogRecord, ContextBody, VersionRef } from "./types.ts"
import { getRecord, materialize, publishVersion, recordDelta, saveCatalogEdit, VersioningError } from "./versioning.ts"

export interface ContextInput {
  name: string
  statement: string
  organization: string
  standingGuidance?: string
  evidenceStandard?: string
  /** One constraint per line. */
  knownConstraints?: string
  contextType?: ContextBody["contextType"]
}

export const CONTEXT_TYPES = ["mission", "customer", "project", "system", "incident", "research", "opportunity"] as const

export interface MissionInput {
  name: string
  areaOfInterest?: string
  areaOfResponsibility?: string
  areaOfInterestGeometry?: AreaGeometry
  areaOfResponsibilityGeometry?: AreaGeometry
  timeWindow?: string
  statement?: string
}

/** A mission is a context whose parent is a different context id. A later version of the same id is still that record. */
export function isMissionContext(record: CatalogRecord): boolean {
  return record.kind === "context" && !!record.forkedFrom && record.forkedFrom.id !== record.id
}

function latest(records: CatalogRecord[]): CatalogRecord | undefined {
  return records.reduce<CatalogRecord | undefined>((chosen, record) => {
    if (!chosen || record.version > chosen.version) return record
    return chosen
  }, undefined)
}

/** One row per situation family: the latest published root, or the latest draft when nothing is published. */
export function familyContexts(records: CatalogRecord[]): CatalogRecord[] {
  const ids = [...new Set(records.filter((record) => record.kind === "context" && !isMissionContext(record)).map((record) => record.id))]
  return ids
    .map((id) => {
      const versions = records.filter((record) => record.id === id && record.kind === "context" && !isMissionContext(record))
      const published = versions.filter((record) => record.status === "published")
      return latest(published.length ? published : versions)
    })
    .filter((record): record is CatalogRecord => !!record)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Latest version of each mission forked from this family id. */
export function missionsForFamily(records: CatalogRecord[], familyId: string): CatalogRecord[] {
  const ids = [...new Set(records.filter((record) => record.kind === "context" && record.forkedFrom?.id === familyId).map((record) => record.id))]
  return ids
    .map((id) => latest(records.filter((record) => record.id === id)))
    .filter((record): record is CatalogRecord => !!record)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function contextId(catalog: Catalog, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "context"
  let id = `context.${slug}`
  let suffix = 2
  while (catalog.records.some((record) => record.id === id)) {
    id = `context.${slug}_${suffix}`
    suffix += 1
  }
  return id
}

/** A published root context. Efforts fork it and store only their own facts. */
export function createContextProfile(catalog: Catalog, input: ContextInput): { catalog: Catalog; ref: VersionRef } {
  const name = input.name.trim()
  if (!name) throw new VersioningError("A context needs a name.")
  const statement = input.statement.trim()
  if (!statement) throw new VersioningError("A context needs a statement.")
  const organization = input.organization.trim()
  if (!organization) throw new VersioningError("A context needs organization information.")
  const knownConstraints = constraintLines(input.knownConstraints)
  const body: ContextBody = {
    contextType: input.contextType ?? "system",
    statement,
    organization,
    timeWindow: "",
    knownConstraints,
  }
  const standingGuidance = input.standingGuidance?.trim()
  const evidenceStandard = input.evidenceStandard?.trim()
  if (standingGuidance) body.standingGuidance = standingGuidance
  if (evidenceStandard) body.evidenceStandard = evidenceStandard
  const id = contextId(catalog, name)
  const record = {
    kind: "context" as const,
    id,
    version: 0,
    name,
    status: "published" as const,
    body,
  }
  return { catalog: { records: [...catalog.records, record] }, ref: { id, version: 0 } }
}

function constraintLines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * A save of a published context creates and publishes the next version.
 * The version being edited stays unchanged. The new version stores only the delta.
 */
export function saveContextVersion(catalog: Catalog, ref: VersionRef, input: ContextInput): { catalog: Catalog; ref: VersionRef } {
  const record = getRecord(catalog, ref)
  if (record.kind !== "context" || isMissionContext(record)) {
    throw new VersioningError("Save a context from its context profile.")
  }
  const name = input.name.trim()
  if (!name) throw new VersioningError("A context needs a name.")
  const statement = input.statement.trim()
  if (!statement) throw new VersioningError("A context needs a statement.")
  const organization = input.organization.trim()
  if (!organization) throw new VersioningError("A context needs organization information.")
  const current = materialize<ContextBody>(catalog, ref)
  const next: ContextBody = {
    ...current,
    contextType: input.contextType ?? current.contextType,
    statement,
    organization,
    knownConstraints: constraintLines(input.knownConstraints),
  }
  const standingGuidance = input.standingGuidance?.trim() ?? ""
  const evidenceStandard = input.evidenceStandard?.trim() ?? ""
  if (standingGuidance || current.standingGuidance) next.standingGuidance = standingGuidance
  if (evidenceStandard || current.evidenceStandard) next.evidenceStandard = evidenceStandard
  const saved = saveCatalogEdit(catalog, ref, { name, body: next as unknown as Record<string, unknown> })
  return { catalog: publishVersion(saved.catalog, saved.ref), ref: saved.ref }
}

/**
 * An effort is a new context id. It points at the published context and stores only the facts that differ.
 * The context record stays unchanged. Execution materializes both into one situation.
 */
export function createMissionContext(catalog: Catalog, parentRef: VersionRef, input: MissionInput): { catalog: Catalog; ref: VersionRef } {
  const parent = getRecord(catalog, parentRef)
  if (parent.kind !== "context") throw new VersioningError(`${parentRef.id} is not a context profile`)
  if (parent.status !== "published") {
    throw new VersioningError(`Create an effort from a published context. ${parent.name} is ${parent.status}.`)
  }
  const name = input.name.trim()
  if (!name) throw new VersioningError("An effort needs a name.")
  const parentBody = materialize<ContextBody>(catalog, parentRef)
  const next: ContextBody = { ...parentBody }
  const areaOfInterest = input.areaOfInterest?.trim()
  const areaOfResponsibility = input.areaOfResponsibility?.trim()
  const timeWindow = input.timeWindow?.trim()
  const statement = input.statement?.trim()
  if (areaOfInterest) {
    next.areaOfInterest = areaOfInterest
    if (input.areaOfInterestGeometry) next.areaOfInterestGeometry = input.areaOfInterestGeometry
  }
  if (areaOfResponsibility) {
    next.areaOfResponsibility = areaOfResponsibility
    if (input.areaOfResponsibilityGeometry) next.areaOfResponsibilityGeometry = input.areaOfResponsibilityGeometry
  }
  if (timeWindow) next.timeWindow = timeWindow
  if (statement) next.statement = statement
  const id = contextId(catalog, name)
  const record = {
    kind: "context" as const,
    id,
    version: 0,
    name,
    status: "published" as const,
    forkedFrom: { id: parent.id, version: parent.version },
    overrides: recordDelta(parentBody as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>) as Partial<ContextBody>,
  }
  return { catalog: { records: [...catalog.records, record] }, ref: { id, version: 0 } }
}
