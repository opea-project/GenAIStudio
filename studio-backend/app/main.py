from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from kubernetes import config

# Load the kubeconfig file
try:
    # Try to load in-cluster configuration
    config.load_incluster_config()
    print("Loaded in-cluster configuration")
except config.ConfigException:
    # If in-cluster configuration fails, fall back to kube-config file
    config.load_kube_config()
    print("Loaded kube-config file")

app = FastAPI()

@app.get("/studio-backend/health")
def read_health():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routers import user_router, download_router, sandbox_router, llmtraces_router, debuglog_router, clickdeploy_router

app.include_router(user_router.router, prefix="/studio-backend")
app.include_router(download_router.router, prefix="/studio-backend")
app.include_router(sandbox_router.router, prefix="/studio-backend")
app.include_router(llmtraces_router.router, prefix="/studio-backend")
app.include_router(debuglog_router.router, prefix="/studio-backend")
app.include_router(clickdeploy_router.router, prefix="/studio-backend")