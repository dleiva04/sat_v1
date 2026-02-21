from fastapi import APIRouter

from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_client import Databricks

router = APIRouter(prefix="/state", tags=["status"])


@router.get("", response_model=ApiResponse)
async def get_state():
    try:
        return ok(data=Databricks.state)
    except Exception as e:
        return fail(str(e))