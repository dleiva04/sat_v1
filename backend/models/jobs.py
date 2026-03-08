from enum import Enum
from typing import Optional
from pydantic import BaseModel


class ComputeType(str, Enum):
    SERVERLESS = "serverless"
    EXISTING_CLUSTER = "existing_cluster"
    JOB_CLUSTER = "job_cluster"


class ComputeConfig(BaseModel):
    compute_type: ComputeType = ComputeType.SERVERLESS
    cluster_id: Optional[str] = None
    node_type_id: Optional[str] = None
    num_workers: int = 1


class JobInstallRequest(BaseModel):
    compute: ComputeConfig = ComputeConfig()


class JobRunStatus(BaseModel):
    tool: str
    job_id: str
    job_url: str
    latest_run_id: Optional[str] = None
    status: Optional[str] = None
    result_state: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
