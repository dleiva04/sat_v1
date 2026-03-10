"use client";

import { Label, Select, TextInput } from "flowbite-react";

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
    <div className="space-y-4">
      <div>
        <Label htmlFor="compute-type" className="mb-2 block">
          Compute Type
        </Label>
        <Select
          id="compute-type"
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
        </Select>
      </div>

      {value.compute_type === "existing_cluster" && (
        <div>
          <Label htmlFor="cluster-id" className="mb-2 block">
            Cluster ID
          </Label>
          <TextInput
            id="cluster-id"
            type="text"
            placeholder="0123-456789-abcdefgh"
            value={value.cluster_id || ""}
            onChange={(e) => onChange({ ...value, cluster_id: e.target.value })}
          />
        </div>
      )}

      {value.compute_type === "job_cluster" && (
        <>
          <div>
            <Label htmlFor="node-type" className="mb-2 block">
              Node Type
            </Label>
            <TextInput
              id="node-type"
              type="text"
              placeholder="i3.xlarge"
              value={value.node_type_id || ""}
              onChange={(e) =>
                onChange({ ...value, node_type_id: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="max-workers" className="mb-2 block">
              Max Workers
            </Label>
            <TextInput
              id="max-workers"
              type="number"
              min={1}
              max={100}
              value={value.num_workers ?? 1}
              onChange={(e) =>
                onChange({
                  ...value,
                  num_workers: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
