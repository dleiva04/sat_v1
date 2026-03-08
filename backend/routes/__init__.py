from backend.routes.setup import router as setup_router
from backend.routes.state import router as state_router
from backend.routes.jobs import router as jobs_router
from backend.routes.checks import router as checks_router
from backend.routes.settings import router as settings_router
from backend.routes.catalogs import router as catalogs_router

routers = [setup_router, state_router, jobs_router, checks_router, settings_router, catalogs_router]
