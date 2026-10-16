# MDMP Task Catalog

MDMP (Military Decision-Making Process) tasks for the planning UI. Each slot maps to `POST /run/?task_id=<slot>&mission_id=...`.

**UI narrative field (all tasks):** `artifact.display_text`

**Regenerate files:** `python3 scripts/generate_mdmp_catalog.py`

**Shared prompt pattern:** `data/configs/prompt_templates/mdmp_base.yaml` (reference) + per-slot `mdmp_<slot>.yaml` (includes `mdmp_step_context` static node).

---

## Mission Receive

| Slot | Task name (DB) | Schema | Structured fields |
|------|----------------|--------|-------------------|
| `currentEnvironment` | MDMP Current Environment | `currentEnvironment.schema.json` | `factors[]`, `citations[]` |

## Mission Analysis

| Slot | Task name (DB) | Schema | Structured fields |
|------|----------------|--------|-------------------|
| `assumptions` | MDMP Assumptions | `assumptions.schema.json` | `items[]`, `citations[]` |
| `higherHqAnalysis` | MDMP Higher HQ Analysis | `higherHqAnalysis.schema.json` | `guidance_items[]`, `citations[]` |
| `intelligencePreparation` | MDMP Intelligence Preparation | `intelligencePreparation.schema.json` | `factors[]`, `citations[]` |
| `correlation` | MDMP Correlation | `correlation.schema.json` | `factors[]`, `citations[]` |
| `identifiedTasks` | MDMP Identified Tasks | `identifiedTasks.schema.json` | `items[]`, `citations[]` |
| `intentAndGuidance` | MDMP Intent and Guidance | `intentAndGuidance.schema.json` | `guidance_items[]`, `citations[]` |
| `priorities` | MDMP Priorities | `priorities.schema.json` | `items[]`, `citations[]` |

## COA Development

| Slot | Task name (DB) | Schema | Structured fields |
|------|----------------|--------|-------------------|
| `cbtPower` | MDMP Combat Power | `cbtPower.schema.json` | `units[]`, `citations[]` |
| `coaOptions` | MDMP COA Options | `coaOptions.schema.json` | `executive_summary.bullets[]`, `courses_of_action[]`, `citations[]` |
| `coa1` | MDMP COA 1 | `coa1.schema.json` | `coa`, `citations[]` |
| `coa2` | MDMP COA 2 | `coa2.schema.json` | `coa`, `citations[]` |
| `coa3` | MDMP COA 3 | `coa3.schema.json` | `coa`, `citations[]` |
| `initialForces` | MDMP Initial Forces | `initialForces.schema.json` | `units[]`, `citations[]` |
| `broadConcept` | MDMP Broad Concept | `broadConcept.schema.json` | `approved_content`, `citations[]` |
| `assignHQs` | MDMP Assign HQs | `assignHQs.schema.json` | `units[]`, `citations[]` |
| `coaStatementAndSketch` | MDMP COA Statement and Sketch | `coaStatementAndSketch.schema.json` | `approved_content`, `citations[]` |

## COA Analysis

| Slot | Task name (DB) | Schema | Structured fields |
|------|----------------|--------|-------------------|
| `friendlyForces` | MDMP Friendly Forces | `friendlyForces.schema.json` | `units[]`, `citations[]` |
| `coaAssumptions` | MDMP COA Assumptions | `coaAssumptions.schema.json` | `assessments[]`, `citations[]` |
| `wargamingMethod` | MDMP Wargaming Method | `wargamingMethod.schema.json` | `assessments[]`, `citations[]` |
| `wargamingAssessment` | MDMP Wargaming Assessment | `wargamingAssessment.schema.json` | `assessments[]`, `citations[]` |

## COA Comparison

| Slot | Task name (DB) | Schema | Structured fields |
|------|----------------|--------|-------------------|
| `evaluationCriteria` | MDMP Evaluation Criteria | `evaluationCriteria.schema.json` | `criteria[]`, `citations[]` |
| `compareCoas` | MDMP Compare COAs | `compareCoas.schema.json` | `criteria[]`, `citations[]` |
| `decisionMatrix` | MDMP Decision Matrix | `decisionMatrix.schema.json` | `matrix`, `citations[]` |
| `selection` | MDMP Selection | `selection.schema.json` | `criteria[]`, `citations[]` |
| `approvedCdrIntent` | MDMP Approved Commander Intent | `approvedCdrIntent.schema.json` | `guidance_items[]`, `citations[]` |
| `approvedMissionStatement` | MDMP Approved Mission Statement | `approvedMissionStatement.schema.json` | `approved_content`, `citations[]` |
| `updatedAssumptions` | MDMP Updated Assumptions | `updatedAssumptions.schema.json` | `items[]`, `citations[]` |
| `runningEstimate` | MDMP Running Estimate | `runningEstimate.schema.json` | `approved_content`, `citations[]` |
| `disagreements` | MDMP Disagreements | `disagreements.schema.json` | `items[]`, `citations[]` |

---

## Schema families

| Family | Schema files | Payload key(s) |
|--------|--------------|----------------|
| narrative_items | assumptions, priorities, identifiedTasks, updatedAssumptions, disagreements | `items[]` |
| environment | currentEnvironment, intelligencePreparation, correlation | `factors[]` |
| hq_guidance | higherHqAnalysis, intentAndGuidance, approvedCdrIntent | `guidance_items[]` |
| forces | cbtPower, initialForces, assignHQs, friendlyForces | `units[]` |
| coa_detail | coa1, coa2, coa3 | `coa` |
| coa_options | coaOptions | `courses_of_action[]`, `executive_summary` |
| wargaming | coaAssumptions, wargamingMethod, wargamingAssessment | `assessments[]` |
| comparison | evaluationCriteria, compareCoas, selection | `criteria[]` |
| comparison (matrix) | decisionMatrix | `matrix` |
| approved | broadConcept, coaStatementAndSketch, approvedMissionStatement, runningEstimate | `approved_content` |

Example fixtures: `data/configs/fixtures/mdmp_<family>_example.json`

---

## Legacy tasks (unchanged)

These IMP tasks remain separate from MDMP slots:

- `assumption_analysis` (not `assumptions`)
- `coa_generation` (not `coaOptions`)
- `commanders_intent_extraction`, `constraints_extraction`, `operational_analysis`, `narrative_analysis`, `mission_statement_generation`, `mission_statement_analysis`

---

## Activation (remote environment)

```bash
uv run python scripts/load_all_data.py --only tasks,catalog
```

Ensure `data/schemas/` and `data/configs/prompt_templates/` are on the image or mount path used by the loader.
