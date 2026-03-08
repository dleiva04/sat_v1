import styles from "./ComputeSelector.module.css";

export interface ComputeConfig {
  compute_type: "serverless" | "existing_cluster" | "job_cluster";
  cluster_id?: string;
  node_type_id?: string;
  num_workers?: number;
}

interface Props {
  value: ComputeConfig;
  onChange: (config: ComputeConfig) => void;
}

export default function ComputeSelector({ value, onChange }: Props) {
  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>Compute Type</label>
      <select
        className={styles.select}
        value={value.compute_type}
        onChange={(e) =>
          onChange({
            ...value,
            compute_type: e.target.value as ComputeConfig["compute_type"],
          })
        }
      >
        <option value="serverless">Serverless</option>
        <option value="existing_cluster">Existing Cluster</option>
        <option value="job_cluster">Job Cluster</option>
      </select>

      {value.compute_type === "existing_cluster" && (
        <>
          <label className={styles.label}>Cluster ID</label>
          <input
            className={styles.input}
            type="text"
            placeholder="0123-456789-abcdefgh"
            value={value.cluster_id || ""}
            onChange={(e) => onChange({ ...value, cluster_id: e.target.value })}
          />
        </>
      )}

      {value.compute_type === "job_cluster" && (
        <>
          <label className={styles.label}>Node Type</label>
          <input
            className={styles.input}
            type="text"
            placeholder="i3.xlarge"
            value={value.node_type_id || ""}
            onChange={(e) => onChange({ ...value, node_type_id: e.target.value })}
          />
          <label className={styles.label}>Max Workers</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={100}
            value={value.num_workers ?? 1}
            onChange={(e) =>
              onChange({ ...value, num_workers: parseInt(e.target.value) || 1 })
            }
          />
        </>
      )}
    </div>
  );
}
