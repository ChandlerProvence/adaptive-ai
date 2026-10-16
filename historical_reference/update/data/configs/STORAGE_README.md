# Storage Configuration

The AI service uses multiple storage backends for different purposes:

- **PostgreSQL**: Primary database for catalog, tasks, purposes, workflows, LLM configs, and metadata
- **S3**: Document storage (PDFs, DOCX) fetched on-demand via boto3
- **Memoria API**: Mission data and file artifacts
- **Gossip API**: Social intelligence data
- **ChromaDB**: Vector store for evidence retrieval (optional, if implemented)

## PostgreSQL Configuration

PostgreSQL is the primary storage backend. Configuration uses environment variables with `DB_` prefix.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_DATABASE` | app | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | (required) | Database password |
| `DB_DATABASE_URL` | (auto-generated) | Full connection string (overrides individual params) |

### Usage

**Set individual parameters**:
```bash
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_USER="postgres"
export DB_PASSWORD="your-password"
export DB_DATABASE="app"
```

**Or use full connection string**:
```bash
export DB_DATABASE_URL="postgresql://user:password@localhost:5432/app"
```

**Connection pooling** (optional):
```bash
export DB_POOL_SIZE="20"           # Default: 5
export DB_MAX_OVERFLOW="40"        # Default: 10
export DB_POOL_TIMEOUT="60"        # Default: 60 seconds
export DB_POOL_RECYCLE="3600"      # Default: 3600 seconds
export DB_POOL_PRE_PING="true"     # Default: true
```

### Database Schema

The application uses the **guru schema** in PostgreSQL:

**Tables**:
- `guru.catalogs` - Catalog definitions
- `guru.catalog_tasks` - Task-to-catalog associations
- `guru.catalog_purposes` - Purpose-to-catalog associations
- `guru.tasks` - Task definitions and schemas
- `guru.purposes` - Purpose definitions
- `guru.workflows` - Workflow definitions
- `guru.workflow_phases` - Workflow step definitions
- `guru.llm_configs` - LLM API configurations
- `guru.artifact_schemas` - JSON schemas for validation

**Migration tracking**:
- `guru.alembic_version_guru` - Alembic migration version

## S3 Storage

Documents (PDFs, DOCX) are stored in S3 and fetched on-demand during task execution.

### Configuration

Uses standard AWS environment variables:
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### Usage

Documents are referenced by S3 URI in mission file artifacts:
```
s3://memoria-documents/intelligence/target-package.pdf
```

The service fetches documents via `boto3.client('s3')` and parses them in-memory:
- **PDFs**: Extracted with `pypdf.PdfReader`
- **DOCX**: Extracted with `python-docx.Document`
- **No disk writes**: All parsing done in-memory

## External APIs

### Memoria API

Mission data and file artifacts are retrieved from Memoria service.

**Environment variable**:
```bash
export MEMORIA_URL="http://memoria-service:8080"
```

**Usage**:
- Fetch mission metadata
- Get mission file artifacts (with S3 URIs)
- Retrieve mission-specific data

### Gossip API

Social intelligence data retrieved from Gossip service.

**Environment variable**:
```bash
export GOSSIP_URL="http://gossip-service:8080"
```

**Usage**:
- Fetch social media posts for mission
- Get intelligence from external sources
- Aggregate open-source intelligence

## ChromaDB (Optional)

Vector store for evidence retrieval when tasks use `retrieval.mode: chromadb`.

**Note**: ChromaDB integration may not be fully implemented. Current evidence retrieval uses:
- S3 documents (via Memoria)
- Gossip posts
- Task-specific fixtures

### Environment Variables (if using ChromaDB)

| Variable | Default | Description |
|----------|---------|-------------|
| `IMP_CHROMADB_PATH` | ./data/chromadb | Persistent path for ChromaDB |

### Usage (if implemented)

For tasks with `retrieval.mode: chromadb`, the system would:
1. Query the collection named in task config
2. Retrieve documents with metadata: `title`, `source_system`, `document_id`
3. Use document content as evidence

**Note**: Collection population must be done separately via ingestion pipeline.

## No Persistent Volumes Required

The service operates entirely in-memory:

- ✅ **No disk writes** during task execution
- ✅ **Documents fetched from S3** on-demand
- ✅ **All data in PostgreSQL** or external APIs
- ✅ **Artifacts returned** via Temporal workflow results
- ✅ **PVC removed** from Helm chart (as of 2026-05-08)

This architecture allows:
- Horizontal scaling without shared storage
- Stateless container deployments
- Cloud-native storage integration

## Legacy `storage.yaml`

The `storage.yaml` file in this directory may contain legacy configuration. Current configuration uses:
- Environment variables (via pydantic-settings)
- Database configuration in `models/ai/src/leidos/imp/ai/models/configuration/`

For current storage configuration, see:
- `models/ai/src/leidos/imp/ai/models/configuration/database.py` - PostgreSQL settings
- `models/ai/src/leidos/imp/ai/models/configuration/config.py` - Application configuration
