/**
 * Replaces placeholder task, prompt, schema, purpose, and insert copy
 * with the standards in historical_reference/update/data.
 * Prompt forks still store only their objective. The shared contract stays on the base.
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = path.resolve(import.meta.dirname, "..")
const catalog = path.join(root, "data", "mission-planning")
const historical = path.join(root, "historical_reference", "update", "data")
const ENVELOPE = new Set(["artifact_type", "schema_version", "context", "citations"])

const SCHEMA_FILE = {
  coa_option: "coa1.schema.json",
  mission_statement_generation: "mission_statement_output.schema.json",
}

const TASK_FILE = {
  coa_option: "coa1.yaml",
}

const PURPOSES = {
  "purpose.mp_planning": "planning.yaml",
  "purpose.mp_decision_support": "decision_support.yaml",
  "purpose.mp_execution_support": "execution_support.yaml",
}

export function enrichMissionPlanning() {
  if (!fs.existsSync(historical)) {
    console.log("historical_reference/update/data is not present. Catalog prompts were left unchanged.")
    return
  }
  let prompts = 0
  let schemas = 0
  let tasks = 0
  for (const file of fs.readdirSync(path.join(catalog, "tasks"))) {
    const record = readJson(path.join(catalog, "tasks", file))
    const key = record.id.replace(/^task\.mp_/, "")
    const description = taskDescription(key)
    if (!description) continue
    record.body.summary = description
    writeJson(path.join(catalog, "tasks", file), record)
    tasks += 1
    const promptPath = promptPathFor(record.body.prompt.id)
    if (promptPath && fs.existsSync(promptPath)) {
      const prompt = readJson(promptPath)
      prompt.overrides = { objective: description }
      writeJson(promptPath, prompt)
      prompts += 1
    }
    const schema = schemaRecord(record.body.artifactSchema.id, key)
    if (schema) schemas += 1
  }

  const assumptions = taskDescription("assumptions")
  const assumptionsPrompt = path.join(catalog, "prompts", "prompt.mp_mdmp_assumptions.json")
  if (assumptions && fs.existsSync(assumptionsPrompt)) {
    const prompt = readJson(assumptionsPrompt)
    prompt.overrides = { objective: assumptions }
    writeJson(assumptionsPrompt, prompt)
    prompts += 1
  }

  for (const file of fs.readdirSync(path.join(catalog, "custom-inserts"))) {
    const record = readJson(path.join(catalog, "custom-inserts", file))
    const key = record.id.replace(/^insert\.mp_/, "")
    const description = taskDescription(key)
    if (description) {
      record.body.summary = description
      writeJson(path.join(catalog, "custom-inserts", file), record)
    }
    if (record.body.artifactSchema) schemaRecord(record.body.artifactSchema.id, key)
  }

  for (const [id, file] of Object.entries(PURPOSES)) {
    const text = fs.readFileSync(path.join(historical, "configs", "purpose_profiles", file), "utf8")
    const recordPath = path.join(catalog, "purposes", `${id}.json`)
    if (!fs.existsSync(recordPath)) continue
    const record = readJson(recordPath)
    const guidance = indentedBlock(text, "commander")
    const description = indentedBlock(text, "description")
    const risk = indentedBlock(text, "moderate")
    record.body.audience = "Commander"
    record.body.summary = [description, guidance].filter(Boolean).join("\n\n")
    if (risk) record.body.riskTolerance = "Moderate"
    record.body.evidenceRequirement = "Cite supplied evidence for every claim. Mark insufficient evidence explicitly. Use citation ids in the form CIT-0001."
    writeJson(recordPath, record)
  }

  console.log(`Enriched ${tasks} tasks, ${prompts} prompts, and ${schemas} artifact schemas.`)
}

function taskDescription(key) {
  const file = TASK_FILE[key] ?? `${key}.yaml`
  const full = path.join(historical, "configs", "task_profiles", file)
  if (!fs.existsSync(full)) return ""
  let description = indentedBlock(fs.readFileSync(full, "utf8"), "description")
  if (key === "coa_option") {
    description = description
      .replaceAll("Course of Action 1", "one course of action")
      .replaceAll("COA 1", "the course of action")
  }
  return description
}

function schemaRecord(id, key) {
  const file = SCHEMA_FILE[key] ?? `${key}.schema.json`
  const full = path.join(historical, "schemas", file)
  const recordPath = path.join(catalog, "artifact-schemas", `${id}.json`)
  if (!fs.existsSync(full) || !fs.existsSync(recordPath)) return false
  const schema = readJson(full)
  const record = readJson(recordPath)
  const required = Array.isArray(schema.required) ? schema.required.filter((item) => !ENVELOPE.has(item)) : record.body.requiredSections
  record.body.summary = typeof schema.description === "string" ? schema.description : record.body.summary
  record.body.requiredSections = required.length ? required : record.body.requiredSections
  record.body.sourceFile = path.relative(root, full)
  writeJson(recordPath, record)
  return true
}

function promptPathFor(id) {
  return path.join(catalog, "prompts", `${id}.json`)
}

function indentedBlock(text, label) {
  const lines = text.replaceAll("\r\n", "\n").split("\n")
  const index = lines.findIndex((line) => line.trim() === `${label}: |`)
  if (index < 0) return ""
  const indent = lines[index].match(/^ */)[0].length
  const body = []
  for (let i = index + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "") {
      body.push("")
      continue
    }
    const pad = lines[i].match(/^ */)[0].length
    if (pad <= indent) break
    body.push(lines[i].slice(indent + 2))
  }
  return body.join("\n").trim()
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n")
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) enrichMissionPlanning()
