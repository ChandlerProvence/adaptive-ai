# IMP Configuration Guide

This guide covers all configuration files in the `data/configs/` directory, their purpose, structure, constraints, and how to add new configurations.

## ⚠️ Important: YAML Files are Source of Truth

**These YAML files are NOT used directly by the application at runtime.** Instead:

1. **YAML files** (`data/configs/`) are the **source of truth** - edit these files to make changes
2. **Data loader scripts** (`scripts/load_*.py`) read YAML files and populate PostgreSQL database
3. **Application** reads from PostgreSQL at runtime (APIs and Temporal workers)

### Workflow for Configuration Changes

```
Edit YAML → Run Data Loader → Database Updated → Application Uses New Config
  ↓              ↓                    ↓                      ↓
catalog.yaml  load_catalog.py    PostgreSQL          FastAPI/Temporal
```

To apply configuration changes:
```bash
# 1. Edit YAML files in data/configs/
vim data/configs/catalog.yaml

# 2. Load into database
export IMP_DATABASE_URL="postgresql://user:password@localhost:5432/app"
uv run python scripts/load_all_data.py

# 3. Restart application (if needed)
# Configuration is now active
```

See [scripts/README.md](../../scripts/README.md) for detailed data loader documentation.

---

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Catalog (`catalog.yaml`)](#catalog-catalogyaml)
3. [Task Profiles (`task_profiles/`)](#task-profiles-task_profiles)
4. [Purpose Profiles (`purpose_profiles/`)](#purpose-profiles-purpose_profiles)
5. [Missions (`missions/`)](#missions-missions)
6. [LLM Config (`llm_config.yaml`)](#llm-config-llm_configyaml)
7. [Storage Config (`storage.yaml`)](#storage-config-storageyaml)
8. [Prompt Templates (`prompt_templates/`)](#prompt-templates-prompt_templates)
9. [Adding New Configurations](#adding-new-configurations)

---

## Configuration Overview

The IMP system uses a hierarchical configuration structure:

```
data/configs/
├── catalog.yaml              # Central registry of tasks and purposes
├── llm_config.yaml           # LLM API configuration
├── storage.yaml              # PostgreSQL and ChromaDB settings
├── task_profiles/            # Task definitions (WHAT is done)
├── purpose_profiles/         # Purpose definitions (WHY it's done)
├── missions/                 # Mission JSON files
├── prompt_templates/         # Graph-based prompt templates
└── workflows/                # Workflow definitions
```

**Key Principles:**
- **YAML files are source data**: Edit these, then load into database
- **Database is runtime source**: Application queries PostgreSQL, not YAML files
- **Tasks are mission-agnostic**: Same task can run under any mission
- **Purposes are cross-cutting**: Same purpose can be used with any task
- **Missions are data**: Mission data now comes from Memoria API (these files for testing)
- **Configs are composable**: Task + Purpose + Mission = Runtime configuration

---

## Catalog (`catalog.yaml`)

### Purpose

The catalog is the **central registry** that links task IDs and purpose IDs to their profile files. It does NOT contain mission data (missions are loaded separately from `missions/` directory).

### Structure

```yaml
version: "1.0"
description: "Mission/task/purpose registry"

missions_source: missions  # Directory containing mission JSON files

mission_types:             # Optional: recognized mission types
  - MISO
  - PA
  - CA
  # ...

tasks:                     # Task registry
  task_id:
    profile: task_profiles/path/to/task.yaml
    artifact_type: ARTIFACT_TYPE  # Optional, can be in task profile

purposes:                  # Purpose registry
  purpose_id:
    profile: purpose_profiles/path/to/purpose.yaml
```

### How It Works

1. **Task Registration**: Each task must be registered in `catalog.yaml` under `tasks`
2. **Purpose Registration**: Each purpose must be registered under `purposes`
3. **Runtime Resolution**: `run.py` uses catalog to:
   - Validate `task_id` and `purpose_id` from input
   - Load corresponding profile files
   - Resolve artifact types

### Example: Adding a New Task

```yaml
# In catalog.yaml
tasks:
  my_new_task:
    profile: task_profiles/my_new_task.yaml
    artifact_type: MY_ARTIFACT_TYPE
```

Then create `task_profiles/my_new_task.yaml` (see Task Profiles section).

### Constraints

- **Task IDs must be unique** across all tasks
- **Purpose IDs must be unique** across all purposes
- **Profile paths** must be relative to `configs/` directory
- **Mission types** are optional validation hints; missions can use any type

### Technical Details

- Catalog is loaded once per run via `load_catalog()` in `run.py`
- Used for validation: `validate_catalog()` checks task/purpose exist
- Profile paths are resolved relative to `CONFIGS_DIR` constant

---

## Task Profiles (`task_profiles/`)

### Purpose

Task profiles define **WHAT** is done. They are mission-agnostic and describe the task's capabilities, output schema, retrieval mode, and behavior.

### Structure

```yaml
version: "1.0"
task_id: my_task
name: "My Task"
slug: my-task

artifact:
  artifact_type: MY_ARTIFACT_TYPE
  schema_ref: my_artifact.schema.json

retrieval:
  mode: doc_file  # or "fixture" or "chromadb"
  fixture_file: path/to/fixture.json  # if mode: fixture
  # chromadb: ...  # if mode: chromadb

prompt_template: "default.yaml"  # or "custom.yaml" or inline prompt_graph

output_overrides:  # Task-specific output constraints
  max_items: 10

failure_behavior:
  on_validation_failure:
    save_partial: true
    exit_code: 1
  on_llm_error:
    exit_code: 2
  on_parse_error:
    save_partial: true
    exit_code: 2

description: |
  Task description used in prompts. Should clearly explain what the task does
  and what output is expected.
```

### Key Fields

#### `artifact`
- **`artifact_type`**: Unique identifier for artifact type (e.g., `COA_PACKAGE`)
- **`schema_ref`**: Schema file name in `schemas/` directory
- **Purpose**: Links task to its output schema for validation

#### `retrieval`
- **`mode`**: How evidence is retrieved
  - `fixture`: Pre-loaded JSON from `fixtures/` directory
  - `doc_file`: Extract from document in `docs/` (requires `doc_path` in input)
  - `chromadb`: Vector search (see `storage.yaml` for config)
- **`fixture_file`**: Required if `mode: fixture`
- **Purpose**: Determines evidence source for the task

#### `prompt_template`
- **Value**: Filename in `prompt_templates/` directory (e.g., `"default.yaml"`)
- **Alternative**: Inline `prompt_graph` configuration
- **Purpose**: Controls how prompts are generated (see Prompt Templates section)

#### `failure_behavior`
- **`on_validation_failure`**: What to do if schema validation fails
- **`on_llm_error`**: What to do if LLM API call fails
- **`on_parse_error`**: What to do if JSON parsing fails
- **Purpose**: Error handling and exit codes

### Example: Creating a New Task Profile

**Step 1: Create task profile file**

```yaml
# configs/task_profiles/my_analysis.yaml
version: "1.0"
task_id: my_analysis
name: "My Analysis Task"
slug: my-analysis

artifact:
  artifact_type: MY_ANALYSIS
  schema_ref: my_analysis.schema.json

retrieval:
  mode: doc_file

prompt_template: "default.yaml"

failure_behavior:
  on_validation_failure:
    save_partial: true
    exit_code: 1
  on_llm_error:
    exit_code: 2
  on_parse_error:
    save_partial: true
    exit_code: 2

description: |
  Perform analysis on the provided document. Extract key insights and
  categorize findings. All findings must cite evidence sources.
```

**Step 2: Register in catalog**

```yaml
# configs/catalog.yaml
tasks:
  my_analysis:
    profile: task_profiles/my_analysis.yaml
    artifact_type: MY_ANALYSIS
```

**Step 3: Create schema** (see `schemas/README.md`)

**Step 4: Test**

```bash
python3 run.py examples/input_example.json  # Use your task_id
```

### Constraints

- **`task_id` must match catalog entry**
- **`schema_ref` must exist** in `schemas/` directory
- **`retrieval.mode: doc_file` requires** `doc_path` in input JSON
- **`retrieval.mode: fixture` requires** `fixture_file` to exist
- **`prompt_template` must exist** in `prompt_templates/` (or use inline `prompt_graph`)

### Technical Details

- Task profiles are loaded via `load_profiles()` in `run.py`
- Combined with purpose profile and mission at runtime
- `artifact_type` can be in catalog OR task profile (profile takes precedence)
- Task profiles are YAML files, validated on load

---

## Purpose Profiles (`purpose_profiles/`)

### Purpose

Purpose profiles define **WHY** something is done. They are cross-cutting (work with any task) and define audience, intended use, release level, time sensitivity, and risk tolerance.

### Structure

```yaml
version: "1.0"
description: |
  High-level description of this purpose.

audience:
  executive: |
    Guidance for executive audience...
  commander: |
    Guidance for commander audience...
  analyst: |
    Guidance for analyst audience...
  # ... other audiences

intended_use:
  options_development: |
    Guidance for options development use case...
  recommendation_brief: |
    Guidance for recommendation brief use case...
  # ... other use cases

release_level:
  draft: Guidance for draft releases...
  final: Guidance for final releases...
  exploratory: Guidance for exploratory releases...

time_sensitivity:
  high: Guidance for high time sensitivity...
  medium: Guidance for medium time sensitivity...
  low: Guidance for low time sensitivity...

risk_tolerance:
  high: Guidance for high risk tolerance...
  moderate: Guidance for moderate risk tolerance...
  low: Guidance for low risk tolerance...
```

### Key Fields

#### `audience`
- **Structure**: Dictionary mapping audience keys to guidance text
- **Purpose**: Tailors output tone and detail level
- **Usage**: Selected via `audience` field in input JSON or `default_audience` in purpose
- **Example audiences**: `executive`, `commander`, `analyst`, `planner`, `partner`

#### `intended_use`
- **Structure**: Dictionary mapping use case keys to guidance text
- **Purpose**: Shapes output structure and focus
- **Usage**: Selected via `intended_use` field in input JSON
- **Example uses**: `options_development`, `recommendation_brief`, `quality_review`

#### `release_level`, `time_sensitivity`, `risk_tolerance`
- **Structure**: Dictionary mapping level keys to guidance text
- **Purpose**: Further refines output characteristics
- **Usage**: Selected via corresponding fields in input JSON

### Example: Creating a New Purpose Profile

**Step 1: Create purpose profile**

```yaml
# configs/purpose_profiles/my_purpose.yaml
version: "1.0"
description: |
  Purpose for my specific use case.

audience:
  executive: |
    Provide high-level summary with key decisions and implications.
  analyst: |
    Provide detailed analysis with full evidence citations.

intended_use:
  my_use_case: |
    Structure output for my specific use case...

release_level:
  draft: Working draft...
  final: Final version...

time_sensitivity:
  high: Urgent...
  medium: Normal...
  low: Deliberate...

risk_tolerance:
  high: Exploratory...
  moderate: Balanced...
  low: Conservative...
```

**Step 2: Register in catalog**

```yaml
# configs/catalog.yaml
purposes:
  my_purpose:
    profile: purpose_profiles/my_purpose.yaml
```

**Step 3: Use in input**

```json
{
  "mission_id": 8675309,
  "task_id": "coa_generation",
  "purpose_id": "my_purpose",
  "audience": "executive"
}
```

### Constraints

- **Purpose IDs must be unique**
- **Audience/use case keys** are arbitrary strings (no predefined list)
- **Guidance text** is injected into prompts, so be clear and actionable
- **Default values** can be set but are optional

### Technical Details

- Purpose profiles are loaded via `load_profiles()` in `run.py`
- Guidance text is resolved at runtime based on input selections
- If input doesn't specify a key, system uses first available or falls back to description
- Purpose profiles modify prompt tone/structure but don't change task output schema

---

## Missions (`missions/`)

### Purpose

Mission files contain mission-specific data (mission_id, mission_type, mission_statement, aoi, aor, etc.). They are JSON files loaded at runtime.

### Structure

```json
{
  "mission_id": 8675309,
  "mission_type": "MISO",
  "mission_statement": "Mission statement text...",
  "aoi": "Area of Interest",
  "aor": "Area of Responsibility",
  "time_window": "P30D",
  "organization_id": "ORG_ID",
  "team_id": "TEAM_ID"
}
```

### How It Works

1. **Mission Loading**: `load_mission()` searches `missions/` directory for JSON files
2. **Matching**: Finds file where `mission_id` matches input `mission_id`
3. **Mission Statement Generation**: If `mission_statement` is missing/empty, system can generate it from `doc_path`

### Example: Creating a New Mission

**Step 1: Create mission file**

```json
// configs/missions/my_mission.json
{
  "mission_id": "my_mission_001",
  "mission_type": "MISO",
  "mission_statement": "My mission statement...",
  "aoi": "Region X",
  "aor": "AOR_Y",
  "time_window": "P60D",
  "organization_id": "ORG_123",
  "team_id": "TEAM_456"
}
```

**Step 2: Use in input**

```json
{
  "mission_id": "my_mission_001",
  "task_id": "coa_generation",
  "purpose_id": "planning"
}
```

### Mission Statement Generation

If `mission_statement` is missing or empty, provide `doc_path` in input:

```json
{
  "mission_id": "my_mission_001",
  "task_id": "coa_generation",
  "purpose_id": "planning",
  "doc_path": "my_document.docx"
}
```

The system will:
1. Extract text from document
2. Generate mission statement (and optionally aoi/aor)
3. Merge into mission object
4. Continue with task execution

### Constraints

- **`mission_id` must be unique** across all mission files
- **Required fields**: `mission_id`, `mission_type`, `time_window`, `organization_id`, `team_id`
- **Optional fields**: `mission_statement`, `aoi`, `aor` (can be generated)
- **File naming**: Can be any `.json` file; `mission_id` is matched from content

### Technical Details

- Missions are loaded via `load_mission()` in `run.py`
- Searches all `.json` files in `missions/` directory
- Mission data is merged with task/purpose configs at runtime
- Mission statement generation uses `mission_statement_generation` task internally

---

## LLM Config (`llm_config.yaml`)

### Purpose

Configures the LiteLLM API connection, model selection, and generation parameters.

### Structure

```yaml
base_url: "https://litellm.iho.leidos.com/v1"
api_key_env: LITELLM_API_KEY
api_key_header: x-litellm-api-key

model: "gpt-4o"
temperature: 0.2
```

### Key Fields

#### `base_url`
- **Purpose**: LiteLLM proxy endpoint
- **Format**: Must end with `/v1` or will be auto-appended
- **Default**: `https://litellm.iho.leidos.com/v1`

#### `api_key_env`
- **Purpose**: Environment variable name containing API key
- **Required**: Environment variable must be set
- **Example**: `LITELLM_API_KEY`

#### `api_key_header`
- **Purpose**: HTTP header name for API key
- **Default**: `x-litellm-api-key`

#### `model`
- **Purpose**: Model identifier for LiteLLM
- **Default**: `gpt-4o`
- **Note**: Must be available via your LiteLLM proxy

#### `temperature`
- **Purpose**: Sampling temperature (0.0 = deterministic, 1.0 = creative)
- **Default**: `0.2` (low temperature for consistent outputs)
- **Range**: 0.0 to 2.0

### How It Works

1. **Loading**: `load_llm_config()` reads `llm_config.yaml`
2. **API Key**: Retrieved from environment variable specified in `api_key_env`
3. **Client Creation**: OpenAI-compatible client created with base_url and headers
4. **Usage**: Client used in `generate_artifact()` and `generate_mission_statement()`

### Example: Using Different Model

```yaml
# configs/llm_config.yaml
base_url: "https://litellm.iho.leidos.com/v1"
api_key_env: LITELLM_API_KEY
api_key_header: x-litellm-api-key

model: "gpt-4-turbo"  # Changed model
temperature: 0.3       # Slightly higher temperature
```

### Constraints

- **API key must be set** in environment variable
- **Base URL must be accessible** (VPN may be required)
- **Model must be available** via LiteLLM proxy
- **Temperature** should be low (0.1-0.3) for consistent, factual outputs

### Technical Details

- Config is loaded once per LLM call via `load_llm_config()`
- Uses `openai` Python library (OpenAI-compatible API)
- API key is passed in both `api_key` parameter and custom header
- Base URL is normalized to include `/v1` if missing

### Testing Connection

Use `test_llm_connection.py`:

```bash
export LITELLM_API_KEY="your-key-here"
python3 test_llm_connection.py
```

---

## Storage Config (`storage.yaml`)

### Purpose

Configures PostgreSQL (for run metadata) and ChromaDB (for vector evidence retrieval). Both are optional and we can replace these once we have defined actual data gateway.

### Structure

```yaml
postgres:
  enabled: true
  host: "${IMP_POSTGRES_HOST:-localhost}"
  port: "${IMP_POSTGRES_PORT:-5432}"
  database: "${IMP_POSTGRES_DATABASE:-imperium}"
  user: "${IMP_POSTGRES_USER:-imperium}"
  password_env: IMP_POSTGRES_PASSWORD
  schema: "${IMP_POSTGRES_SCHEMA:-public}"
  runs_table: imp_runs

chromadb:
  enabled: true
  path: "${IMP_CHROMADB_PATH:-./data/chromadb}"
  default_collection: imp_evidence
```

### Key Fields

#### PostgreSQL (`postgres`)
- **`enabled`**: Enable/disable PostgreSQL persistence
- **`host`, `port`, `database`, `user`**: Connection parameters
- **`password_env`**: Environment variable for password
- **`schema`**: Database schema name
- **`runs_table`**: Table name for run metadata

#### ChromaDB (`chromadb`)
- **`enabled`**: Enable/disable ChromaDB
- **`path`**: Local filesystem path for ChromaDB data
- **`default_collection`**: Default collection name for evidence retrieval

### Environment Variable Resolution

Values support `${VAR:-default}` syntax:
- `${IMP_POSTGRES_HOST:-localhost}` → Use `IMP_POSTGRES_HOST` env var, or `localhost` if not set
- Resolved at load time via `_resolve_env_in_value()` in `run.py`

### How It Works

1. **Loading**: `load_storage_config()` reads `storage.yaml`
2. **Env Resolution**: Environment variables are resolved
3. **PostgreSQL**: Used in `persist_run_metadata()` if enabled
4. **ChromaDB**: Used in `retrieve_evidence_chromadb()` if `retrieval.mode: chromadb`

### Example: Disabling Storage

```yaml
postgres:
  enabled: false

chromadb:
  enabled: false
```

### Constraints

- **PostgreSQL password** must be set in environment variable if enabled
- **ChromaDB path** must be writable if enabled
- **Both are optional** - system works without them (uses fixtures instead)

### Technical Details

- Config is loaded via `load_storage_config()` in `run.py`
- Environment variables resolved using regex pattern matching
- PostgreSQL creates tables automatically if they don't exist
- ChromaDB uses local filesystem by default (can be configured for remote)

---

## Prompt Templates (`prompt_templates/`)

### Purpose

Define graph-based prompt structures using composable nodes. Tasks reference templates via `prompt_template` field.

### Structure

```yaml
version: "1.0"
description: "Template description"

nodes:
  - id: "system_role"
    type: "template"
    template: "You are a {mission_type} analyst..."
  
  - id: "schema_instructions"
    type: "schema_generator"

edges:
  - from: "system_role"
    to: "schema_instructions"
```

### Node Types

- **`template`**: Text template with variable substitution
- **`config_value`**: Value from task/purpose config
- **`schema_generator`**: Auto-generated from schema
- **`evidence_formatter`**: Formats evidence for prompt
- **`static`**: Static text content

### How It Works

1. **Task References Template**: `prompt_template: "default.yaml"` in task profile
2. **Template Loaded**: `load_prompt_template()` reads YAML file
3. **Graph Built**: `load_prompt_graph_from_config()` creates `PromptGraph`
4. **Prompt Generated**: Graph executed with mission/task/purpose context
5. **Output**: Final prompt string sent to LLM

### Example: Creating Custom Template

**Step 1: Create template file**

```yaml
# configs/prompt_templates/my_template.yaml
version: "1.0"
description: "Custom template for my task"

nodes:
  - id: "intro"
    type: "template"
    template: "Task: {task_id}, Mission: {mission_id}"
  
  - id: "instructions"
    type: "static"
    content: "Follow these instructions..."
  
  - id: "schema"
    type: "schema_generator"

edges:
  - from: "intro"
    to: "instructions"
  - from: "instructions"
    to: "schema"
```

**Step 2: Reference in task profile**

```yaml
# configs/task_profiles/my_task.yaml
prompt_template: "my_template.yaml"
```

### Template Inheritance

Templates can extend others (future feature):

```yaml
extends: "default.yaml"  # Inherit base template
nodes:
  - id: "custom_section"
    type: "static"
    content: "..."
```

### Constraints

- **Template files must exist** in `prompt_templates/` directory
- **Node IDs must be unique** within a template
- **Edges must reference existing nodes**
- **Graph must be acyclic** (no circular dependencies)

### Technical Details

- Templates are loaded via `load_prompt_template()` in `prompt_graph.py`
- Graph execution uses topological sort for dependency order
- Variables in templates are substituted from mission/task/purpose context
- See `PROMPT_GRAPH_GUIDE.md` for detailed documentation

---

## Adding New Configurations

### Adding a New Task

1. **Create task profile** (`configs/task_profiles/my_task.yaml`)
2. **Create schema** (`schemas/my_artifact.schema.json`)
3. **Register in catalog** (`configs/catalog.yaml`)
4. **Test**: `python3 run.py examples/input_example.json` (with your task_id)

### Adding a New Purpose

1. **Create purpose profile** (`configs/purpose_profiles/my_purpose.yaml`)
2. **Register in catalog** (`configs/catalog.yaml`)
3. **Use in input**: Set `purpose_id: "my_purpose"` in input JSON

### Adding a New Mission

1. **Create mission file** (`configs/missions/my_mission.json`)
2. **Use in input**: Set `mission_id: "my_mission_id"` in input JSON

### Adding a New Prompt Template

1. **Create template file** (`configs/prompt_templates/my_template.yaml`)
2. **Reference in task**: Set `prompt_template: "my_template.yaml"` in task profile

---

## Configuration Validation

### Runtime Validation

- **Catalog validation**: `validate_catalog()` checks task/purpose exist
- **Mission validation**: `load_mission()` raises error if mission not found
- **Schema validation**: `load_schema()` raises error if schema file missing
- **Template validation**: Graph validation checks for cycles and missing nodes

### Best Practices

1. **Use version fields** in YAML configs for tracking changes
2. **Document fields** with comments in YAML files
3. **Test configurations** with `prompt_compilation.py` before running
4. **Use environment variables** for secrets (passwords, API keys)
5. **Keep configs atomic** - one concern per config file

---

## Troubleshooting

### Task Not Found

**Error**: `Task not in catalog: my_task`

**Solution**: Add task to `catalog.yaml` under `tasks` section

### Purpose Not Found

**Error**: `Purpose not in catalog: my_purpose`

**Solution**: Add purpose to `catalog.yaml` under `purposes` section

### Schema Not Found

**Error**: `Schema not found: my_schema.json`

**Solution**: Ensure schema file exists in `schemas/` directory and `schema_ref` in task profile matches filename

### Template Not Found

**Error**: `Prompt template not found: my_template.yaml`

**Solution**: Ensure template file exists in `prompt_templates/` directory

### LLM Connection Failed

**Error**: `LiteLLM API error`

**Solution**: 
1. Check `LITELLM_API_KEY` environment variable is set
2. Verify VPN connection if required
3. Test with `python3 test_llm_connection.py`

---

## Related Documentation

- **Schemas**: See `schemas/README.md` for schema documentation
- **Storage**: See `configs/STORAGE_README.md` for storage configuration details
