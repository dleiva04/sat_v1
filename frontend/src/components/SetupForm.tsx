import { useState, type FormEvent } from "react";
import { api } from "../utils/api";
import styles from "./SetupForm.module.css";

export default function SetupForm() {
  const [accountId, setAccountId] = useState("");
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const result = await api.post("/setup", {
      databricks_account_id: accountId,
      catalog,
      schema,
    });

    setFeedback({
      ok: result.status === "ok",
      msg: result.message,
    });
    setLoading(false);
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Security Analysis Tool</h1>
      <p className={styles.subtitle}>Configure your workspace to get started.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
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
        <input
          id="catalog"
          className={styles.input}
          type="text"
          required
          placeholder="main"
          value={catalog}
          onChange={(e) => setCatalog(e.target.value)}
        />

        <label className={styles.label} htmlFor="schema">
          Schema
        </label>
        <input
          id="schema"
          className={styles.input}
          type="text"
          required
          placeholder="sat"
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
        />

        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Installing…" : "Install SAT"}
        </button>
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
