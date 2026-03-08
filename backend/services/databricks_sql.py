import os
import time

from databricks import sql
from databricks.sdk.core import oauth_service_principal

from backend.services.databricks_client import Databricks

_MAX_CONNECTION_AGE = 59 * 60


class _DatabricksSql:
    def __init__(self) -> None:
        self._connection = None
        self._connected_at: float = 0

    def _is_expired(self) -> bool:
        return self._connection is not None and (
            time.time() - self._connected_at > _MAX_CONNECTION_AGE
        )

    def _close(self) -> None:
        if self._connection is not None:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None
            self._connected_at = 0

    def _connect(self):
        if self._is_expired():
            self._close()

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
            self._connected_at = time.time()
        return self._connection

    def query(self, statement: str):
        try:
            connection = self._connect()
            with connection.cursor() as cursor:
                cursor.execute(statement)
                rows = cursor.fetchall()
                connection.commit()
                return rows
        except Exception as e:
            raise Exception(f"SQL query failed: {e}") from e

    def query_as_dicts(self, statement: str) -> list[dict]:
        try:
            connection = self._connect()
            with connection.cursor() as cursor:
                cursor.execute(statement)
                rows = cursor.fetchall()
                connection.commit()
                columns = [desc[0] for desc in cursor.description]
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            raise Exception(f"SQL query failed: {e}") from e


DatabricksSql = _DatabricksSql()
