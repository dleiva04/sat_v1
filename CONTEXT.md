# SAT v1 — Project Context

## Overview

SAT (Security Analysis Tool) is a Databricks App that lets workspace administrators install and run security checks against their Databricks workspace. The app manages Databricks Jobs (core + optional add-ons), displays check results, and provides a dashboard view of the workspace's security posture.

The app is self-contained: it runs inside Databricks as a Databricks App, authenticates via OAuth, and uses the Databricks SDK and Jobs API to create and manage jobs programmatically.

---

## Tech Stack

### Backend
- **Python 3.13**
- **FastAPI** — REST API
- **Uvicorn** — ASGI server
- **Databricks SDK** (`databricks-sdk>=0.90.0`) — workspace client, secrets, jobs API
- **Databricks SQL Connector** (`databricks-sql-connector>=4.2.5`) — query results from Delta tables
- **python-dotenv** — local env config

### Frontend
- **Astro 5** — page framework (static-first, SSG)
- **React 19** — interactive components via Astro islands (`client:load`)
- **TypeScript** — all frontend code
- **CSS Modules** — component-scoped styles

### Infrastructure
- **Databricks App** — deployment target (`app.yml`)
- **Databricks Jobs** — where actual checks execute
- **Databricks Secrets** — stores config (scope: `sat-app`)
- **Unity Catalog** — stores check results in Delta tables (catalog + schema chosen at setup)

---

## Architecture

```
Databricks App (this app)
│
├── Frontend (Astro + React)
│   ├── Setup page        — initial configuration
│   ├── Dashboard page    — security posture overview (icon/status only, TBD)
│   └── Tools page        — install/uninstall core + add-ons, trigger runs
│
└── Backend (FastAPI)
    ├── /setup            — configure account ID, catalog, schema, secret scope
    ├── /state            — current installation state
    ├── /jobs             — create, get status, trigger jobs
    └── /checks           — query check results from Delta tables
```

### Job Architecture

SAT uses a **core + add-on** model. Jobs are created via the Databricks Jobs API when the user installs each tool from within the app.

#### Core (required)

| Job | Purpose |
|-----|---------|
| **SAT Initializer** | One-time setup: creates Delta tables, seeds check definitions, prepares the schema |
| **SAT Driver** | Runs all enabled security checks against the workspace, writes results to Delta |

#### Add-ons (optional, installable from the app)

| Add-on | Job | Purpose |
|--------|-----|---------|
| **Permissions Analyzer** | `sat-permissions-analyzer` | Scans all entities (users, groups, service principals) and their permissions inside the Databricks workspace; writes results to Delta |
| **Secret Scanner** | `sat-secret-scanner` | Detects secrets exposed directly in notebooks (hardcoded credentials, tokens, keys) without using Databricks secret scopes; writes results to Delta |

Each add-on job is independent. Jobs are created by the app via the Databricks Jobs API when the user clicks "Install" for that add-on.

---

## State Model

State is persisted in two places:
1. **Databricks Secrets** (scope: `sat-app`) — runtime config (account ID, setup flag)
2. **Delta table** — check results, job run history

```python
class ToolType(str, Enum):
    SAT = "sat"
    PERMISSIONS_ANALYZER = "permissions_analyzer"
    SECRET_SCANNER = "secret_scanner"

class SATState(BaseModel):
    databricks_account_id: str
    installed_tools: List[ToolType]       # tools with jobs created
    available_tools: List[ToolType]       # all possible tools
    secret_scope: str                     # always "sat-app"
    sat_job_id: str                       # SAT Driver job ID
    sat_job_url: str
    permissions_analyzer_job_id: str
    permissions_analyzer_job_url: str
    secret_scanner_job_id: str
    secret_scanner_job_url: str
```

---

## API Endpoints

### Existing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/setup` | One-time setup: configure account ID, catalog, schema, selected tools, and compute; installs tools and marks app as configured |
| GET | `/state` | Return current SATState (includes `is_configured`, compute config, installed tools) |
| PUT | `/settings` | Update any configuration post-setup: account ID, catalog, schema, compute, install/uninstall tools |
| POST | `/jobs/install/{tool}` | Create the Databricks job for the given tool (`sat`, `permissions_analyzer`, `secret_scanner`) |
| DELETE | `/jobs/uninstall/{tool}` | Delete the job for the given tool |
| POST | `/jobs/run/{tool}` | Trigger a job run for the given tool |
| GET | `/jobs/status/{tool}` | Get latest run status for a tool's job |
| GET | `/checks` | Query check results from Delta (supports filter by tool, status, severity) |
| GET | `/checks/{check_id}` | Get detail for a specific check result |

---

## Job Definitions

### Compute

The customer can choose the compute type at install time. The app should support:
- **Serverless** (default, recommended)
- **All-purpose cluster** (by cluster ID)
- **Job cluster** (with configurable node type and autoscaling)

The compute selection is presented in the UI when the user installs a tool.

### Job Notebook/Script Paths

Jobs reference notebooks or Python scripts stored in the workspace or in a Volume. Paths TBD based on deployment convention — likely stored under `/Workspace/SAT/` or a Unity Catalog Volume.

### SAT Initializer Job Spec (example skeleton)

```python
{
  "name": "sat-initializer",
  "tasks": [
    {
      "task_key": "init",
      "notebook_task": {
        "notebook_path": "/Workspace/SAT/initializer",
        "base_parameters": {
          "catalog": "<catalog>",
          "schema": "<schema>",
          "account_id": "<account_id>"
        }
      },
      # compute: set by user choice
    }
  ]
}
```

### SAT Driver Job Spec (example skeleton)

```python
{
  "name": "sat-driver",
  "tasks": [
    {
      "task_key": "run_checks",
      "notebook_task": {
        "notebook_path": "/Workspace/SAT/driver",
        "base_parameters": {
          "catalog": "<catalog>",
          "schema": "<schema>"
        }
      }
    }
  ],
  "schedule": {
    # optional, user can configure run frequency
  }
}
```

---

## Security Checks

> **TODO**: Check definitions will be loaded from an external checks config file (to be provided). Each check has at minimum:
> - `check_id` — unique identifier
> - `name` — human-readable name
> - `description` — what the check evaluates
> - `severity` — `critical | high | medium | low | informational`
> - `tool` — which job runs this check (`sat | permissions_analyzer | secret_scanner`)
> - `remediation` — guidance for fixing a failed check

Check results are stored in a Delta table: `<catalog>.<schema>.sat_check_results`

---

## Delta Table Schema (planned)

### `sat_check_results`

| Column | Type | Description |
|--------|------|-------------|
| `run_id` | STRING | Job run ID |
| `tool` | STRING | `sat`, `permissions_analyzer`, `secret_scanner` |
| `check_id` | STRING | Unique check identifier |
| `check_name` | STRING | Human-readable check name |
| `severity` | STRING | `critical`, `high`, `medium`, `low`, `informational` |
| `status` | STRING | `pass`, `fail`, `skip`, `error` |
| `resource_type` | STRING | What was evaluated (cluster, user, notebook, etc.) |
| `resource_id` | STRING | ID of the evaluated resource |
| `detail` | STRING | Extra context / raw value |
| `remediation` | STRING | Fix guidance |
| `evaluated_at` | TIMESTAMP | When check ran |

---

## Frontend Pages

### 1. Setup (`/`) — One-time wizard
- Multi-step wizard that runs only once (before the app is configured)
- **Step 1**: Account ID, Catalog, Schema
- **Step 2**: Select tools to install (SAT Core pre-checked + optional add-ons)
- **Step 3**: Choose compute configuration (serverless, existing cluster, job cluster)
- On submit, calls `POST /setup` which installs everything in one go
- After successful setup, redirects to `/tools`
- On subsequent visits, if already configured, redirects to `/dashboard`

### 2. Tools (`/tools`)
- Shows three tool cards: SAT Core, Permissions Analyzer, Secret Scanner
- Each card shows:
  - Install/Uninstall button
  - Run Now button (only if installed)
  - Last run status + timestamp
  - Link to job in Databricks (job URL)
  - Compute selector (shown during install flow)
- SAT Core card includes both Initializer and Driver sub-jobs

### 3. Dashboard (`/dashboard`)
- Placeholder for now
- Show a single dashboard icon/status indicator representing overall security posture
- Detail design deferred — data model must be in place but UI can be minimal

### 4. Settings (`/settings`)
- Editable form for all configuration: account ID, catalog, schema, compute, tools
- Changes are applied immediately via `PUT /settings`
- Tools can be installed/uninstalled from here as well as from the Tools page

### 5. Checks (`/checks`) — optional phase 2
- Table/list of all check results
- Filterable by tool, status, severity
- Drill-down to check detail

---

## File Structure (current + planned)

```
sat_v1/
├── app.yml                          # Databricks App config
├── main.py                          # FastAPI app entry point
├── run.sh                           # App startup script
├── pyproject.toml
├── requirements.txt
├── context.md                       # This file
│
├── backend/
│   ├── __init__.py
│   ├── models/
│   │   ├── sat.py                   # SATState, ToolType, SetupRequest, SettingsUpdateRequest
│   │   ├── api_response.py          # ApiResponse, ok(), fail()
│   │   └── jobs.py                  # JobInstallRequest, JobStatus, ComputeType
│   ├── routes/
│   │   ├── __init__.py              # registers all routers
│   │   ├── setup.py                 # POST /setup (one-time wizard)
│   │   ├── settings.py              # PUT /settings (post-setup config changes)
│   │   ├── state.py                 # GET /state
│   │   ├── jobs.py                  # /jobs/* endpoints
│   │   └── checks.py               # /checks endpoints
│   └── services/
│       ├── databricks_client.py     # WorkspaceClient singleton + secrets
│       ├── databricks_sql.py        # SQL query via warehouse
│       ├── logger.py
│       └── jobs_service.py          # create/delete/run/status jobs logic
│
└── frontend/
    ├── astro.config.mjs
    ├── package.json
    └── src/
        ├── layouts/
        │   └── Layout.astro
        ├── pages/
        │   ├── index.astro          # Setup wizard (one-time, redirects after)
        │   ├── tools.astro          # Tools management
        │   ├── dashboard.astro      # Dashboard (placeholder)
        │   └── settings.astro       # Settings (post-setup configuration)
        ├── components/
        │   ├── SetupForm.tsx        # Multi-step setup wizard
        │   ├── Settings.tsx         # Settings editor
        │   ├── ToolsPage.tsx        # Tools listing page
        │   ├── ToolCard.tsx         # Per-tool install/run card
        │   ├── ComputeSelector.tsx  # Cluster type picker
        │   ├── Navigation.tsx       # Top nav bar
        │   └── Dashboard.tsx        # Placeholder dashboard component
        └── utils/
            └── api.ts               # fetch wrapper (get, post, put, delete)
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABRICKS_HOST` | Workspace URL |
| `DATABRICKS_CLIENT_ID` | OAuth service principal client ID |
| `DATABRICKS_CLIENT_SECRET` | OAuth service principal secret |
| `DATABRICKS_WAREHOUSE_ID` | SQL warehouse for check result queries |

In production (Databricks App), auth is handled via the app's service principal identity — no secrets needed in `app.yml` beyond the warehouse reference.

---

## Key Decisions & Constraints

1. **No external database** — all persistent state lives in Databricks Secrets and Delta tables in the customer's own catalog.
2. **Jobs are created by the app** — the app calls the Databricks Jobs API to create, run, and delete jobs. Job notebook paths must be agreed upon and pre-deployed.
3. **Add-ons are truly optional** — the app works without any add-on installed. Each add-on is independent.
4. **Single secret scope** — `sat-app` is always the scope name. Simplifies the model.
5. **One warehouse** — the app uses a single SQL warehouse (set via `DATABRICKS_WAREHOUSE_ID`) for all result queries.
6. **Compute is customer's choice** — the app must present a compute selector during tool installation (serverless, existing cluster ID, or new job cluster config).

---

## Open Items

- [ ] Checks config file — definitions to be imported (user will provide)
- [ ] Notebook/script paths for each job — where SAT notebooks are deployed in the workspace
- [ ] Dashboard design — what metrics/visuals to show (deferred)
- [ ] Job scheduling — whether users can configure recurring schedules from the app
- [ ] Multi-workspace support — out of scope for v1
- [ ] Role-based access — who can install vs. who can view results (deferred)
