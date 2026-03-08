from typing import Optional
from fastapi import APIRouter, Query

from backend.models.api_response import ApiResponse, fail, ok
from backend.services.databricks_sql import DatabricksSql
from backend.services.databricks_client import Databricks

router = APIRouter(prefix="/checks", tags=["checks"])


def _get_schema() -> str:
    catalog = Databricks.get_secret_or_none("catalog") or "main"
    schema = Databricks.get_secret_or_none("schema") or "sat"
    return f"{catalog}.{schema}"


def _build_checks_query(
    schema: str,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    check_id: Optional[str] = None,
    limit: int = 100,
) -> str:
    query = f"""
        SELECT
            sc.workspaceid,
            sc.run_id,
            'sat' AS tool,
            bp.check_id,
            bp.check AS check_name,
            bp.category,
            bp.severity,
            CASE WHEN sc.score = 1 THEN 'pass' ELSE 'fail' END AS status,
            sc.additional_details,
            bp.recommendation,
            bp.doc_url,
            sc.check_time AS evaluated_at
        FROM {schema}.security_checks sc
        JOIN {schema}.security_best_practices bp ON sc.id = bp.id
        WHERE 1=1
    """
    if severity:
        safe = severity.replace("'", "''")
        query += f" AND bp.severity = '{safe}'"
    if status:
        if status == "pass":
            query += " AND sc.score = 1"
        elif status == "fail":
            query += " AND sc.score != 1"
    if check_id:
        safe = check_id.replace("'", "''")
        query += f" AND bp.check_id = '{safe}'"
    query += f" ORDER BY sc.check_time DESC LIMIT {limit}"
    return query


@router.get("", response_model=ApiResponse)
async def get_checks(
    tool: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
):
    try:
        schema = _get_schema()
        query = _build_checks_query(schema, severity=severity, status=status, limit=limit)
        results = DatabricksSql.query_as_dicts(query)
        return ok(data=results)
    except Exception as e:
        if "TABLE_OR_VIEW_NOT_FOUND" in str(e):
            return ok(data=[], message="No check results yet — run the SAT driver job first")
        return fail(str(e))


@router.get("/{check_id}", response_model=ApiResponse)
async def get_check_detail(check_id: str):
    try:
        schema = _get_schema()
        query = _build_checks_query(schema, check_id=check_id, limit=50)
        results = DatabricksSql.query_as_dicts(query)
        return ok(data=results)
    except Exception as e:
        if "TABLE_OR_VIEW_NOT_FOUND" in str(e):
            return ok(data=[], message="No check results yet — run the SAT driver job first")
        return fail(str(e))
