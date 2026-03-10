"""Populates the legacy `sat_scope` secret scope that SAT notebooks expect.

This is separate from the main `sat-app` scope used by the backend.
Intended to be deprecated once the notebooks are migrated.
"""

from databricks.sdk.errors import ResourceAlreadyExists

from backend.services.databricks_client import Databricks

_SCOPE = "sat_scope"


class _LegacySecretsService:
    @property
    def _client(self):
        return Databricks.client

    def _ensure_scope(self) -> None:
        try:
            self._client.secrets.create_scope(scope=_SCOPE)
        except ResourceAlreadyExists:
            pass

    def populate(self, secrets: dict[str, str]) -> None:
        self._ensure_scope()
        for key, value in secrets.items():
            if value:
                self._client.secrets.put_secret(
                    scope=_SCOPE, key=key, string_value=value
                )

    def delete_scope(self) -> None:
        try:
            self._client.secrets.delete_scope(scope=_SCOPE)
        except Exception:
            pass


LegacySecrets = _LegacySecretsService()
