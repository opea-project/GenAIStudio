from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
import asyncio

from app.models.pipeline_model import DeployPipelineFlow
from app.services.clickdeploy_service import async_click_deployment, async_check_deployment_status

router = APIRouter()

@router.post("/click-deployment")
async def click_deployment(request: DeployPipelineFlow, background_tasks: BackgroundTasks):
    """Trigger click deployment asynchronously"""
    print("[INFO] Entered /click-deployment endpoint")
    remote_host = request.remoteHost
    remote_user = request.remoteUser  
    pipeline_flow = request.pipelineFlow
    print(f"[DEBUG] pipeline_flow type: {type(pipeline_flow)}")
    chatflow_id = pipeline_flow.id
    print(f"[DEBUG] chatflow_id: {chatflow_id}")
    
    # Use the service layer async function directly with BackgroundTasks
    background_tasks.add_task(
        async_click_deployment,
        remote_host,
        remote_user,
        pipeline_flow.dict(),
        chatflow_id
    )
    
    return {
        "status": "In Progress",
        "message": "Deployment initiated...",
        "chatflow_id": chatflow_id
    }

@router.websocket("/ws/monitor-click-deployment")
async def monitor_click_deployment_status(websocket: WebSocket):
    """Monitor deployment status using docker ps commands"""
    print('[INFO] Starting deployment status monitoring')
    await websocket.accept()
    
    try:
        data = await websocket.receive_json()
        print("Received monitoring data: ", data)
        remote_host = data["hostname"]
        remote_user = data["username"]
        # chatflow_id = data.get("chatflow_id", "unknown")
        compose_dir = "genaistudio-compose"  # Standard directory name

        # Monitor deployment status by checking Docker services directly
        # Give some time for initial deployment setup
        await asyncio.sleep(2)
        
        while True:
            # Check Docker services directly using the service layer function
            result = await async_check_deployment_status(remote_host, remote_user, compose_dir)
            await websocket.send_json(result)
            
            # Continue monitoring until success or definitive error
            if result["status"] == "Success":
                break
            elif result["status"] == "Error" and "Deployment directory not found" not in result["message"]:
                # Only break on real errors, not setup/preparation states
                break
            
            await asyncio.sleep(2)  # Check every 2 seconds to give services time to start
            
    except WebSocketDisconnect:
        print("Client disconnected from monitor-click-deployment WebSocket")
    except Exception as e:
        print(f"Error in monitor-click-deployment WebSocket: {e}")
        try:
            await websocket.send_json({"status": "Error", "message": f"Monitoring error: {str(e)}"})
        except:
            pass
    finally:
        # Clean up WebSocket connection
        try:
            if not websocket.client_state.name == 'DISCONNECTED':
                await websocket.close()
        except:
            pass