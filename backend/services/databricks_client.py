import base64

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound, ResourceAlreadyExists

from backend.models.sat import SATState


class _DatabricksClient:
    def __init__(self) -> None:
        self._client = WorkspaceClient()
        self._secret_scope = "sat-app"

    @property
    def client(self) -> WorkspaceClient:
        return self._client

    @property
    def secret_scope(self) -> str:
        return self._secret_scope

    @property
    def state(self) -> SATState:
        try:
            account_id = self.get_secret("databricks_account_id")
            return SATState(
                databricks_account_id=account_id,
                secret_scope=self.secret_scope,
            )
        except NotFound:
            raise NotFound("SAT is not configured")

    def get_secret(self, key: str) -> str:
        try:
            secret = self._client.secrets.get_secret(scope=self.secret_scope, key=key)
            return base64.b64decode(secret.value or "").decode("utf-8")
        except NotFound:
            raise NotFound(f"Secret {key} not found in scope {self.secret_scope}")

    def create_secret_scope(self) -> None:
        try:
            self._client.secrets.create_scope(scope=self.secret_scope)
        except ResourceAlreadyExists as e:
            raise ResourceAlreadyExists(f"Secret scope {self.secret_scope} already exists")
        except Exception as e:
            raise Exception(f"Failed to create secret scope: {e}")

    def create_secret(self, key: str, value: str) -> None:
        try:
            self._client.secrets.put_secret(
                scope=self.secret_scope, key=key, string_value=value
            )
        except ResourceAlreadyExists as e:
            raise ResourceAlreadyExists(f"Secret {key} already exists in scope {self.secret_scope}")
        except Exception as e:
            raise Exception(f"Failed to create secret: {e}")


Databricks = _DatabricksClient()
