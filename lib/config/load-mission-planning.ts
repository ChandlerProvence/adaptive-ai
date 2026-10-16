import fs from "node:fs"
import path from "node:path"
import type { CatalogRecord } from "./types.ts"

const ROOT = path.join(process.cwd(), "data", "mission-planning")

/** Published catalog records imported from data/mission-planning. Schema documents in schemas/ stay on disk. */
export function loadMissionPlanningRecords(): CatalogRecord[] {
  if (!fs.existsSync(ROOT)) return []
  const records: CatalogRecord[] = []
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "schemas") continue
        walk(full)
        continue
      }
      if (!entry.name.endsWith(".json") || entry.name.endsWith(".schema.json")) continue
      records.push(withSchemaDocument(JSON.parse(fs.readFileSync(full, "utf8")) as CatalogRecord))
    }
  }
  walk(ROOT)
  return records
}

function withSchemaDocument(record: CatalogRecord): CatalogRecord {
  if (record.kind !== "artifact_schema" || !record.body?.sourceFile || record.body.document) return record
  const full = path.join(process.cwd(), record.body.sourceFile)
  if (!fs.existsSync(full)) return record
  return { ...record, body: { ...record.body, document: JSON.parse(fs.readFileSync(full, "utf8")) as Record<string, unknown> } }
}
