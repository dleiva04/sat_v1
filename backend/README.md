# Backend

FastAPI application that orchestrates the Security Analysis Tool (SAT). It manages workspace configuration, installs and runs Databricks jobs for each security tool, stores results in Unity Catalog, and exposes them through a REST API.

## Architecture

```
main.py                        ← FastAPI entry point, registers all routers
backend/
├── models/                    ← Pydantic request/response schemas
│   ├── api_response.py        ← Generic ApiResponse wrapper (ok / fail)
│   ├── jobs.py                ← ComputeConfig, JobInstallRequest, JobRunStatus
│   └── sat.py                 ← SATState, SetupRequest, SettingsUpdateRequest, ToolType enum
├── routes/                    ← HTTP endpoint handlers
│   ├── setup.py       POST /setup          – full first-time configuration
│   ├── state.py       GET  /state          – current app state
│   ├── jobs.py        POST /jobs/install, DELETE /jobs/uninstall, POST /jobs/run, GET /jobs/status
│   ├── checks.py      GET  /checks         – query security check results
│   └── settings.py    PUT  /settings       – partial config updates
├── services/                  ← Singleton services (imported, not injected)
│   ├── databricks_client.py   – Databricks SDK wrapper (secrets, SATState)
│   ├── databricks_sql.py      – SQL warehouse connection (single-connection singleton)
│   ├── config_service.py      – CRUD for sat_config / sat_logs UC tables
│   ├── jobs_service.py        – Install / uninstall / run / status for Databricks jobs
│   └── logger.py              – Shared Python logger factory
└── dependencies/              ← (reserved for FastAPI DI; currently unused)
```

## Data flow

1. **Secrets** are stored in a Databricks secret scope (`sat-app`).
2. **Configuration and logs** live in Unity Catalog tables `sat_config` and `sat_logs`.
3. **Security check results** are written by the SAT driver job into `security_checks`. The `/checks` endpoint JOINs this with `security_best_practices` to return enriched results (check name, category, severity, recommendation).
4. **Secret scanner results** are written to `notebooks_secret_scan_results` and `clusters_secret_scan_results`.
5. **Permissions analyzer results** are written to `brickhound_vertices`, `brickhound_edges`, and `brickhound_collection_metadata`.

## Services

All services are module-level singletons — imported once and reused across the app.

| Service | Singleton | Purpose |
|---------|-----------|---------|
| `Databricks` | `_DatabricksClient` | Wraps `WorkspaceClient` for secret management and builds `SATState` |
| `DatabricksSql` | `_DatabricksSql` | Single SQL warehouse connection; auto-creates/refreshes every 59 min |
| `ConfigService` | `_ConfigService` | Reads/writes `sat_config` and `sat_logs` tables via `DatabricksSql` |
| `JobsService` | `_JobsService` | Creates, deletes, triggers, and polls Databricks jobs per tool |

## Routes

Every endpoint is wrapped in `try/except` and returns an `ApiResponse` (`ok` or `fail`).

| Prefix | Endpoints | Services used |
|--------|-----------|---------------|
| `/setup` | `POST /` | Databricks, DatabricksSql, ConfigService, JobsService |
| `/state` | `GET /` | Databricks |
| `/jobs` | `POST /install/{tool}`, `DELETE /uninstall/{tool}`, `POST /run/{tool}`, `GET /status/{tool}` | JobsService |
| `/checks` | `GET /`, `GET /{check_id}` | Databricks, DatabricksSql |
| `/settings` | `PUT /` | Databricks, DatabricksSql, ConfigService, JobsService |

## SAT Job Code (`sat/`)

The `sat/` directory contains the Databricks notebook source code and configuration files that the Databricks jobs execute. It is derived from the upstream [security-analysis-tool](https://github.com/databricks-industry-solutions/security-analysis-tool) project.

```
sat/
├── configs/
│   ├── security_best_practices.csv      – 80+ security check definitions (severity, logic, recommendations)
│   ├── sat_dasf_mapping.csv             – Maps SAT check IDs to DASF control IDs
│   ├── self_assessment_checks.yaml      – Manual self-assessment config (encryption, SSO, SCIM, etc.)
│   └── trufflehog_detectors.yaml        – TruffleHog detector config (DAPI, DKEA, DSAPI, DOSE tokens)
└── notebooks/
    ├── security_analysis_initializer.py      ← SAT initializer entry point
    ├── security_analysis_driver.py           ← SAT driver entry point
    ├── security_analysis_secrets_scanner.py   ← Secret Scanner entry point
    ├── permission_analysis_data_collection.py ← Permissions Analyzer entry point
    ├── Setup/       – 8 numbered notebooks called sequentially by the initializer
    ├── Utils/       – initialize, common, accounts_bootstrap, workspace_bootstrap, sat_checks_config
    ├── Includes/    – workspace_analysis, workspace_stats, workspace_settings, install_sat_sdk, scan_secrets/
    ├── diagnosis/   – pre_run_config_check and cloud-specific connectivity diagnostics
    ├── brickhound/  – Permissions graph analysis (escalation paths, impersonation, advanced reports)
    └── export/      – export_sat_report.py (CSV export of latest findings)
```

## Tool-to-Job Mapping

`JobsService` creates Databricks Jobs that point to these notebooks. The mapping is defined in `TOOL_NOTEBOOK_PATHS` inside `services/jobs_service.py`. SAT creates **two** jobs (initializer + driver); the other tools each create one.

| ToolType | Job name | Entry notebook | Purpose |
|----------|----------|---------------|---------|
| `sat` | `sat-sat-initializer` | `security_analysis_initializer.py` | One-time setup: schemas, connections, dashboards, alerts |
| `sat` | `sat-sat-driver` | `security_analysis_driver.py` | Recurring: security analysis across all enabled workspaces |
| `permissions_analyzer` | `sat-permissions_analyzer-analyzer` | `permission_analysis_data_collection.py` | Collects permissions graph data (BrickHound) |
| `secret_scanner` | `sat-secret_scanner-scanner` | `security_analysis_secrets_scanner.py` | TruffleHog secret scanning of notebooks and cluster configs |

## SAT Workflow

The core SAT tool follows a two-phase workflow: **initializer first, then driver on a recurring schedule**.

### Initializer (run once)

1. Shared preamble: `pre_run_config_check` → `install_sat_sdk` → `initialize` → `common`
2. Runs Setup notebooks in order:
   - List account workspaces to config file
   - Test workspace connections
   - Enable workspaces for SAT
   - Import Lakeview dashboard template
   - Configure alert templates
   - Run self-assessment
3. Drops intermediate staging schema

### Driver (run on schedule)

1. Same shared preamble
2. `accounts_bootstrap` with `origin="driver"` (loads account-level data)
3. Loads best practices config and DASF mapping
4. For each enabled workspace:
   - `workspace_bootstrap` — calls workspace APIs, stores results in intermediate tables
   - `workspace_analysis` — evaluates 80+ security rules, writes to `security_checks`
   - `workspace_stats` — writes workspace/account stats to `account_info`
   - `workspace_settings` — evaluates workspace settings against best practices
5. Supports parallel execution via `ThreadPoolExecutor(max_workers=4)`
6. Drops intermediate staging schema

### Secret Scanner

Shared preamble, then for each workspace generates a shared `run_id` and runs:
- `notebook_secret_scan` — TruffleHog scanning of all notebooks
- `cluster_secrets_scan` — TruffleHog scanning of cluster `spark_env_vars`

### Permissions Analyzer

Collects all Databricks objects and permissions across workspaces into three tables: `brickhound_vertices`, `brickhound_edges`, and `brickhound_collection_metadata`. On serverless compute, collection is limited to the current workspace.

## Key dependencies

| Package | Role |
|---------|------|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server (port 8000) |
| `databricks-sdk` | Workspace client, jobs API, secrets API |
| `databricks-sql-connector` | SQL warehouse queries |
| `python-dotenv` | Load `.env` at startup |
