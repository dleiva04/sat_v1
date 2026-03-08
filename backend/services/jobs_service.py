from typing import Optional

from databricks.sdk.service.compute import AutoScale, ClusterSpec
from databricks.sdk.service.jobs import Task, NotebookTask

from backend.models.sat import ToolType
from backend.models.jobs import ComputeConfig, ComputeType, JobRunStatus
from backend.services.databricks_client import Databricks

_RELATIVE_NOTEBOOK_PATHS = {
    ToolType.SAT: {
        "initializer": "backend/sat/notebooks/security_analysis_initializer",
        "driver": "backend/sat/notebooks/security_analysis_driver",
    },
    ToolType.PERMISSIONS_ANALYZER: {
        "analyzer": "backend/sat/notebooks/permission_analysis_data_collection",
    },
    ToolType.SECRET_SCANNER: {
        "scanner": "backend/sat/notebooks/security_analysis_secrets_scanner",
    },
}

_JOB_ID_COLUMNS = {
    (ToolType.SAT, "initializer"): "sat_initializer_job_id",
    (ToolType.SAT, "driver"): "sat_driver_job_id",
    (ToolType.PERMISSIONS_ANALYZER, "analyzer"): "permissions_analyzer_job_id",
    (ToolType.SECRET_SCANNER, "scanner"): "secret_scanner_job_id",
}

_TOOL_JOB_KEYS = {
    ToolType.SAT: ("sat_initializer_job_id", "sat_driver_job_id"),
    ToolType.PERMISSIONS_ANALYZER: ("permissions_analyzer_job_id",),
    ToolType.SECRET_SCANNER: ("secret_scanner_job_id",),
}


class _JobsService:
    @property
    def _client(self):
        return Databricks.client

    def _workspace_url(self) -> str:
        host = self._client.config.host.rstrip("/")
        return host

    def _notebook_paths(self, tool: ToolType) -> dict[str, str]:
        base = Databricks.source_code_path
        if not base:
            raise ValueError(
                "Cannot resolve notebook paths: set DATABRICKS_APP_NAME or SAT_SOURCE_CODE_PATH"
            )
        return {
            key: f"{base}/{rel}"
            for key, rel in _RELATIVE_NOTEBOOK_PATHS[tool].items()
        }

    def _build_task(
        self,
        task_key: str,
        notebook_path: str,
        compute: ComputeConfig,
        base_params: dict,
    ) -> Task:
        task = Task(
            task_key=task_key,
            notebook_task=NotebookTask(
                notebook_path=notebook_path,
                base_parameters=base_params,
            ),
        )
        if compute.compute_type == ComputeType.EXISTING_CLUSTER:
            task.existing_cluster_id = compute.cluster_id
        elif compute.compute_type == ComputeType.JOB_CLUSTER:
            task.new_cluster = ClusterSpec(
                node_type_id=compute.node_type_id or "i3.xlarge",
                autoscale=AutoScale(min_workers=1, max_workers=compute.num_workers),
                spark_version="15.4.x-scala2.12",
            )
        return task

    def _get_base_params(self) -> dict:
        from backend.services.config_service import ConfigService

        catalog = Databricks.get_secret_or_none("catalog") or ""
        schema = Databricks.get_secret_or_none("schema") or ""
        config = ConfigService.read_config()
        account_id = config.get("databricks_account_id", "")
        return {"catalog": catalog, "schema": schema, "account_id": account_id}

    def install(self, tool: ToolType, compute: ComputeConfig) -> dict:
        from backend.services.config_service import ConfigService

        paths = self._notebook_paths(tool)
        params = self._get_base_params()
        created_jobs = {}

        for task_name, notebook_path in paths.items():
            print(f"Installing tool {tool.value} task {task_name} with notebook path {notebook_path}")
            job_name = f"{tool.value}-{task_name}"
            task = self._build_task(task_name, notebook_path, compute, params)

            job = self._client.jobs.create(name=job_name, tasks=[task])
            job_id = str(job.job_id)
            job_url = f"{self._workspace_url()}/#job/{job_id}"

            column = _JOB_ID_COLUMNS[(tool, task_name)]
            ConfigService.set_job_id(column, job_id)

            created_jobs[task_name] = {"job_id": job_id, "job_url": job_url}

        ConfigService.log(
            action="tool_installed",
            message=f"Installed tool: {tool.value}",
            source="jobs",
        )

        return created_jobs

    def uninstall(self, tool: ToolType) -> None:
        from backend.services.config_service import ConfigService

        paths = self._notebook_paths(tool)
        for task_name in paths:
            column = _JOB_ID_COLUMNS[(tool, task_name)]
            job_id = ConfigService.get_job_id(column)
            if job_id:
                try:
                    self._client.jobs.delete(job_id=int(job_id))
                except Exception:
                    pass
                ConfigService.clear_job_id(column)

        ConfigService.log(
            action="tool_uninstalled",
            message=f"Uninstalled tool: {tool.value}",
            source="jobs",
        )

    def run(self, tool: ToolType, task_name: Optional[str] = None) -> dict:
        from backend.services.config_service import ConfigService

        paths = self._notebook_paths(tool)
        results = {}

        for tn in paths:
            if task_name and tn != task_name:
                continue
            column = _JOB_ID_COLUMNS[(tool, tn)]
            job_id = ConfigService.get_job_id(column)
            if not job_id:
                raise ValueError(f"Tool {tool.value} task {tn} is not installed")
            run = self._client.jobs.run_now(job_id=int(job_id))
            results[tn] = {"run_id": str(run.run_id)}

        ConfigService.log(
            action="job_run_triggered",
            message=f"Triggered run for tool: {tool.value}",
            source="jobs",
        )

        return results

    def status(self, tool: ToolType) -> list[JobRunStatus]:
        from backend.services.config_service import ConfigService

        paths = self._notebook_paths(tool)
        statuses = []

        for task_name in paths:
            column = _JOB_ID_COLUMNS[(tool, task_name)]
            job_id = ConfigService.get_job_id(column)
            if not job_id:
                continue

            job_url = f"{self._workspace_url()}/#job/{job_id}"
            run_status = JobRunStatus(
                tool=f"{tool.value}_{task_name}",
                job_id=job_id,
                job_url=job_url,
            )

            try:
                runs = list(self._client.jobs.list_runs(job_id=int(job_id), limit=1))
                if runs:
                    latest = runs[0]
                    run_status.latest_run_id = str(latest.run_id)
                    run_status.status = (
                        latest.state.life_cycle_state.value
                        if latest.state and latest.state.life_cycle_state
                        else None
                    )
                    run_status.result_state = (
                        latest.state.result_state.value
                        if latest.state and latest.state.result_state
                        else None
                    )
                    run_status.start_time = (
                        str(latest.start_time) if latest.start_time else None
                    )
                    run_status.end_time = (
                        str(latest.end_time) if latest.end_time else None
                    )
            except Exception:
                try:
                    self._client.jobs.get(job_id=int(job_id))
                except Exception:
                    run_status.status = "deleted"

            statuses.append(run_status)

        return statuses

    def get_installed_tools(self) -> list[ToolType]:
        from backend.services.config_service import ConfigService

        config = ConfigService.read_config()
        installed = []
        for tool, keys in _TOOL_JOB_KEYS.items():
            if all(config.get(k) for k in keys):
                installed.append(tool)
        return installed


JobsService = _JobsService()
