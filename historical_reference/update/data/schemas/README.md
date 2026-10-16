# IMP Schema Guide

This guide covers JSON schemas used for artifact validation, how they're tied to task configurations, and how to create new schemas.

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Schema Structure](#schema-structure)
3. [Linking Schemas to Tasks](#linking-schemas-to-tasks)
4. [Schema-to-Prompt Generation](#schema-to-prompt-generation)
5. [Creating New Schemas](#creating-new-schemas)
6. [Schema Validation](#schema-validation)
7. [Common Patterns](#common-patterns)

---

## Schema Overview

### Purpose

Schemas define the **structure and validation rules** for task outputs (artifacts). They ensure:
- **Consistency**: All artifacts follow the same structure
- **Validation**: Outputs are validated before saving
- **Documentation**: Schemas serve as documentation of expected outputs
- **Prompt Generation**: Schemas are automatically converted to prompt instructions

### Location

All schemas are stored in the `schemas/` directory as JSON Schema Draft 07 files:

```
schemas/
├── coa_package.schema.json
├── constraints_extraction.schema.json
├── operational_analysis.schema.json
├── assumption_analysis.schema.json
├── commanders_intent.schema.json
├── narrative_analysis.schema.json
├── mission_statement_analysis.schema.json
└── mission_statement_output.schema.json
```

### How Schemas Are Used

1. **Task Configuration**: Task profiles reference schemas via `artifact.schema_ref`
2. **Runtime Loading**: `load_schema()` loads schema file during task execution
3. **Prompt Generation**: Schema is converted to prompt instructions automatically
4. **Validation**: Artifact is validated against schema before saving
5. **Error Reporting**: Validation errors are reported if artifact doesn't match

---

## Schema Structure

### Standard Schema Format

All IMP schemas follow this structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ARTIFACT_TYPE",
  "description": "Human-readable description",
  "type": "object",
  "additionalProperties": false,
  "required": ["artifact_type", "schema_version", "context", "...other required fields"],
  "properties": {
    "artifact_type": {
      "type": "string",
      "const": "ARTIFACT_TYPE"
    },
    "schema_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "context": {
      "type": "object",
      "additionalProperties": false,
      "required": ["mission_id", "mission_type", ...],
      "properties": {
        "mission_id": { "type": ["string", "integer"] },
        ...
      }
    },
    "...": { ... }
  },
  "definitions": {
    "citation_id": { ... },
    "citation": { ... }
  }
}
```

### Required Top-Level Fields

Every schema **must** include:

1. **`artifact_type`** (required)
   - Type: `string`
   - Const: Must match schema title (e.g., `"COA_PACKAGE"`)
   - Purpose: Identifies artifact type for routing/validation

2. **`schema_version`** (required)
   - Type: `string`
   - Pattern: `^[0-9]+\.[0-9]+\.[0-9]+$` (semantic versioning)
   - Purpose: Tracks schema version for compatibility

3. **`context`** (required)
   - Type: `object`
   - Purpose: Mission and task context metadata
   - Required fields: `mission_id`, `mission_type`, `organization_id`, `team_id`, `aoi`, `time_window`, `task_id`, `purpose_id`

4. **Task-Specific Fields**
   - Varies by artifact type
   - Examples: `courses_of_action`, `constraints`, `analysis`, etc.

5. **`citations`** (required for most tasks)
   - Type: `array` of citation objects
   - Purpose: Evidence citations supporting artifact claims

### Standard Definitions

Most schemas include these reusable definitions:

#### `citation_id`
```json
"citation_id": {
  "type": "string",
  "pattern": "^CIT-[0-9]{4}$"
}
```
- Format: `CIT-0001`, `CIT-0002`, etc.
- Used in: `evidence_refs` arrays, citation objects

#### `citation`
```json
"citation": {
  "type": "object",
  "required": [
    "citation_id",
    "source_system",
    "document_id",
    "document_version",
    "retrieval_time",
    "range",
    "snippet"
  ],
  "properties": {
    "citation_id": { "$ref": "#/definitions/citation_id" },
    "source_system": { "type": "string" },
    "document_id": { "type": "string" },
    "document_version": { "type": "string" },
    "retrieval_time": { "type": "string", "format": "date-time" },
    "range": {
      "type": "object",
      "required": ["type", "start", "end"],
      "properties": {
        "type": { "enum": ["char", "page_line", "timecode"] },
        "start": { "type": ["integer", "string"] },
        "end": { "type": ["integer", "string"] }
      }
    },
    "snippet": { "type": "string", "minLength": 5, "maxLength": 1200 }
  }
}
```

---

## Linking Schemas to Tasks

### Task Profile Configuration

Schemas are linked to tasks via the `artifact.schema_ref` field in task profiles:

```yaml
# configs/task_profiles/my_task.yaml
artifact:
  artifact_type: MY_ARTIFACT_TYPE
  schema_ref: my_artifact.schema.json  # ← Links to schemas/my_artifact.schema.json
```

### Runtime Resolution

1. **Task Load**: `load_profiles()` loads task profile
2. **Schema Reference**: `schema_ref` extracted from `artifact.schema_ref`
3. **Schema Load**: `load_schema()` resolves `schemas/{schema_ref}`
4. **Validation**: Artifact validated against schema after generation

### Example: Complete Link

**Task Profile:**
```yaml
# configs/task_profiles/constraints_extraction.yaml
artifact:
  artifact_type: CONSTRAINTS_EXTRACTION
  schema_ref: constraints_extraction.schema.json
```

**Schema File:**
```json
// schemas/constraints_extraction.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CONSTRAINTS_EXTRACTION",
  "properties": {
    "artifact_type": {
      "const": "CONSTRAINTS_EXTRACTION"  // ← Must match artifact_type above
    }
  }
}
```

**Runtime:**
```python
# In run.py
schema_name = task_config["artifact"]["schema_ref"]  # "constraints_extraction.schema.json"
schema = load_schema(schema_name)  # Loads schemas/constraints_extraction.schema.json
validate_artifact(artifact, schema)  # Validates artifact matches schema
```

---

## Schema-to-Prompt Generation

### Automatic Instruction Generation

The system automatically converts schemas to prompt instructions using `generate_schema_instructions_generic()`:

1. **Schema Traversal**: Recursively traverses schema structure
2. **Instruction Generation**: Creates human-readable instructions for each field
3. **Prompt Injection**: Instructions added to prompt via `schema_generator` node

### How It Works

**Schema:**
```json
{
  "required": ["artifact_type", "constraints"],
  "properties": {
    "constraints": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "description"],
        "properties": {
          "type": { "enum": ["resource", "time", "legal"] }
        }
      }
    }
  }
}
```

**Generated Instructions:**
```
ARTIFACT JSON SCHEMA REQUIREMENTS:
- artifact_type: Required string
- constraints: Array with at least 1 items
  - constraints[]: Object with required fields: id, type, description
    - constraints[].type: One of: "resource", "time", "legal"
```

### Benefits

- **No Manual Prompt Updates**: Schema changes automatically reflected in prompts
- **Consistency**: Prompt instructions always match schema structure
- **Reduced Errors**: LLM sees exact schema requirements

---

## Creating New Schemas

### Step-by-Step Guide

**Step 1: Design Schema Structure**

Determine required fields based on task output:

```json
{
  "artifact_type": "MY_ARTIFACT",
  "schema_version": "1.0.0",
  "context": { ... },
  "my_data": [ ... ],
  "citations": [ ... ]
}
```

**Step 2: Create Schema File**

```json
// schemas/my_artifact.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MY_ARTIFACT",
  "description": "Description of my artifact",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "artifact_type",
    "schema_version",
    "context",
    "my_data",
    "citations"
  ],
  "properties": {
    "artifact_type": {
      "type": "string",
      "const": "MY_ARTIFACT"
    },
    "schema_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "context": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "mission_id",
        "mission_type",
        "organization_id",
        "team_id",
        "aoi",
        "time_window",
        "task_id",
        "purpose_id"
      ],
      "properties": {
        "mission_id": { "type": ["string", "integer"] },
        "mission_type": { "type": "string" },
        "organization_id": { "type": "string" },
        "team_id": { "type": "string" },
        "aoi": { "type": "string" },
        "aor": { "type": "string" },
        "time_window": { "type": "string" },
        "task_id": { "type": "string" },
        "purpose_id": { "type": "string" },
        "run_id": { "type": "string" }
      }
    },
    "my_data": {
      "type": "array",
      "minItems": 0,
      "items": {
        "type": "object",
        "required": ["id", "description", "evidence_refs"],
        "properties": {
          "id": { "type": "string" },
          "description": { "type": "string", "minLength": 10 },
          "evidence_refs": {
            "type": "array",
            "minItems": 1,
            "items": { "$ref": "#/definitions/citation_id" }
          }
        }
      }
    },
    "citations": {
      "type": "array",
      "minItems": 0,
      "items": { "$ref": "#/definitions/citation" }
    }
  },
  "definitions": {
    "citation_id": {
      "type": "string",
      "pattern": "^CIT-[0-9]{4}$"
    },
    "citation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "citation_id",
        "source_system",
        "document_id",
        "document_version",
        "retrieval_time",
        "range",
        "snippet"
      ],
      "properties": {
        "citation_id": { "$ref": "#/definitions/citation_id" },
        "source_system": { "type": "string" },
        "document_id": { "type": "string" },
        "document_version": { "type": "string" },
        "retrieval_time": { "type": "string", "format": "date-time" },
        "range": {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "start", "end"],
          "properties": {
            "type": { "type": "string", "enum": ["char", "page_line", "timecode"] },
            "start": { "type": ["integer", "string"] },
            "end": { "type": ["integer", "string"] },
            "page": { "type": "integer" },
            "line_start": { "type": "integer" },
            "line_end": { "type": "integer" }
          }
        },
        "snippet": { "type": "string", "minLength": 5, "maxLength": 1200 },
        "canonical_uri": { "type": "string" }
      }
    }
  }
}
```

**Step 3: Link to Task Profile**

```yaml
# configs/task_profiles/my_task.yaml
artifact:
  artifact_type: MY_ARTIFACT
  schema_ref: my_artifact.schema.json
```

**Step 4: Test Schema**

```bash
# Test prompt generation includes schema
python3 prompt_compilation.py examples/input_example.json --graph-info

# Test validation (run actual task)
python3 run.py examples/input_example.json
```

### Schema Template

Use this template for new schemas:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "YOUR_ARTIFACT_TYPE",
  "description": "Description of what this artifact contains",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "artifact_type",
    "schema_version",
    "context",
    "your_main_field",
    "citations"
  ],
  "properties": {
    "artifact_type": {
      "type": "string",
      "const": "YOUR_ARTIFACT_TYPE"
    },
    "schema_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "context": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "mission_id",
        "mission_type",
        "organization_id",
        "team_id",
        "aoi",
        "time_window",
        "task_id",
        "purpose_id"
      ],
      "properties": {
        "mission_id": { "type": ["string", "integer"] },
        "mission_type": { "type": "string" },
        "organization_id": { "type": "string" },
        "team_id": { "type": "string" },
        "aoi": { "type": "string" },
        "aor": { "type": "string" },
        "time_window": { "type": "string" },
        "task_id": { "type": "string" },
        "purpose_id": { "type": "string" },
        "run_id": { "type": "string" }
      }
    },
    "your_main_field": {
      "type": "array",
      "minItems": 0,
      "items": {
        "type": "object",
        "required": ["id", "description", "evidence_refs"],
        "properties": {
          "id": { "type": "string" },
          "description": { "type": "string", "minLength": 10 },
          "evidence_refs": {
            "type": "array",
            "minItems": 1,
            "items": { "$ref": "#/definitions/citation_id" }
          }
        }
      }
    },
    "citations": {
      "type": "array",
      "minItems": 0,
      "items": { "$ref": "#/definitions/citation" }
    }
  },
  "definitions": {
    "citation_id": {
      "type": "string",
      "pattern": "^CIT-[0-9]{4}$"
    },
    "citation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "citation_id",
        "source_system",
        "document_id",
        "document_version",
        "retrieval_time",
        "range",
        "snippet"
      ],
      "properties": {
        "citation_id": { "$ref": "#/definitions/citation_id" },
        "source_system": { "type": "string" },
        "document_id": { "type": "string" },
        "document_version": { "type": "string" },
        "retrieval_time": { "type": "string", "format": "date-time" },
        "range": {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "start", "end"],
          "properties": {
            "type": { "type": "string", "enum": ["char", "page_line", "timecode"] },
            "start": { "type": ["integer", "string"] },
            "end": { "type": ["integer", "string"] },
            "page": { "type": "integer" },
            "line_start": { "type": "integer" },
            "line_end": { "type": "integer" }
          }
        },
        "snippet": { "type": "string", "minLength": 5, "maxLength": 1200 },
        "canonical_uri": { "type": "string" }
      }
    }
  }
}
```

---

## Schema Validation

### Validation Process

1. **Artifact Generation**: LLM generates JSON artifact
2. **JSON Parsing**: Response parsed to extract JSON
3. **Schema Validation**: `validate_artifact()` uses `jsonschema` library
4. **Error Reporting**: Validation errors collected and reported
5. **Partial Save**: If validation fails, partial artifact may be saved (configurable)

### Validation Errors

Common validation errors:

- **Missing required field**: `'artifact_type' is a required property`
- **Wrong type**: `'mission_id' must be one of ['string', 'integer']`
- **Pattern mismatch**: `'schema_version' does not match pattern '^[0-9]+\\.[0-9]+\\.[0-9]+$'`
- **Array too short**: `'constraints' is too short (minimum 1)`
- **Invalid enum**: `'type' must be one of ['resource', 'time', 'legal']`

### Handling Validation Failures

Task profiles can configure failure behavior:

```yaml
failure_behavior:
  on_validation_failure:
    save_partial: true      # Save artifact even if invalid
    save_raw_response: true # Save raw LLM response
    exit_code: 1            # Exit code for scripts/CI
    message: "Custom error message"
```

---

## Common Patterns

### Pattern 1: Array of Objects with Evidence

```json
"items": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "description", "evidence_refs"],
    "properties": {
      "id": { "type": "string" },
      "description": { "type": "string", "minLength": 10 },
      "evidence_refs": {
        "type": "array",
        "items": { "$ref": "#/definitions/citation_id" }
      }
    }
  }
}
```

### Pattern 2: Enum Field

```json
"type": {
  "type": "string",
  "enum": ["resource", "time", "legal", "policy"]
}
```

### Pattern 3: Optional Nested Object

```json
"analysis": {
  "type": "object",
  "properties": {
    "score": { "type": "string", "enum": ["high", "medium", "low"] },
    "issues": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### Pattern 4: Conditional Fields

Use `anyOf` or `oneOf` for conditional structures:

```json
"range": {
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "type": { "const": "char" },
        "start": { "type": "integer" },
        "end": { "type": "integer" }
      }
    },
    {
      "type": "object",
      "properties": {
        "type": { "const": "page_line" },
        "page": { "type": "integer" },
        "line_start": { "type": "integer" },
        "line_end": { "type": "integer" }
      }
    }
  ]
}
```

---

## Schema Versioning

### Semantic Versioning

Use semantic versioning for `schema_version`:

- **Major** (X.0.0): Breaking changes (removed fields, changed types)
- **Minor** (0.X.0): New fields added (backward compatible)
- **Patch** (0.0.X): Bug fixes, clarifications

### Migration Strategy

When updating schemas:

1. **Create new version**: Update `schema_version` in schema file
2. **Update task profiles**: Point to new schema version if needed
3. **Test compatibility**: Ensure existing artifacts still validate
4. **Document changes**: Note breaking changes in schema comments

---

## Best Practices

1. **Always include `context`**: Provides mission/task metadata
2. **Use `definitions`**: Reuse citation_id and citation definitions
3. **Require `evidence_refs`**: All claims should cite evidence
4. **Set `minLength`/`maxLength`**: Constrain string fields appropriately
5. **Use enums**: Limit choices for categorical fields
6. **Document fields**: Use `description` fields in schema
7. **Test schemas**: Validate with `prompt_compilation.py` before deployment

---

## Troubleshooting

### Schema Not Found

**Error**: `Schema not found: my_schema.json`

**Solution**: 
1. Ensure file exists in `schemas/` directory
2. Check `schema_ref` in task profile matches filename exactly
3. Verify file has `.json` extension

### Validation Failures

**Error**: `Validation failed: 'field' is a required property`

**Solution**:
1. Check schema `required` array includes the field
2. Verify LLM is generating all required fields
3. Review prompt to ensure schema requirements are clear

### Schema-to-Prompt Issues

**Issue**: Generated prompt doesn't reflect schema changes

**Solution**:
1. Ensure `schema_generator` node is in prompt template
2. Verify schema file is being loaded correctly
3. Test with `prompt_compilation.py --graph-info`

---


