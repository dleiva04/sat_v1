import json
import os

from fastapi import APIRouter, Request

from backend.models.sat import SetupRequest
from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_client import Databricks
from backend.services.databricks_sql import DatabricksSql
from backend.services.config_service import ConfigService
from backend.services.jobs_service import JobsService
from backend.services.legacy_secrets_service import LegacySecrets

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

        legacy_secrets: dict[str, str] = {
            "account-console-id": req.databricks_account_id,
            "sql-warehouse-id": os.environ.get("DATABRICKS_WAREHOUSE_ID", ""),
            "analysis_schema_name": f"{req.catalog}.{req.schema_name}",
        }
        if req.use_sp_auth:
            client_id = req.client_id
            client_secret = req.client_secret
            if req.use_app_credentials:
                client_id = os.environ.get("DATABRICKS_CLIENT_ID", "")
                client_secret = os.environ.get("DATABRICKS_CLIENT_SECRET", "")
            if client_id and client_secret:
                legacy_secrets["use-sp-auth"] = "true"
                legacy_secrets["client-id"] = client_id
                legacy_secrets["client-secret"] = client_secret
        if req.cloud_provider == "azure":
            if req.subscription_id:
                legacy_secrets["subscription-id"] = req.subscription_id
            if req.tenant_id:
                legacy_secrets["tenant-id"] = req.tenant_id

        proxies: dict[str, str] = {}
        if req.http_proxy:
            proxies["http"] = req.http_proxy
        if req.https_proxy:
            proxies["https"] = req.https_proxy
        legacy_secrets["proxies"] = json.dumps(proxies)

        LegacySecrets.populate(legacy_secrets)

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


@router.delete("", response_model=ApiResponse)
async def delete_sat(request: Request):
    try:
        from databricks.sdk import WorkspaceClient
        from backend.models.sat import ToolType

        user_token = request.headers.get("x-forwarded-access-token")
        if user_token:
            user_client = WorkspaceClient(token=user_token, host=Databricks.client.config.host)
        else:
            user_client = Databricks.client

        catalog = Databricks.get_secret_or_none("catalog") or ""
        schema = Databricks.get_secret_or_none("schema") or ""

        for tool in ToolType:
            try:
                job_keys = {
                    ToolType.SAT: ("sat_initializer_job_id", "sat_driver_job_id"),
                    ToolType.PERMISSIONS_ANALYZER: ("permissions_analyzer_job_id",),
                    ToolType.SECRET_SCANNER: ("secret_scanner_job_id",),
                }
                from backend.services.config_service import ConfigService
                for col in job_keys.get(tool, ()):
                    job_id = ConfigService.get_job_id(col)
                    if job_id:
                        try:
                            user_client.jobs.delete(job_id=int(job_id))
                        except Exception:
                            pass
                        ConfigService.clear_job_id(col)
            except Exception:
                pass

        if catalog and schema:
            try:
                DatabricksSql.query(f"DROP SCHEMA IF EXISTS {catalog}.{schema} CASCADE")
            except Exception:
                pass

        try:
            user_client.secrets.delete_scope(scope=Databricks.secret_scope)
        except Exception:
            pass
        try:
            user_client.secrets.delete_scope(scope="sat_scope")
        except Exception:
            pass

        return ok("SAT has been completely removed.")
    except Exception as e:
        return fail(str(e))
