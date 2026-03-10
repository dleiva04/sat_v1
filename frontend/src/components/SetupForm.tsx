"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Checkbox,
  Label,
  Select,
  TextInput,
  Alert,
} from "flowbite-react";
import { api } from "../utils/api";
import ComputeSelector, { type ComputeConfig } from "./ComputeSelector";

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

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Workspace", "Credentials", "Tools", "Compute"];

interface ProgressEntry {
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export default function SetupForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);

  const [accountId, setAccountId] = useState("");
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");

  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [newSchemaMode, setNewSchemaMode] = useState(true);

  const [cloudProvider, setCloudProvider] = useState("");
  const [useAppCreds, setUseAppCreds] = useState(true);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [useProxy, setUseProxy] = useState(false);
  const [httpProxy, setHttpProxy] = useState("");
  const [httpsProxy, setHttpsProxy] = useState("");

  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const [compute, setCompute] = useState<ComputeConfig>({
    compute_type: "serverless",
  });

  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([]);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api.get("/state");
      if (res.status === "ok" && res.data?.is_configured) {
        router.push("/dashboard");
        return;
      }
      if (res.data?.cloud_provider) {
        setCloudProvider(res.data.cloud_provider);
      }
      setChecking(false);
      setCatalogsLoading(true);
      const catRes = await api.get("/catalogs");
      if (catRes.status === "ok" && Array.isArray(catRes.data)) {
        setCatalogs(catRes.data);
      }
      setCatalogsLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!catalog) {
      setSchemas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSchemasLoading(true);
      const res = await api.get(
        `/catalogs/${encodeURIComponent(catalog)}/schemas`,
      );
      if (!cancelled && res.status === "ok" && Array.isArray(res.data)) {
        setSchemas(res.data);
      }
      if (!cancelled) setSchemasLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  function toggleTool(id: string) {
    setSelectedTools((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function canAdvance(): boolean {
    if (step === 1) return !!accountId && !!catalog && !!schema;
    if (step === 2) return useAppCreds || (!!clientId && !!clientSecret);
    if (step === 3) return selectedTools.length > 0;
    return true;
  }

  function buildProgressEntries(): ProgressEntry[] {
    const toolNames = selectedTools.map(
      (id) => TOOLS.find((t) => t.id === id)?.name || id,
    );
    return [
      { label: `Creating schema ${catalog}.${schema}`, status: "pending" },
      { label: "Configuring SAT credentials", status: "pending" },
      ...toolNames.map((name) => ({
        label: `Installing ${name}`,
        status: "pending" as const,
      })),
      { label: "Finalizing setup", status: "pending" },
    ];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const entries = buildProgressEntries();
    setProgressLog(entries);
    setInstalling(true);

    const advance = (idx: number) => {
      setProgressLog((prev) =>
        prev.map((entry, i) => {
          if (i < idx) return { ...entry, status: "done" };
          if (i === idx) return { ...entry, status: "running" };
          return entry;
        }),
      );
    };

    let delay = 0;
    for (let i = 0; i < entries.length - 1; i++) {
      delay += 600;
      setTimeout(() => advance(i), delay);
    }

    const result = await api.post("/setup", {
      databricks_account_id: accountId,
      catalog,
      schema,
      tools: selectedTools,
      compute,
      cloud_provider: cloudProvider,
      use_sp_auth: true,
      use_app_credentials: useAppCreds,
      ...(!useAppCreds && clientId && { client_id: clientId }),
      ...(!useAppCreds && clientSecret && { client_secret: clientSecret }),
      ...(subscriptionId && { subscription_id: subscriptionId }),
      ...(tenantId && { tenant_id: tenantId }),
      ...(useProxy && { http_proxy: httpProxy, https_proxy: httpsProxy }),
    });

    if (result.status === "ok") {
      setProgressLog((prev) =>
        prev.map((entry) => ({ ...entry, status: "done" })),
      );
      setFeedback({ ok: true, msg: "Setup complete! Redirecting…" });
      setTimeout(() => router.push("/dashboard"), 1500);
    } else {
      setProgressLog((prev) =>
        prev.map((entry) =>
          entry.status === "running"
            ? { ...entry, status: "error" }
            : entry,
        ),
      );
      setFeedback({ ok: false, msg: result.message });
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <Card className="w-full max-w-2xl">
        <p className="text-sm text-gray-500">Checking configuration…</p>
      </Card>
    );
  }

  if (installing) {
    return (
      <Card className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">
          Installing SAT
        </h1>
        <p className="text-sm text-gray-500">
          Setting up your workspace. This may take a few minutes.
        </p>

        <div className="mt-4 space-y-3">
          {progressLog.map((entry, i) => (
            <div key={i} className="flex items-center gap-3">
              {entry.status === "pending" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-400">
                  {i + 1}
                </span>
              )}
              {entry.status === "running" && (
                <span className="flex h-5 w-5 items-center justify-center">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </span>
              )}
              {entry.status === "done" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs text-green-700">
                  ✓
                </span>
              )}
              {entry.status === "error" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">
                  ✕
                </span>
              )}
              <span
                className={`text-sm ${
                  entry.status === "running"
                    ? "font-medium text-gray-900"
                    : entry.status === "done"
                      ? "text-gray-500"
                      : entry.status === "error"
                        ? "font-medium text-red-600"
                        : "text-gray-400"
                }`}
              >
                {entry.label}
              </span>
            </div>
          ))}
        </div>

        {feedback && (
          <Alert color={feedback.ok ? "success" : "failure"} className="mt-4">
            {feedback.msg}
          </Alert>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">
        Security Analysis Tool
      </h1>
      <p className="text-sm text-gray-500">
        Configure your workspace to get started.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-3 py-2">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  s < step
                    ? "bg-green-100 text-green-700"
                    : s === step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {s < step ? "✓" : s}
              </span>
              <span
                className={`text-sm font-medium ${
                  s === step ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {label}
              </span>
              {s < TOTAL_STEPS && (
                <div className="ml-1 h-px w-6 bg-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Step 1: Workspace */}
        {step === 1 && (
          <>
            <div>
              <Label htmlFor="account-id" className="mb-2 block">
                Databricks Account ID
              </Label>
              <TextInput
                id="account-id"
                type="text"
                required
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="catalog" className="mb-2 block">
                Catalog
              </Label>
              {catalogs.length > 0 ? (
                <Select
                  id="catalog"
                  required
                  value={catalog}
                  onChange={(e) => {
                    setCatalog(e.target.value);
                    setSchema("");
                  }}
                >
                  <option value="" disabled>
                    {catalogsLoading
                      ? "Loading catalogs…"
                      : "Select a catalog"}
                  </option>
                  {catalogs.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  id="catalog"
                  type="text"
                  required
                  placeholder={
                    catalogsLoading ? "Loading catalogs…" : "main"
                  }
                  value={catalog}
                  onChange={(e) => {
                    setCatalog(e.target.value);
                    setSchema("");
                  }}
                />
              )}
            </div>

            <div>
              <Label htmlFor="schema" className="mb-2 block">
                Schema
              </Label>
              {schemas.length > 0 && !newSchemaMode ? (
                <Select
                  id="schema"
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
                    {schemasLoading
                      ? "Loading schemas…"
                      : "Select a schema"}
                  </option>
                  {schemas.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__new__">+ Create new schema</option>
                </Select>
              ) : (
                <>
                  <TextInput
                    id="schema"
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
                      className="mt-1 text-sm text-blue-600 hover:underline"
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
          </>
        )}

        {/* Step 2: SAT Credentials */}
        {step === 2 && (
          <>
            <p className="text-sm text-gray-500">
              Service Principal credentials used by SAT to connect to your
              workspace and account.
            </p>

            <div>
              <Label className="mb-2 block">Cloud Provider</Label>
              <p className="text-sm font-medium text-gray-900">
                {cloudProvider === "azure" ? "Azure" : cloudProvider === "gcp" ? "GCP" : "AWS"}
                <span className="ml-2 text-xs font-normal text-gray-400">(auto-detected)</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="use-app-creds"
                checked={useAppCreds}
                onChange={() => {
                  setUseAppCreds((v) => !v);
                  if (!useAppCreds) {
                    setClientId("");
                    setClientSecret("");
                  }
                }}
              />
              <Label htmlFor="use-app-creds">
                Use Client ID and Client Secret from app environment
              </Label>
            </div>

            {!useAppCreds && (
              <>
                <div>
                  <Label htmlFor="client-id" className="mb-2 block">
                    Client ID
                  </Label>
                  <TextInput
                    id="client-id"
                    type="text"
                    required
                    placeholder="Application (Client) ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="client-secret" className="mb-2 block">
                    Client Secret
                  </Label>
                  <TextInput
                    id="client-secret"
                    type="password"
                    required
                    placeholder="OAuth secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
              </>
            )}

            {cloudProvider === "azure" && (
              <>
                <div>
                  <Label htmlFor="subscription-id" className="mb-2 block">
                    Subscription ID
                  </Label>
                  <TextInput
                    id="subscription-id"
                    type="text"
                    placeholder="Azure Subscription ID"
                    value={subscriptionId}
                    onChange={(e) => setSubscriptionId(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-id" className="mb-2 block">
                    Tenant ID
                  </Label>
                  <TextInput
                    id="tenant-id"
                    type="text"
                    placeholder="Azure AD Tenant ID"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-3">
              <Checkbox
                id="use-proxy"
                checked={useProxy}
                onChange={() => setUseProxy((v) => !v)}
              />
              <Label htmlFor="use-proxy">
                Use proxy for outbound connections
              </Label>
            </div>

            {useProxy && (
              <>
                <div>
                  <Label htmlFor="http-proxy" className="mb-2 block">
                    HTTP Proxy
                  </Label>
                  <TextInput
                    id="http-proxy"
                    type="text"
                    placeholder="http://proxy-host:port"
                    value={httpProxy}
                    onChange={(e) => setHttpProxy(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="https-proxy" className="mb-2 block">
                    HTTPS Proxy
                  </Label>
                  <TextInput
                    id="https-proxy"
                    type="text"
                    placeholder="https://proxy-host:port"
                    value={httpsProxy}
                    onChange={(e) => setHttpsProxy(e.target.value)}
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Step 3: Tools */}
        {step === 3 && (
          <>
            <p className="text-sm text-gray-500">
              Select the tools you want to install.
            </p>
            {TOOLS.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedTools.includes(t.id)}
                  onChange={() => toggleTool(t.id)}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-sm font-semibold text-gray-900">
                    {t.name}
                  </span>
                  <span className="block text-sm text-gray-500">
                    {t.description}
                  </span>
                </div>
              </label>
            ))}
          </>
        )}

        {/* Step 4: Compute */}
        {step === 4 && (
          <>
            <p className="text-sm text-gray-500">
              Choose the compute that will run your security jobs.
            </p>
            <ComputeSelector value={compute} onChange={setCompute} />
          </>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {step > 1 && (
            <Button
              color="light"
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
            >
              Back
            </Button>
          )}

          {step < TOTAL_STEPS && (
            <Button
              color="blue"
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          )}

          {step === TOTAL_STEPS && (
            <Button type="submit" color="blue" disabled={loading}>
              {loading ? "Installing…" : "Install SAT"}
            </Button>
          )}
        </div>
      </form>

      {feedback && (
        <Alert color={feedback.ok ? "success" : "failure"}>
          {feedback.msg}
        </Alert>
      )}
    </Card>
  );
}
