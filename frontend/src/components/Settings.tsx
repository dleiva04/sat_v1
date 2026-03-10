"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  Label,
  Select,
  TextInput,
} from "flowbite-react";
import { api } from "../utils/api";
import ComputeSelector, { type ComputeConfig } from "./ComputeSelector";
import { SlidersIcon, ShieldCheckIcon, ServerIcon, ChevronDownIcon } from "./icons";

interface ToolDef {
  id: string;
  name: string;
  description: string;
  subjobs?: { key: string; label: string }[];
}

const ALL_TOOLS: ToolDef[] = [
  {
    id: "sat",
    name: "SAT Core",
    description: "Core security checks — Initializer and Driver jobs.",
    subjobs: [
      { key: "initializer", label: "Initializer" },
      { key: "driver", label: "Driver" },
    ],
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

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

  const [workspaceEditing, setWorkspaceEditing] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [toolBusy, setToolBusy] = useState<Record<string, boolean>>({});
  const [toolStatus, setToolStatus] = useState<Record<string, string>>({});
  const [toolJobUrls, setToolJobUrls] = useState<Record<string, Record<string, string>>>({});
  const [toolFeedback, setToolFeedback] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});

  useEffect(() => {
    (async () => {
      const stateRes = await api.get("/state");
      if (stateRes.status !== "ok" || !stateRes.data?.is_configured) {
        router.push("/");
        return;
      }
      const d = stateRes.data as State;
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

      const catRes = await api.get("/catalogs");
      if (catRes.status === "ok" && Array.isArray(catRes.data)) {
        setCatalogs(catRes.data);
      }

      for (const toolId of d.installed_tools || []) {
        fetchToolStatus(toolId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleInstall(toolId: string) {
    setToolBusy((prev) => ({ ...prev, [toolId]: true }));
    setToolFeedback((prev) => {
      const n = { ...prev };
      delete n[toolId];
      return n;
    });
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
    setToolFeedback((prev) => {
      const n = { ...prev };
      delete n[toolId];
      return n;
    });
    const res = await api.delete(`/jobs/uninstall/${toolId}`);
    setToolFeedback((prev) => ({
      ...prev,
      [toolId]: { ok: res.status === "ok", msg: res.message },
    }));
    setToolBusy((prev) => ({ ...prev, [toolId]: false }));
    if (res.status === "ok") {
      setToolStatus((prev) => {
        const n = { ...prev };
        delete n[toolId];
        return n;
      });
      const stateRes = await api.get("/state");
      if (stateRes.status === "ok" && stateRes.data) {
        setInstalledTools(stateRes.data.installed_tools || []);
      }
    }
  }

  async function handleRun(toolId: string) {
    setToolBusy((prev) => ({ ...prev, [toolId]: true }));
    setToolFeedback((prev) => {
      const n = { ...prev };
      delete n[toolId];
      return n;
    });
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
          [toolId]: {
            ok: false,
            msg: "Job was deleted externally. Uninstall and reinstall to fix.",
          },
        }));
        return;
      }

      const urls: Record<string, string> = {};
      for (const entry of res.data) {
        if (entry.job_url && entry.tool) {
          const taskName = (entry.tool as string).replace(`${toolId}_`, "");
          urls[taskName] = entry.job_url;
        }
      }
      if (Object.keys(urls).length > 0) {
        setToolJobUrls((prev) => ({ ...prev, [toolId]: urls }));
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
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading settings…
      </div>
    );
  }

  const installed = ALL_TOOLS.filter((t) => installedTools.includes(t.id));
  const notInstalled = ALL_TOOLS.filter((t) => !installedTools.includes(t.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          Update your SAT configuration. Changes take effect immediately.
        </p>
      </div>

      {/* Tools */}
      <Card>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon />
          <h2 className="text-lg font-semibold text-gray-900">Tools</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {installed.map((t) => {
            const urls = toolJobUrls[t.id] || {};
            const subjobs = t.subjobs;

            return (
              <div key={t.id} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    {t.name}
                    <Badge color="success" size="xs">Installed</Badge>
                  </span>
                  <span className="text-sm text-gray-500">{t.description}</span>
                  {toolFeedback[t.id] && (
                    <span
                      className={`ml-2 text-xs ${toolFeedback[t.id].ok ? "text-green-600" : "text-red-600"}`}
                    >
                      {toolFeedback[t.id].msg}
                    </span>
                  )}
                </div>

                {subjobs ? (
                  <div className="mt-3 space-y-2">
                    {subjobs.map((sj) => (
                      <div
                        key={sj.key}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2"
                      >
                        <span className="text-sm font-medium text-gray-700">{sj.label}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            color="blue"
                            disabled={toolBusy[t.id]}
                            onClick={() => handleRun(t.id)}
                          >
                            {toolBusy[t.id] ? "Running…" : "Run Now"}
                          </Button>
                          <Button
                            size="xs"
                            color="light"
                            disabled={!urls[sj.key]}
                            onClick={() => urls[sj.key] && window.open(urls[sj.key], "_blank")}
                          >
                            View Job
                          </Button>
                          <Button
                            size="xs"
                            color="failure"
                            className="border border-gray-900"
                            disabled={toolBusy[t.id]}
                            onClick={() => handleUninstall(t.id)}
                          >
                            Uninstall
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="xs"
                      color="blue"
                      disabled={toolBusy[t.id]}
                      onClick={() => handleRun(t.id)}
                    >
                      {toolBusy[t.id] ? "Running…" : "Run Now"}
                    </Button>
                    <Button
                      size="xs"
                      color="light"
                      disabled={!Object.values(urls)[0]}
                      onClick={() => {
                        const url = Object.values(urls)[0];
                        if (url) window.open(url, "_blank");
                      }}
                    >
                      View Job
                    </Button>
                    <Button
                      size="xs"
                      color="failure"
                      className="border border-gray-900"
                      disabled={toolBusy[t.id]}
                      onClick={() => handleUninstall(t.id)}
                    >
                      Uninstall
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {installed.length > 0 && notInstalled.length > 0 && (
            <div className="py-0" />
          )}

          {notInstalled.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 py-4 opacity-70 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {t.name}
                  <Badge color="gray" size="xs">Not installed</Badge>
                </span>
                <span className="text-sm text-gray-500">{t.description}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="xs"
                  color="blue"
                  disabled={toolBusy[t.id]}
                  onClick={() => handleInstall(t.id)}
                >
                  {toolBusy[t.id] ? "Installing…" : "Install"}
                </Button>
                {toolFeedback[t.id] && (
                  <span
                    className={`text-xs ${toolFeedback[t.id].ok ? "text-green-600" : "text-red-600"}`}
                  >
                    {toolFeedback[t.id].msg}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Workspace */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersIcon />
            <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
          </div>
          <Button
            size="xs"
            color={workspaceEditing ? "light" : "blue"}
            onClick={() => setWorkspaceEditing((v) => !v)}
          >
            {workspaceEditing ? "Cancel" : "Edit"}
          </Button>
        </div>

        <div className={`space-y-4 ${workspaceEditing ? "" : "pointer-events-none opacity-50"}`}>
          <div>
            <Label htmlFor="s-account-id" className="mb-2 block">
              Databricks Account ID
            </Label>
            <TextInput
              id="s-account-id"
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!workspaceEditing}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-catalog" className="mb-2 block">
                Catalog
              </Label>
              {catalogs.length > 0 ? (
                <Select
                  id="s-catalog"
                  value={catalog}
                  disabled={!workspaceEditing}
                  onChange={(e) => {
                    setCatalog(e.target.value);
                    setSchema("");
                  }}
                >
                  <option value="" disabled>
                    Select a catalog
                  </option>
                  {catalogs.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  id="s-catalog"
                  type="text"
                  value={catalog}
                  disabled={!workspaceEditing}
                  onChange={(e) => {
                    setCatalog(e.target.value);
                    setSchema("");
                  }}
                />
              )}
            </div>

            <div>
              <Label htmlFor="s-schema" className="mb-2 block">
                Schema
              </Label>
              {schemas.length > 0 && !newSchemaMode ? (
                <Select
                  id="s-schema"
                  value={schema}
                  disabled={!workspaceEditing}
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
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__new__">+ Create new schema</option>
                </Select>
              ) : (
                <>
                  <TextInput
                    id="s-schema"
                    type="text"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    disabled={!workspaceEditing || !catalog}
                    placeholder="Enter new schema name"
                  />
                  {schemas.length > 0 && workspaceEditing && (
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
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <ServerIcon />
              <h3 className="text-sm font-semibold text-gray-900">Compute</h3>
            </div>
            <ComputeSelector value={compute} onChange={setCompute} />
          </div>
        </div>

        {workspaceEditing && (
          <div className="flex items-center gap-4 border-t border-gray-200 pt-4">
            <Button color="blue" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>

            {feedback && (
              <Alert color={feedback.ok ? "success" : "failure"} className="flex-1">
                {feedback.msg}
              </Alert>
            )}
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      <div className="mt-8 rounded-lg border-2 border-red-300 bg-red-50">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3"
          onClick={() => setDangerOpen((o) => !o)}
        >
          <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
          <ChevronDownIcon
            className={`text-red-400 transition-transform duration-200 ${dangerOpen ? "rotate-180" : ""}`}
          />
        </button>
        {dangerOpen && <div className="space-y-4 border-t border-red-200 px-5 py-4">
          <Alert color="warning">
            This action will be executed using your user permissions. Make sure
            you have the necessary privileges to delete jobs, schemas, and
            secret scopes in this workspace.
          </Alert>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Delete SAT</p>
              <p className="text-sm text-gray-500">
                Permanently remove all SAT jobs, the data schema, and both
                secret scopes. This action cannot be undone.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="delete-confirm" className="mb-2 block text-sm text-gray-600">
              Type <span className="font-mono font-semibold text-red-600">delete sat</span> to confirm
            </Label>
            <TextInput
              id="delete-confirm"
              type="text"
              placeholder="delete sat"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>

          <Button
            color="failure"
            className="border border-gray-900"
            disabled={deleteConfirm !== "delete sat" || deleting}
            onClick={async () => {
              setDeleting(true);
              const res = await api.delete("/setup");
              if (res.status === "ok") {
                router.push("/");
              } else {
                setFeedback({ ok: false, msg: res.message });
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting…" : "Delete SAT"}
          </Button>
        </div>}
      </div>
    </div>
  );
}
