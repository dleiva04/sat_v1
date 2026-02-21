from pydantic import BaseModel
from typing import Any, Optional


class ApiResponse(BaseModel):
    status: str
    message: str
    data: Optional[Any] = None


def ok(message: str = "OK", data: Any = None) -> ApiResponse:
    return ApiResponse(status="ok", message=message, data=data)


def fail(message: str = "Error", data: Any = None) -> ApiResponse:
    return ApiResponse(status="error", message=message, data=data)
