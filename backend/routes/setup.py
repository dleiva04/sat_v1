from databricks.sdk.errors import NotFound
from fastapi import APIRouter

from backend.models.sat import SetupRequest
from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_client import Databricks
from backend.services.databricks_sql import DatabricksSql

router = APIRouter(prefix="/setup", tags=["setup"])

def configure_sat(req: SetupRequest) -> ApiResponse:
    try:
        Databricks.create_secret_scope()
        Databricks.create_secret(key="databricks_account_id", value=req.databricks_account_id)
        Databricks.create_secret(key="is_app_configured", value="true")
        DatabricksSql.query(f"CREATE SCHEMA IF NOT EXISTS {req.catalog}.{req.schema_name}")
        return ok("SAT setup configured successfully")
    except Exception as e:
        return fail(str(e))


@router.post("", response_model=ApiResponse)
async def configure_setup(req: SetupRequest):
    try:
        return configure_sat(req)
    except Exception as e:
        return fail(str(e))
