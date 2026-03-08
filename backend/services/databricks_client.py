import base64
import os
from typing import Optional

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound, ResourceAlreadyExists

from backend.models.sat import SATState, ToolType


class _DatabricksClient:
    def __init__(self) -> None:
        self._client = WorkspaceClient()
        self._secret_scope = "sat-app"
        self._source_code_path: Optional[str] = None

    @property
    def client(self) -> WorkspaceClient:
        return self._client

    @property
    def secret_scope(self) -> str:
        return self._secret_scope

    @property
    def source_code_path(self) -> str:
        if self._source_code_path is None:
            app_name = os.environ.get("DATABRICKS_APP_NAME")
            if not app_name:
                raise ValueError("DATABRICKS_APP_NAME environment variable is not set")
            app = self._client.apps.get(name=app_name)
            self._source_code_path = (app.default_source_code_path or "").rstrip("/")
        return self._source_code_path

    @property
    def state(self) -> SATState:
        is_configured = (self.get_secret_or_none("is_app_configured") or "") == "true"
        catalog = self.get_secret_or_none("catalog") or ""
        schema_name = self.get_secret_or_none("schema") or ""

        if not is_configured:
            return SATState(
                is_configured=False,
                catalog=catalog,
                schema_name=schema_name,
            )

        from backend.services.config_service import ConfigService

        try:
            config = ConfigService.read_config()
        except Exception:
            return SATState(
                is_configured=True,
                catalog=catalog,
                schema_name=schema_name,
            )

        job_id_keys = {
            ToolType.SAT: ("sat_initializer_job_id", "sat_driver_job_id"),
            ToolType.PERMISSIONS_ANALYZER: ("permissions_analyzer_job_id",),
            ToolType.SECRET_SCANNER: ("secret_scanner_job_id",),
        }
        installed_tools = []
        for tool, keys in job_id_keys.items():
            if all(config.get(k) for k in keys):
                installed_tools.append(tool)

        host = self._client.config.host.rstrip("/")

        def _job_url(job_id: str) -> str:
            return f"{host}/#job/{job_id}" if job_id else ""

        init_id = config.get("sat_initializer_job_id", "") or ""
        driver_id = config.get("sat_driver_job_id", "") or ""
        perm_id = config.get("permissions_analyzer_job_id", "") or ""
        scanner_id = config.get("secret_scanner_job_id", "") or ""

        return SATState(
            is_configured=True,
            databricks_account_id=config.get("databricks_account_id", ""),
            catalog=catalog,
            schema_name=schema_name,
            installed_tools=installed_tools,
            compute_type=config.get("compute_type", "serverless") or "serverless",
            cluster_id=config.get("cluster_id", "") or "",
            node_type_id=config.get("node_type_id", "") or "",
            num_workers=int(config.get("num_workers", 1) or 1),
            sat_initializer_job_id=init_id,
            sat_initializer_job_url=_job_url(init_id),
            sat_driver_job_id=driver_id,
            sat_driver_job_url=_job_url(driver_id),
            permissions_analyzer_job_id=perm_id,
            permissions_analyzer_job_url=_job_url(perm_id),
            secret_scanner_job_id=scanner_id,
            secret_scanner_job_url=_job_url(scanner_id),
        )

    def get_secret(self, key: str) -> str:
        try:
            secret = self._client.secrets.get_secret(scope=self.secret_scope, key=key)
            return base64.b64decode(secret.value or "").decode("utf-8")
        except NotFound:
            raise NotFound(f"Secret {key} not found in scope {self.secret_scope}")

    def get_secret_or_none(self, key: str) -> Optional[str]:
        try:
            return self.get_secret(key)
        except Exception:
            return None

    def create_secret_scope(self) -> None:
        try:
            self._client.secrets.create_scope(scope=self.secret_scope)
        except ResourceAlreadyExists:
            pass

    def put_secret(self, key: str, value: str) -> None:
        self._client.secrets.put_secret(
            scope=self.secret_scope, key=key, string_value=value
        )

    def delete_secret(self, key: str) -> None:
        try:
            self._client.secrets.delete_secret(scope=self.secret_scope, key=key)
        except NotFound:
            pass

    def create_secret(self, key: str, value: str) -> None:
        self.put_secret(key, value)


Databricks = _DatabricksClient()
