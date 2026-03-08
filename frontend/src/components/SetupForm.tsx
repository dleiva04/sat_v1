import { useEffect, useState, type FormEvent } from "react";
import { api } from "../utils/api";
import ComputeSelector, { type ComputeConfig } from "./ComputeSelector";
import styles from "./SetupForm.module.css";

const TOOLS = [
  {
    id: "sat",
    name: "SAT Core",
    description:
      "Core security checks — includes the Initializer and Driver jobs.",
  },
  {
    id: "permissions_analyzer",
    name: "Permissions Analyzer",
    description:
      "Scans entities and their permissions across the workspace.",
  },
  {
    id: "secret_scanner",
    name: "Secret Scanner",
    description:
      "Detects hardcoded secrets and credentials in notebooks.",
  },
];

const TOTAL_STEPS = 3;

export default function SetupForm() {
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);

  const [accountId, setAccountId] = useState("");
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");

  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [newSchemaMode, setNewSchemaMode] = useState(false);

  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const [compute, setCompute] = useState<ComputeConfig>({
    compute_type: "serverless",
  });

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api.get("/state");
      if (res.status === "ok" && res.data?.is_configured) {
        window.location.href = "/dashboard";
        return;
      }
      setChecking(false);
      setCatalogsLoading(true);
      const catRes = await api.get("/catalogs");
      if (catRes.status === "ok" && Array.isArray(catRes.data)) {
        setCatalogs(catRes.data);
      }
      setCatalogsLoading(false);
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

  function toggleTool(id: string) {
    setSelectedTools((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function canAdvance(): boolean {
    if (step === 1) return !!accountId && !!catalog && !!schema;
    if (step === 2) return selectedTools.length > 0;
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const result = await api.post("/setup", {
      databricks_account_id: accountId,
      catalog,
      schema,
      tools: selectedTools,
      compute,
    });

    if (result.status === "ok") {
      setFeedback({ ok: true, msg: "Setup complete! Redirecting…" });
      setTimeout(() => (window.location.href = "/settings"), 1200);
    } else {
      setFeedback({ ok: false, msg: result.message });
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className={styles.card}>
        <p className={styles.subtitle}>Checking configuration…</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Security Analysis Tool</h1>
      <p className={styles.subtitle}>Configure your workspace to get started.</p>

      <div className={styles.steps}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`${styles.step} ${s === step ? styles.stepActive : ""} ${s < step ? styles.stepDone : ""}`}
          >
            <span className={styles.stepNumber}>{s < step ? "✓" : s}</span>
            <span className={styles.stepLabel}>
              {s === 1 ? "Workspace" : s === 2 ? "Tools" : "Compute"}
            </span>
          </div>
        ))}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {step === 1 && (
          <>
            <label className={styles.label} htmlFor="account-id">
              Databricks Account ID
            </label>
            <input
              id="account-id"
              className={styles.input}
              type="text"
              required
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />

            <label className={styles.label} htmlFor="catalog">
              Catalog
            </label>
            {catalogs.length > 0 ? (
              <select
                id="catalog"
                className={styles.select}
                required
                value={catalog}
                onChange={(e) => {
                  setCatalog(e.target.value);
                  setSchema("");
                }}
              >
                <option value="" disabled>
                  {catalogsLoading ? "Loading catalogs…" : "Select a catalog"}
                </option>
                {catalogs.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                id="catalog"
                className={styles.input}
                type="text"
                required
                placeholder={catalogsLoading ? "Loading catalogs…" : "main"}
                value={catalog}
                onChange={(e) => {
                  setCatalog(e.target.value);
                  setSchema("");
                }}
              />
            )}

            <label className={styles.label} htmlFor="schema">
              Schema
            </label>
            {schemas.length > 0 && !newSchemaMode ? (
              <>
                <select
                  id="schema"
                  className={styles.select}
                  required
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
                    {schemasLoading ? "Loading schemas…" : "Select a schema"}
                  </option>
                  {schemas.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__new__">+ Create new schema</option>
                </select>
              </>
            ) : (
              <>
                <input
                  id="schema"
                  className={styles.input}
                  type="text"
                  required
                  placeholder="Enter new schema name"
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                  disabled={!catalog}
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
          </>
        )}

        {step === 2 && (
          <>
            <p className={styles.sectionHint}>
              Select the tools you want to install.
            </p>
            {TOOLS.map((t) => (
              <label key={t.id} className={styles.toolOption}>
                <input
                  type="checkbox"
                  checked={selectedTools.includes(t.id)}
                  onChange={() => toggleTool(t.id)}
                />
                <div className={styles.toolInfo}>
                  <span className={styles.toolName}>{t.name}</span>
                  <span className={styles.toolDesc}>{t.description}</span>
                </div>
              </label>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <p className={styles.sectionHint}>
              Choose the compute that will run your security jobs.
            </p>
            <ComputeSelector value={compute} onChange={setCompute} />
          </>
        )}

        <div className={styles.nav}>
          {step > 1 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnBack}`}
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
            >
              Back
            </button>
          )}

          {step < TOTAL_STEPS && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnNext}`}
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          )}

          {step === TOTAL_STEPS && (
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnSubmit}`}
              disabled={loading}
            >
              {loading ? "Installing…" : "Install SAT"}
            </button>
          )}
        </div>
      </form>

      {feedback && (
        <div
          className={`${styles.feedback} ${feedback.ok ? styles.success : styles.error}`}
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}
