import { useEffect, useState } from "react";
import { api } from "../utils/api";
import styles from "./Dashboard.module.css";

function EmptyState({ message }: { message: string }) {
  return (
    <div className={styles.emptyState}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <p>{message}</p>
    </div>
  );
}

const SEVERITY_LEVELS = [
  { label: "Critical", color: "#DC2626" },
  { label: "High", color: "#F97316" },
  { label: "Medium", color: "#EAB308" },
  { label: "Low", color: "#3B82F6" },
  { label: "Informative", color: "#14B8A6" },
];

const TOOLS = [
  { name: "SAT Core", status: "Not run yet" },
  { name: "Permissions Analyzer", status: "Not run yet" },
  { name: "Secret Scanner", status: "Not run yet" },
];

export default function Dashboard() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

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
    if (error) {
      return <div className={styles.wrapper}><p style={{ color: "#DC2626" }}>{error}</p></div>;
    }
    return <div className={styles.wrapper}><p style={{ color: "#6b7280" }}>Loading…</p></div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Overview</h1>
        <p className={styles.subtitle}>
          Security posture and check results across all tools.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Check Results by Severity</h2>
            <span className={styles.cardBadge}>Last 7 days</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.legend}>
              {SEVERITY_LEVELS.map((s) => (
                <span key={s.label} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
            <EmptyState message="No check results yet. Run a tool to see severity breakdown." />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Latest Check Results</h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.tableHeader}>
              <span>Tool</span>
              <span>Check</span>
              <span>Severity</span>
            </div>
            <EmptyState message="No results to display. Checks will appear here after a tool run." />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Checks by Tool</h2>
            <span className={styles.cardHint}>Installed tools and last run status</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.tableHeader}>
              <span>Tool</span>
              <span>Status</span>
            </div>
            {TOOLS.map((t) => (
              <div key={t.name} className={styles.tableRow}>
                <span className={styles.toolName}>{t.name}</span>
                <span className={styles.toolStatus}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Failed Checks Summary</h2>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.tableHeader}>
              <span>Check</span>
              <span>Resource</span>
              <span>Severity</span>
            </div>
            <EmptyState message="No failed checks. Run security tools to populate this view." />
          </div>
        </div>
      </div>
    </div>
  );
}
