from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from backend.models.jobs import ComputeConfig


class ToolType(str, Enum):
    SAT = "sat"
    PERMISSIONS_ANALYZER = "permissions_analyzer"
    SECRET_SCANNER = "secret_scanner"


class SetupRequest(BaseModel):
    databricks_account_id: str
    catalog: str
    schema_name: str = Field(alias="schema")
    tools: List[ToolType] = []
    compute: ComputeConfig = ComputeConfig()


class SettingsUpdateRequest(BaseModel):
    databricks_account_id: Optional[str] = None
    catalog: Optional[str] = None
    schema_name: Optional[str] = Field(default=None, alias="schema")
    compute: Optional[ComputeConfig] = None
    tools_to_install: Optional[List[ToolType]] = None
    tools_to_uninstall: Optional[List[ToolType]] = None


class SATState(BaseModel):
    is_configured: bool = False
    databricks_account_id: str = ""
    catalog: str = ""
    schema_name: str = ""
    installed_tools: List[ToolType] = []
    available_tools: List[ToolType] = [
        ToolType.SAT,
        ToolType.PERMISSIONS_ANALYZER,
        ToolType.SECRET_SCANNER,
    ]
    compute_type: str = "serverless"
    cluster_id: str = ""
    node_type_id: str = ""
    num_workers: int = 1
    sat_initializer_job_id: str = ""
    sat_initializer_job_url: str = ""
    sat_driver_job_id: str = ""
    sat_driver_job_url: str = ""
    permissions_analyzer_job_id: str = ""
    permissions_analyzer_job_url: str = ""
    secret_scanner_job_id: str = ""
    secret_scanner_job_url: str = ""
