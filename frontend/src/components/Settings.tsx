import { useEffect, useState } from "react";
import { api } from "../utils/api";
import ComputeSelector, { type ComputeConfig } from "./ComputeSelector";
import styles from "./Settings.module.css";

const ALL_TOOLS = [
  {
    id: "sat",
    name: "SAT Core",
    description: "Core security checks — Initializer and Driver jobs.",
  },
  {
    id: "permissions_analyzer",
    name: "Permissions Analyzer",
    description: "Scans entities and their permissions across the workspace.",
  },
  {
    id: "secret_scanner",
    name: "Secret Scanner",
    description: "Detects hardcoded secrets and credentials in notebooks.",
  },
];

interface State {
  databricks_account_id: string;
  catalog: string;
  schema_name: string;
  compute_type: string;
  cluster_id: string;
  node_type_id: string;
  num_workers: number;
  installed_tools: string[];
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  const [accountId, setAccountId] = useState("");
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");
  const [compute, setCompute] = useState<ComputeConfig>({
    compute_type: "serverless",
  });
  const [installedTools, setInstalledTools] = useState<string[]>([]);

  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [newSchemaMode, setNewSchemaMode] = useState(false);

  const [toolBusy, setToolBusy] = useState<Record<string, boolean>>({});
  const [toolStatus, setToolStatus] = useState<Record<string, string>>({});
  const [toolFeedback, setToolFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function loadState() {
    const res = await api.get("/state");
    if (res.status !== "ok" || !res.data?.is_configured) {
      window.location.href = "/";
      return;
    }
    const d = res.data as State;
    setAccountId(d.databricks_account_id);
    setCatalog(d.catalog);
    setSchema(d.schema_name);
    setCompute({
      compute_type: (d.compute_type || "serverless") as ComputeConfig["compute_type"],
      cluster_id: d.cluster_id || undefined,
      node_type_id: d.node_type_id || undefined,
      num_workers: d.num_workers || 1,
    });
    setInstalledTools(d.installed_tools || []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await loadState();
      const catRes = await api.get("/catalogs");
      if (catRes.status === "ok" && Array.isArray(catRes.data)) {
        setCatalogs(catRes.data);
      }
    })();
  }, []);

  useEffect(() => {
    if (!catalog) {
      setSchemas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSchemasLoading(true);
      const res = await api.get(`/catalogs/${encodeURIComponent(catalog)}/schemas`);
      if (!cancelled && res.status === "ok" && Array.isArray(res.data)) {
        setSchemas(res.data);
      }
      if (!cancelled) setSchemasLoading(false);
    })();
    return () => { cancelled = true; };
  }, [catalog]);

  async function handleInstall(toolId: string) {
    setToolBusy((prev) => ({ ...prev, [toolId]: true }));
    setToolFeedback((prev) => { const n = { ...prev }; delete n[toolId]; return n; });
    const res = await api.post(`/jobs/install/${toolId}`, { compute });
    setToolFeedback((prev) => ({
      ...prev,
      [toolId]: { ok: res.status === "ok", msg: res.message },
    }));
    setToolBusy((prev) => ({ ...prev, [toolId]: false }));
    if (res.status === "ok") {
      const stateRes = await api.get("/state");
      if (stateRes.status === "ok" && stateRes.data) {
        setInstalledTools(stateRes.data.installed_tools || []);
      }
    }
  }

  async function handleUninstall(toolId: string) {
    setToolBusy((prev) => ({ ...prev, [toolId]: true }));
    setToolFeedback((prev) => { const n = { ...prev }; delete n[toolId]; return n; });
    const res = await api.delete(`/jobs/uninstall/${toolId}`);
    setToolFeedback((prev) => ({
      ...prev,
      [toolId]: { ok: res.status === "ok", msg: res.message },
    }));
    setToolBusy((prev) => ({ ...prev, [toolId]: false }));
    if (res.status === "ok") {
      setToolStatus((prev) => { const n = { ...prev }; delete n[toolId]; return n; });
      const stateRes = await api.get("/state");
      if (stateRes.status === "ok" && stateRes.data) {
        setInstalledTools(stateRes.data.installed_tools || []);
      }
    }
  }

  async function handleRun(toolId: string) {
    setToolBusy((prev) => ({ ...prev, [toolId]: true }));
    setToolFeedback((prev) => { const n = { ...prev }; delete n[toolId]; return n; });
    const res = await api.post(`/jobs/run/${toolId}`, {});
    setToolFeedback((prev) => ({
      ...prev,
      [toolId]: { ok: res.status === "ok", msg: res.message },
    }));
    setToolBusy((prev) => ({ ...prev, [toolId]: false }));
  }

  async function fetchToolStatus(toolId: string) {
    const res = await api.get(`/jobs/status/${toolId}`);
    if (res.status === "ok" && Array.isArray(res.data) && res.data.length) {
      const hasDeleted = res.data.some(
        (s: { status?: string }) => s.status === "deleted",
      );
      if (hasDeleted) {
        setToolStatus((prev) => ({ ...prev, [toolId]: "DELETED" }));
        setToolFeedback((prev) => ({
          ...prev,
          [toolId]: { ok: false, msg: "Job was deleted externally. Uninstall and reinstall to fix." },
        }));
        return;
      }
      const latest = res.data[0];
      setToolStatus((prev) => ({
        ...prev,
        [toolId]: latest.result_state || latest.status || "UNKNOWN",
      }));
    }
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);

    const body: Record<string, unknown> = {
      databricks_account_id: accountId,
      catalog,
      schema,
      compute,
    };

    const res = await api.put("/settings", body);
    setFeedback({
      ok: res.status === "ok",
      msg: res.message,
    });
    setSaving(false);
  }

  if (loading) {
    return <div className={styles.loadingWrapper}>Loading settings…</div>;
  }

  const installed = ALL_TOOLS.filter((t) => installedTools.includes(t.id));
  const notInstalled = ALL_TOOLS.filter((t) => !installedTools.includes(t.id));

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          Update your SAT configuration. Changes take effect immediately.
        </p>
      </div>

      {/* Workspace section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7h-9" /><path d="M14 17H5" />
              <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
            </svg>
          </span>
          <h2 className={styles.cardTitle}>Workspace</h2>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="s-account-id">
              Databricks Account ID
            </label>
            <input
              id="s-account-id"
              className={styles.input}
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="s-catalog">
                Catalog
              </label>
              {catalogs.length > 0 ? (
                <select
                  id="s-catalog"
                  className={styles.select}
                  value={catalog}
                  onChange={(e) => {
                    setCatalog(e.target.value);
                    setSchema("");
                  }}
                >
                  <option value="" disabled>Select a catalog</option>
                  {catalogs.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="s-catalog"
                  className={styles.input}
                  type="text"
                  value={catalog}
                  onChange={(e) => {
                    setCatalog(e.target.value);
                    setSchema("");
                  }}
                />
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="s-schema">
                Schema
              </label>
              {schemas.length > 0 && !newSchemaMode ? (
                <select
                  id="s-schema"
                  className={styles.select}
                  value={schema}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setNewSchemaMode(true);
                      setSchema("");
                    } else {
                      setSchema(e.target.value);
                    }
                  }}
                >
                  <option value="" disabled>
                    {schemasLoading ? "Loading…" : "Select a schema"}
                  </option>
                  {schemas.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__new__">+ Create new schema</option>
                </select>
              ) : (
                <>
                  <input
                    id="s-schema"
                    className={styles.input}
                    type="text"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    disabled={!catalog}
                    placeholder="Enter new schema name"
                  />
                  {schemas.length > 0 && (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        setNewSchemaMode(false);
                        setSchema("");
                      }}
                    >
                      Choose existing schema instead
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tools section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <h2 className={styles.cardTitle}>Tools</h2>
        </div>
        <div className={styles.cardBody}>
          {installed.map((t) => (
            <div key={t.id} className={styles.toolRow}>
              <div className={styles.toolInfo}>
                <span className={styles.toolName}>
                  {t.name}
                  <span className={`${styles.toolBadge} ${styles.badgeInstalled}`}>Installed</span>
                </span>
                <span className={styles.toolDesc}>{t.description}</span>
              </div>
              <div className={styles.toolActions}>
                <button
                  className={styles.btnTool}
                  disabled={toolBusy[t.id]}
                  onClick={() => handleRun(t.id)}
                >
                  {toolBusy[t.id] ? "Running…" : "Run Now"}
                </button>
                <button
                  className={styles.btnToolSecondary}
                  onClick={() => fetchToolStatus(t.id)}
                >
                  Refresh Status
                </button>
                <button
                  className={styles.btnUninstall}
                  disabled={toolBusy[t.id]}
                  onClick={() => handleUninstall(t.id)}
                >
                  Uninstall
                </button>
                {toolStatus[t.id] && (
                  <span className={`${styles.toolStatusBadge} ${
                    toolStatus[t.id] === "SUCCESS" ? styles.statusSuccess
                      : toolStatus[t.id] === "RUNNING" ? styles.statusRunning
                      : toolStatus[t.id] === "FAILED" || toolStatus[t.id] === "DELETED" ? styles.statusFailed
                      : ""
                  }`}>
                    {toolStatus[t.id]}
                  </span>
                )}
                {toolFeedback[t.id] && (
                  <span className={toolFeedback[t.id].ok ? styles.toolFeedbackOk : styles.toolFeedbackErr}>
                    {toolFeedback[t.id].msg}
                  </span>
                )}
              </div>
            </div>
          ))}

          {installed.length > 0 && notInstalled.length > 0 && (
            <div className={styles.toolDivider} />
          )}

          {notInstalled.map((t) => (
            <div key={t.id} className={styles.toolRowDisabled}>
              <div className={styles.toolInfo}>
                <span className={styles.toolName}>
                  {t.name}
                  <span className={`${styles.toolBadge} ${styles.badgeNotInstalled}`}>Not installed</span>
                </span>
                <span className={styles.toolDesc}>{t.description}</span>
              </div>
              <div className={styles.toolActions}>
                <button
                  className={styles.btnInstall}
                  disabled={toolBusy[t.id]}
                  onClick={() => handleInstall(t.id)}
                >
                  {toolBusy[t.id] ? "Installing…" : "Install"}
                </button>
                {toolFeedback[t.id] && (
                  <span className={toolFeedback[t.id].ok ? styles.toolFeedbackOk : styles.toolFeedbackErr}>
                    {toolFeedback[t.id].msg}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compute section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </span>
          <h2 className={styles.cardTitle}>Compute</h2>
        </div>
        <div className={styles.cardBody}>
          <ComputeSelector value={compute} onChange={setCompute} />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={styles.btnSave}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>

        {feedback && (
          <div
            className={`${styles.feedback} ${feedback.ok ? styles.success : styles.error}`}
          >
            {feedback.msg}
          </div>
        )}
      </div>
    </div>
  );
}
