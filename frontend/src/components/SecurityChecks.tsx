import { useEffect, useState } from "react";
import { api } from "../utils/api";
import styles from "./SecurityChecks.module.css";

export default function SecurityChecks() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get("/state").then((res) => {
      if (res.status !== "ok" || !res.data?.is_configured) {
        window.location.href = "/";
        return;
      }
      setReady(true);
    });
  }, []);

  if (!ready) {
    return <div className={styles.wrapper}><p style={{ color: "#6b7280" }}>Loading…</p></div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Security Checks</h1>
        <p className={styles.subtitle}>
          Enable or disable individual security checks based on your needs.
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.emptyState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <h2 className={styles.emptyTitle}>Check Management Coming Soon</h2>
          <p className={styles.emptyText}>
            You will be able to enable, disable, and configure individual
            security checks from this page.
          </p>
        </div>
      </div>
    </div>
  );
}
