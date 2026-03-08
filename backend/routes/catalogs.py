from fastapi import APIRouter

from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_client import Databricks

router = APIRouter(prefix="/catalogs", tags=["catalogs"])


@router.get("", response_model=ApiResponse)
async def list_catalogs():
    try:
        catalogs = Databricks.client.catalogs.list()
        names = [c.name for c in catalogs if c.name]
        return ok(data=names)
    except Exception as e:
        return fail(str(e))


@router.get("/{catalog}/schemas", response_model=ApiResponse)
async def list_schemas(catalog: str):
    try:
        schemas = Databricks.client.schemas.list(catalog_name=catalog)
        names = [s.name for s in schemas if s.name]
        return ok(data=names)
    except Exception as e:
        return fail(str(e))
