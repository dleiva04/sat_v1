from fastapi import APIRouter

from backend.models.sat import SetupRequest
from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_client import Databricks
from backend.services.databricks_sql import DatabricksSql
from backend.services.config_service import ConfigService
from backend.services.jobs_service import JobsService

router = APIRouter(prefix="/setup", tags=["setup"])


def configure_sat(req: SetupRequest) -> ApiResponse:
    try:
        Databricks.create_secret_scope()
        Databricks.create_secret(key="catalog", value=req.catalog)
        Databricks.create_secret(key="schema", value=req.schema_name)

        DatabricksSql.query(f"CREATE SCHEMA IF NOT EXISTS {req.catalog}.{req.schema_name}")

        ConfigService.create_tables(req.catalog, req.schema_name)
        ConfigService.seed_config(
            catalog=req.catalog,
            schema=req.schema_name,
            databricks_account_id=req.databricks_account_id,
            compute_type=req.compute.compute_type.value,
            cluster_id=req.compute.cluster_id or "",
            node_type_id=req.compute.node_type_id or "",
            num_workers=req.compute.num_workers,
        )

        installed = {}
        for tool in req.tools:
            result = JobsService.install(tool, req.compute)
            installed[tool.value] = result

        Databricks.create_secret(key="is_app_configured", value="true")

        ConfigService.log(
            action="setup_completed",
            message=f"SAT setup completed with tools: {[t.value for t in req.tools]}",
            source="setup",
        )

        return ok("SAT setup configured successfully", data={"installed_tools": installed})
    except Exception as e:
        return fail(str(e))


@router.post("", response_model=ApiResponse)
async def configure_setup(req: SetupRequest):
    try:
        return configure_sat(req)
    except Exception as e:
        return fail(str(e))
