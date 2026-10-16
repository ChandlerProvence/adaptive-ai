import Ajv, { type ErrorObject } from "ajv"
import type { ArtifactSchemaBody } from "./types.ts"

export interface SchemaIssue {
  path: string
  message: string
}

export interface ArtifactValidation {
  valid: boolean
  errors: SchemaIssue[]
}

const ajv = new Ajv({ allErrors: true, strict: false })
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
const compiled = new WeakMap<object, ReturnType<typeof ajv.compile>>()

/** Checks an artifact against its JSON Schema, or against the named sections when no document is loaded. */
export function validateArtifact(schema: ArtifactSchemaBody, value: unknown): ArtifactValidation {
  if (schema.document) return validateDocument(schema.document, value)
  if (!isRecord(value)) return { valid: false, errors: [{ path: "/", message: "The artifact must be a JSON object." }] }
  const errors = schema.requiredSections
    .filter((section) => value[section] === undefined || value[section] === "")
    .map((section) => ({ path: `/${section}`, message: "is required" }))
  return { valid: errors.length === 0, errors }
}

/** Parses artifact text and validates it. Invalid JSON is a failed validation, not an exception. */
export function validateArtifactText(schema: ArtifactSchemaBody, text: string): ArtifactValidation {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { valid: false, errors: [{ path: "/", message: "The artifact is not valid JSON." }] }
  }
  return validateArtifact(schema, value)
}

function validateDocument(document: Record<string, unknown>, value: unknown): ArtifactValidation {
  let validate = compiled.get(document)
  if (!validate) {
    validate = ajv.compile(document)
    compiled.set(document, validate)
  }
  if (validate(value)) return { valid: true, errors: [] }
  return { valid: false, errors: (validate.errors ?? []).map(issueFrom) }
}

function issueFrom(error: ErrorObject): SchemaIssue {
  const params = error.params as { missingProperty?: unknown }
  const missing = typeof params.missingProperty === "string" ? `/${params.missingProperty}` : ""
  const path = `${error.instancePath}${missing}` || "/"
  return { path, message: error.message ?? "is invalid" }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
