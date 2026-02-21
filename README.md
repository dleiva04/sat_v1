# SAT v1

A web application for configuring and managing the Security Analysis Tool on Databricks workspaces.

## Technologies

- **FastAPI** — lightweight, high-performance Python web framework
- **Uvicorn** — ASGI server to run the app
- **Astro** — static-first frontend framework for the UI

## Getting Started

1. Install backend dependencies:
   ```bash
   uv sync
   ```

2. Install frontend dependencies and build:
   ```bash
   cd frontend && npm install && npm run build
   ```

3. Run the server:
   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. Open `http://localhost:8000` in your browser.

### Frontend Development

To iterate on the frontend with hot-reload:

```bash
cd frontend && npm run dev
```

The Astro dev server runs on `http://localhost:4321` and proxies API calls to the FastAPI backend on port 8000.
