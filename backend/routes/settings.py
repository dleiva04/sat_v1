from fastapi import APIRouter

from backend.models.sat import SettingsUpdateRequest
from backend.models.jobs import ComputeConfig, ComputeType
from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_client import Databricks
from backend.services.databricks_sql import DatabricksSql
from backend.services.config_service import ConfigService
from backend.services.jobs_service import JobsService

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_current_compute() -> ComputeConfig:
    config = ConfigService.read_config()
    return ComputeConfig(
        compute_type=ComputeType(config.get("compute_type", "serverless") or "serverless"),
        cluster_id=config.get("cluster_id") or None,
        node_type_id=config.get("node_type_id") or None,
        num_workers=int(config.get("num_workers", 1) or 1),
    )


@router.put("", response_model=ApiResponse)
async def update_settings(req: SettingsUpdateRequest):
    try:
        config_updates = {}

        if req.databricks_account_id is not None:
            config_updates["databricks_account_id"] = req.databricks_account_id

        if req.catalog is not None:
            Databricks.put_secret("catalog", req.catalog)

        if req.schema_name is not None:
            Databricks.put_secret("schema", req.schema_name)

        if req.catalog is not None or req.schema_name is not None:
            catalog = req.catalog or Databricks.get_secret_or_none("catalog") or ""
            schema = req.schema_name or Databricks.get_secret_or_none("schema") or ""
            if catalog and schema:
                DatabricksSql.query(f"CREATE SCHEMA IF NOT EXISTS {catalog}.{schema}")

        if req.compute is not None:
            config_updates["compute_type"] = req.compute.compute_type.value
            config_updates["cluster_id"] = req.compute.cluster_id or ""
            config_updates["node_type_id"] = req.compute.node_type_id or ""
            config_updates["num_workers"] = req.compute.num_workers

        if config_updates:
            ConfigService.update_config(**config_updates)

        compute = req.compute or _get_current_compute()

        if req.tools_to_install:
            for tool in req.tools_to_install:
                JobsService.install(tool, compute)

        if req.tools_to_uninstall:
            for tool in req.tools_to_uninstall:
                JobsService.uninstall(tool)

        ConfigService.log(
            action="settings_updated",
            message="Settings updated",
            source="settings",
        )

        state = Databricks.state
        return ok("Settings updated successfully", data=state.model_dump())
    except Exception as e:
        return fail(str(e))
