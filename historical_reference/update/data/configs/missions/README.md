# Mission Data

## ⚠️ Important: Mission Data Source

**Mission data is now retrieved from the Memoria API at runtime, not from JSON files.**

The JSON files in this directory serve as:
- **Examples** for mission data structure
- **Test fixtures** for development and testing
- **Reference** for understanding mission schema

### Runtime Mission Loading

When executing tasks, missions are loaded via:

```python
from leidos_imp_memoria_client import Client as Memoria

# Fetch mission from Memoria API
memoria = Memoria(base_url=MEMORIA_URL)
mission = await memoria.get_mission(mission_id=mission_id, hydrate=True)
```

**Memoria API provides**:
- Mission metadata (mission_id, mission_type, mission_statement)
- Operational context (aoi, time_window, organization)
- File artifacts with S3 URIs
- Hydrated mission data with all related entities

## Mission JSON Structure (for reference)

If using local mission files for testing, each file should include:

### Required Fields

- **mission_id** (string or UUID): Unique identifier referenced in API calls
- **mission_type** (string): e.g., MISO, PA, CA, Cyber, EW, Space
- **mission_statement** (string): Mission objective

### Optional Fields

- **aoi** (string): Area of interest
- **aor** (string): Area of responsibility
- **time_window** (string): Operational time window
- **organization_id** (string): Owning organization
- **team_id** (string): Responsible team

### Example Mission JSON

```json
{
  "mission_id": "miso_001",
  "mission_type": "MISO",
  "mission_statement": "Conduct military information support operations...",
  "aoi": "Pacific Theater",
  "time_window": "Q1 2026",
  "organization_id": "DOD",
  "team_id": "TEAM-ALPHA"
}
```

## Usage in Testing

For local testing without Memoria API:

1. **Create mission JSON** in this directory
2. **Configure test environment** to use local files instead of API
3. **Reference by mission_id** in test inputs

For production use, missions are always fetched from Memoria API.

## Migration Note

**Historical context**: Earlier versions of this service loaded missions from JSON files in this directory. The system has migrated to using Memoria API for mission data, which provides:

- ✅ Centralized mission management
- ✅ Real-time mission updates
- ✅ Mission versioning and history
- ✅ File artifact management via S3
- ✅ Integration with other IMP services

These JSON files remain for backwards compatibility and testing purposes.
