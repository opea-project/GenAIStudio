from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
import paramiko
import time
import json

from app.models.pipeline_model import DeployPipelineFlow
from app.services.clickdeploy_service import deploy_pipeline

router = APIRouter()

@router.post("/click-deploy")
async def deploy(request: DeployPipelineFlow):
    print("[DEBUG] Entered /click-deploy endpoint")
    remote_host = request.remoteHost
    remote_user = request.remoteUser
    pipeline_flow = request.pipelineFlow
    try:
        print("[DEBUG] Calling deploy_pipeline...")
        response = deploy_pipeline(remote_host, remote_user, pipeline_flow.dict())
        print("[DEBUG] deploy_pipeline returned")
    except Exception as e:
        print(f"[ERROR] Exception in /click-deploy: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return response

@router.websocket("/ws/clickdeploy-status")
async def check_clickdeploy_status(websocket: WebSocket):
    print('checking clickdeploy status')
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        print("Received data: ", data)
        remote_host = data["hostname"]
        remote_user = data["username"]
        compose_dir = data["compose_dir"]

        def check_status():
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(remote_host, username=remote_user)

            # Get the number of services defined in compose.yaml
            _, stdout_num, _ = ssh.exec_command(f"cd {compose_dir} && docker compose config --services | wc -l")
            num_services_output = stdout_num.read().decode().strip().splitlines()
            num_services_lines = [line for line in num_services_output if not line.startswith('WARN') and line.strip()]
            num_services_str = num_services_lines[-1] if num_services_lines else '0'
            
            # Run docker compose ps to get service status
            _, stdout_ps, _ = ssh.exec_command(f"cd {compose_dir} && docker compose ps --all --format json")
            out = stdout_ps.read().decode()
            json_lines = [line for line in out.strip().splitlines() if line.strip() and not line.strip().startswith('WARN')]
            out_filtered = '\n'.join(json_lines)
            
            # Read nohup.out for progress logs (always fetch latest 10 lines)
            _, stdout_nohup, _ = ssh.exec_command(f"cd {compose_dir} && tail -n 10 nohup.out")
            nohup_out_lines = stdout_nohup.read().decode().splitlines()

            ssh.close()
            
            try:
                # If output contains multiple JSON objects, parse all and aggregate
                json_lines = [line for line in out_filtered.strip().splitlines() if line.strip()]
                all_services = []
                for line in json_lines:
                    try:
                        ps_data = json.loads(line)
                        if isinstance(ps_data, dict):
                            if 'services' in ps_data or 'containers' in ps_data:
                                services = ps_data.get('services') or ps_data.get('containers') or []
                                if isinstance(services, dict):
                                    services = list(services.values())
                                elif not isinstance(services, list):
                                    services = []
                                all_services.extend(services)
                            else:
                                all_services.append(ps_data)
                        else:
                            all_services.append(ps_data)
                    except Exception as e:
                        return {"error": f"Failed to parse docker compose ps output: {line}\n{str(e)}"}
                
                if len(all_services) != int(num_services_str):
                    # If error in nohup.out, return as error
                    if any("error" in line.lower() or "fail" in line.lower() for line in nohup_out_lines):
                        return {"error": nohup_out_lines}
                    else:
                        print(f"[DEBUG] Docker pulling images..")
                        return {
                            "all_healthy": False,
                            "none_restarting": True,
                            "services_running": 0,
                            "services_exited": 0,
                            "services_defined": int(num_services_str),
                            "ps": all_services,
                            "error": None,
                            "nohup_out": nohup_out_lines
                        }

                services_exited = sum(1 for s in all_services if isinstance(s, dict) and s.get("State", "") == "exited")
                services_running = sum(1 for s in all_services if isinstance(s, dict) and s.get("State", "") == "running")
                print(f"[DEBUG] Number of services deployed: {services_running + services_exited}/{num_services_str}")
                all_healthy = all((not isinstance(s, dict)) or (s.get("Health", "") in ("", "healthy")) for s in all_services)
                none_restarting = all(isinstance(s, dict) and s.get("State", "") != "restarting" for s in all_services)

                print(f"[DEBUG] all_healthy: {all_healthy}")
                print(f"[DEBUG] none_restarting: {none_restarting}")

                return {
                    "all_healthy": all_healthy,
                    "none_restarting": none_restarting,
                    "services_running": services_running,
                    "services_exited": services_exited,
                    "services_defined": int(num_services_str),
                    "ps": all_services,
                    "error": None,
                    "nohup_out": nohup_out_lines
                }
            except Exception as e:
                return {"error": str(e)}

        while True:

            result = await run_in_threadpool(check_status)

            if result["error"]:
                await websocket.send_json({"status": "Error", "error": result["error"]})
                break

            if (int(result["services_running"]) + int(result["services_exited"])) == result["services_defined"]:
                if result["all_healthy"] and result["services_running"] == result["services_defined"]:
                    # Wait 5 seconds and recheck none_restarting
                    time.sleep(5)
                    recheck_result = await run_in_threadpool(check_status)
                    if recheck_result["none_restarting"]:
                        await websocket.send_json({"status": "Done", "success": f"All {result['services_running']} services are running and healthy. Open http://localhost:8090 in your machine's browser to access the application."})
                    else:
                        restarting_services = [
                            s.get("Name", "unknown") for s in recheck_result["ps"]
                            if isinstance(s, dict) and s.get("State", "") == "restarting"
                        ]
                        await websocket.send_json({"status": "Error", "error": f"Services stuck in restarting status: [{', '.join(restarting_services)}]"})
                else:
                    exited_services = [
                        s.get("Name", "unknown") for s in result["ps"]
                        if isinstance(s, dict) and s.get("State", "") == "exited"
                    ]
                    await websocket.send_json({"status": "Error", "error": f"Services in exited state: [{', '.join(exited_services)}]"})
                break
            # Send nohup_out in progress status
            await websocket.send_json({"status": "In Progress", "ps": result["ps"], "nohup_out": result.get("nohup_out", [])})
            time.sleep(2)
    except WebSocketDisconnect:
        print("Client disconnected")
    finally:
        await websocket.close()