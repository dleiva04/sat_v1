from enum import Enum
from typing import List
from pydantic import BaseModel, Field

class ToolType(str, Enum):
    SAT = "sat"
    PERMISSIONS_ANALYZER = "permissions_analyzer"
    SECRET_SCANNER = "secret_scanner"

class SetupRequest(BaseModel):
    databricks_account_id: str
    catalog: str
    schema_name: str = Field(alias="schema")

class SATState(BaseModel):
    databricks_account_id: str
    installed_tools: List[ToolType] = []
    available_tools: List[ToolType] = [
        ToolType.SAT,
        ToolType.PERMISSIONS_ANALYZER,
        ToolType.SECRET_SCANNER,
    ]
    secret_scope: str
    sat_job_id: str = ""
    sat_job_url: str = ""
    permissions_analyzer_job_id: str = ""
    permissions_analyzer_job_url: str = ""
    secret_scanner_job_id: str = ""
    secret_scanner_job_url: str = ""