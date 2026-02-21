import os
from databricks import sql
from databricks.sdk.core import oauth_service_principal

from backend.services.databricks_client import Databricks


class _DatabricksSql:
    def __init__(self) -> None:
        self._connection = None

    def _connect(self):
        if self._connection is None:
            client = Databricks.client
            config = client.config
            warehouse_id = os.environ["DATABRICKS_WAREHOUSE_ID"]
            warehouse = client.warehouses.get(id=warehouse_id)
            
            self._connection = sql.connect(
                server_hostname=config.host,
                http_path=warehouse.odbc_params.path,
                credentials_provider=lambda: oauth_service_principal(config),
            )
        return self._connection

    def query(self, statement: str):
        try:
            connection = self._connect()
            with connection.cursor() as cursor:
                cursor.execute(statement)
                return cursor.fetchall()
        except Exception as e:
            raise Exception(f"SQL query failed: {e}") from e


DatabricksSql = _DatabricksSql()
