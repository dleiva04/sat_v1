from fastapi import APIRouter

from backend.models.sat import ToolType
from backend.models.jobs import JobInstallRequest
from backend.models.api_response import ApiResponse, fail, ok
from backend.services.jobs_service import JobsService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/install/{tool}", response_model=ApiResponse)
async def install_tool(tool: ToolType, req: JobInstallRequest = JobInstallRequest()):
    try:
        result = JobsService.install(tool, req.compute)
        return ok(message=f"Installed {tool.value}", data=result)
    except Exception as e:
        return fail(str(e))


@router.delete("/uninstall/{tool}", response_model=ApiResponse)
async def uninstall_tool(tool: ToolType):
    try:
        JobsService.uninstall(tool)
        return ok(message=f"Uninstalled {tool.value}")
    except Exception as e:
        return fail(str(e))


@router.post("/run/{tool}", response_model=ApiResponse)
async def run_tool(tool: ToolType):
    try:
        result = JobsService.run(tool)
        return ok(message=f"Triggered {tool.value}", data=result)
    except Exception as e:
        return fail(str(e))


@router.get("/status/{tool}", response_model=ApiResponse)
async def get_tool_status(tool: ToolType):
    try:
        statuses = JobsService.status(tool)
        return ok(data=[s.model_dump() for s in statuses])
    except Exception as e:
        return fail(str(e))
