from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from kubernetes import client
import json


from app.models.pipeline_model import PipelineFlow, ProjectId
from app.services.project_info_service import ProjectInfo
from app.services.namespace_service import deploy_manifest_in_namespace, delete_namespace, check_ns_status

router = APIRouter()

@router.post("/deploy-sandbox")
async def deploy_sandbox(request: PipelineFlow):
    print('deploy-sandbox')
    project_info = ProjectInfo(request.dict())
    core_v1_api = client.CoreV1Api()
    apps_v1_api = client.AppsV1Api()
    try:
        response = deploy_manifest_in_namespace(core_v1_api, apps_v1_api, json.loads(project_info.export_to_json()))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return response

@router.post("/delete-sandbox")
async def delete_sandbox(request: ProjectId):
    print('deploy-sandbox')
    core_v1_api = client.CoreV1Api()
    try:
        response = delete_namespace(core_v1_api, request.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return response

@router.websocket("/ws/sandbox-status") 
async def check_sandbox_status(websocket: WebSocket):     
    print('checking sandbox status')
    await websocket.accept()
    core_v1_api = client.CoreV1Api()
    apps_v1_api = client.AppsV1Api()
    try:
        data = await websocket.receive_json()
        print("Received data: ", data)
        response = await run_in_threadpool(check_ns_status, data["id"], data["status"], core_v1_api, apps_v1_api)
        await websocket.send_json(response)
    except WebSocketDisconnect:
        print("Client disconnected")
    finally:
        await websocket.close()
        