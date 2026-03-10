import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from backend.routes import routers

app = FastAPI(title="SAT", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in routers:
    app.include_router(router, prefix="/api")

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "out")
if os.path.isdir(frontend_dist):
    app.mount("/_next", StaticFiles(directory=os.path.join(frontend_dist, "_next")), name="next-static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path == "":
            full_path = "index"

        html_file = os.path.join(frontend_dist, f"{full_path}.html")
        if os.path.isfile(html_file):
            return FileResponse(html_file, media_type="text/html")

        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file, media_type="text/html")

        return HTMLResponse("Not Found", status_code=404)
