from backend.services.databricks_client import Databricks
from backend.services.databricks_sql import DatabricksSql

CONFIG_COLUMNS = [
    "databricks_account_id",
    "compute_type",
    "cluster_id",
    "node_type_id",
    "num_workers",
    "sat_initializer_job_id",
    "sat_driver_job_id",
    "permissions_analyzer_job_id",
    "secret_scanner_job_id",
    "updated_at",
]


class _ConfigService:
    def _config_table(self) -> str:
        catalog = Databricks.get_secret_or_none("catalog") or "main"
        schema = Databricks.get_secret_or_none("schema") or "sat"
        return f"{catalog}.{schema}.sat_config"

    def _logs_table(self) -> str:
        catalog = Databricks.get_secret_or_none("catalog") or "main"
        schema = Databricks.get_secret_or_none("schema") or "sat"
        return f"{catalog}.{schema}.sat_logs"

    def create_tables(self, catalog: str, schema: str) -> None:
        config_tbl = f"{catalog}.{schema}.sat_config"
        logs_tbl = f"{catalog}.{schema}.sat_logs"

        DatabricksSql.query(f"""
            CREATE TABLE IF NOT EXISTS {config_tbl} (
                databricks_account_id STRING,
                compute_type STRING,
                cluster_id STRING,
                node_type_id STRING,
                num_workers INT,
                sat_initializer_job_id STRING,
                sat_driver_job_id STRING,
                permissions_analyzer_job_id STRING,
                secret_scanner_job_id STRING,
                updated_at TIMESTAMP
            )
        """)

        DatabricksSql.query(f"""
            CREATE TABLE IF NOT EXISTS {logs_tbl} (
                logged_at TIMESTAMP,
                level STRING,
                source STRING,
                action STRING,
                message STRING,
                details STRING
            )
        """)

    def seed_config(
        self,
        catalog: str,
        schema: str,
        databricks_account_id: str,
        compute_type: str = "serverless",
        cluster_id: str = "",
        node_type_id: str = "",
        num_workers: int = 1,
    ) -> None:
        table = f"{catalog}.{schema}.sat_config"
        DatabricksSql.query(f"""
            INSERT INTO {table}
            (databricks_account_id, compute_type, cluster_id, node_type_id,
             num_workers, sat_initializer_job_id, sat_driver_job_id,
             permissions_analyzer_job_id, secret_scanner_job_id, updated_at)
            VALUES (
                '{databricks_account_id}',
                '{compute_type}',
                '{cluster_id}',
                '{node_type_id}',
                {num_workers},
                '', '', '', '',
                CURRENT_TIMESTAMP()
            )
        """)

    def read_config(self) -> dict:
        table = self._config_table()
        rows = DatabricksSql.query(f"SELECT * FROM {table} LIMIT 1")
        if not rows:
            return {}
        row = rows[0]
        return dict(zip(CONFIG_COLUMNS, row))

    def update_config(self, **kwargs) -> None:
        table = self._config_table()
        assignments = []
        for key, value in kwargs.items():
            if key not in CONFIG_COLUMNS or key == "updated_at":
                continue
            if isinstance(value, int):
                assignments.append(f"{key} = {value}")
            else:
                safe = str(value).replace("'", "''")
                assignments.append(f"{key} = '{safe}'")
        if not assignments:
            return
        assignments.append("updated_at = CURRENT_TIMESTAMP()")
        set_clause = ", ".join(assignments)
        DatabricksSql.query(f"UPDATE {table} SET {set_clause}")

    def get_job_id(self, key: str) -> str:
        config = self.read_config()
        return config.get(key, "") or ""

    def set_job_id(self, key: str, value: str) -> None:
        self.update_config(**{key: value})

    def clear_job_id(self, key: str) -> None:
        self.update_config(**{key: ""})

    def log(
        self,
        action: str,
        message: str,
        source: str = "app",
        level: str = "INFO",
        details: str = "",
    ) -> None:
        table = self._logs_table()
        safe_msg = message.replace("'", "''")
        safe_details = details.replace("'", "''")
        try:
            DatabricksSql.query(f"""
                INSERT INTO {table}
                (logged_at, level, source, action, message, details)
                VALUES (
                    CURRENT_TIMESTAMP(),
                    '{level}',
                    '{source}',
                    '{action}',
                    '{safe_msg}',
                    '{safe_details}'
                )
            """)
        except Exception:
            pass


ConfigService = _ConfigService()
