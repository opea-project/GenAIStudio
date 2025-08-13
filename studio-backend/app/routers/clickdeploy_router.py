from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
import paramiko
import asyncio
import json

from app.models.pipeline_model import DeployPipelineFlow
from app.services.clickdeploy_service import upload_pipeline_zip

router = APIRouter()

@router.post("/upload-pipeline-files")
async def upload_pipeline_files(request: DeployPipelineFlow):
    print("[DEBUG] Entered /upload-pipeline-files endpoint")
    remote_host = request.remoteHost
    remote_user = request.remoteUser
    pipeline_flow = request.pipelineFlow
    try:
        print("[DEBUG] Calling upload_pipeline_zip...")
        response = upload_pipeline_zip(remote_host, remote_user, pipeline_flow.dict())
        print("[DEBUG] upload_pipeline_zip returned")
    except Exception as e:
        print(f"[ERROR] Exception in /upload-pipeline-files: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return response

@router.websocket("/ws/deploy-and-monitor")
async def deploy_and_monitor_status(websocket: WebSocket):
    print('deploying and monitoring status')
    await websocket.accept()
    ssh_connection = None
    try:
        data = await websocket.receive_json()
        print("Received data: ", data)
        remote_host = data["hostname"]
        remote_user = data["username"]
        compose_dir = data["compose_dir"]
        remote_zip_path = data.get("remote_zip_path", f"/home/{remote_user}/docker-compose.zip")

        # Step 1: Connect SSH
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(remote_host, username=remote_user)
        ssh_connection = ssh  # Store for cleanup

        # Step 2: Stop existing services if directory exists
        await websocket.send_json({"status": "Preparing", "message": "Checking for existing services..."})
        print(f"[DEBUG] Checking if {compose_dir} directory exists...")
        _, stdout, _ = ssh.exec_command(f"ls -d {compose_dir}", get_pty=True)
        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            _, stdout, _ = ssh.exec_command(f"cd {compose_dir} && docker compose down", get_pty=True)
            while not stdout.channel.exit_status_ready():
                await websocket.send_json({"status": "Preparing", "message": "Stopping any existing services..."})
                await asyncio.sleep(2)  # Non-blocking sleep
            # Clean up old files
            ssh.exec_command(f"cd {compose_dir}; rm -f .env nohup.out app.nginx.conf.template compose.yaml workflow-info.json", get_pty=True)
        else:
            pass

        # Step 3: Extract files
        await websocket.send_json({"status": "Preparing", "message": "Extracting files..."})
        extract_cmd = f"python3 -c \"import zipfile; zipfile.ZipFile('{remote_zip_path}').extractall('{compose_dir}')\""
        _, stdout, _ = ssh.exec_command(extract_cmd, get_pty=True)
        if stdout.channel.recv_exit_status() != 0:
            await websocket.send_json({"status": "Error", "error": "Failed to extract files using Python."})
            ssh.close()
            await websocket.close()
            return
        await websocket.send_json({"status": "Preparing", "message": "Extraction complete."})
        # Clean up the uploaded docker-compose.zip file
        _, stdout, _ = ssh.exec_command(f"rm -f {remote_zip_path}", get_pty=True)

        # Step 4: Start services
        _, stdout, _ = ssh.exec_command(f"cd {compose_dir} && nohup docker compose up -d & sleep 0.1", get_pty=True)
        ssh.close()
        await websocket.send_json({"status": "Preparing", "message": "Deployment steps complete. Monitoring status..."})
        
        def check_status():
            ssh_check = None
            try:
                ssh_check = paramiko.SSHClient()
                ssh_check.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                ssh_check.connect(remote_host, username=remote_user)

                # Verify the directory exists and has content
                print(f"[DEBUG] Checking directory: {compose_dir}")
                _, stdout_ls, _ = ssh_check.exec_command(f"ls -la {compose_dir}")
                # ls_output = stdout_ls.read().decode().strip()
                # print(f"[DEBUG] Directory contents: {ls_output}")

                # Get the number of services defined in compose.yaml
                _, stdout_num, _ = ssh_check.exec_command(f"cd {compose_dir} && docker compose config --services | wc -l")
                num_services_output = stdout_num.read().decode().strip().splitlines()
                num_services_lines = [line for line in num_services_output if not line.startswith('WARN') and line.strip()]
                num_services_str = num_services_lines[-1] if num_services_lines else '0'
                # print(f"[DEBUG] Number of services defined: {num_services_str}")
                
                # Run docker compose ps to get service status
                _, stdout_ps, _ = ssh_check.exec_command(f"cd {compose_dir} && docker compose ps --all --format json")
                out = stdout_ps.read().decode()
                json_lines = [line for line in out.strip().splitlines() if line.strip() and not line.strip().startswith('WARN')]
                out_filtered = '\n'.join(json_lines)
                # print(f"[DEBUG] Docker compose ps output: {out_filtered}")
                
                # Read nohup.out for progress logs (always fetch latest 10 lines)
                _, stdout_nohup, _ = ssh_check.exec_command(f"cd {compose_dir} && tail -n 10 nohup.out")
                nohup_out_lines = stdout_nohup.read().decode().splitlines()
                print(f"[DEBUG] Nohup output: {nohup_out_lines}")

                return _process_service_status(out_filtered, num_services_str, nohup_out_lines)
            except Exception as e:
                return {"error": f"Status check failed: {str(e)}"}
            finally:
                if ssh_check:
                    try:
                        ssh_check.close()
                    except:
                        pass

        def _process_service_status(out_filtered, num_services_str, nohup_out_lines):
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

                # Define containers that are expected to complete and exit
                expected_completed_containers = [
                    "model-downloader", "downloader", "init", "setup", "migrate", "seed"
                ]
                
                # Filter out expected completed containers from exited count
                unexpected_exited_services = []
                expected_completed_services = []
                running_services = []
                
                for s in all_services:
                    if isinstance(s, dict):
                        service_name = s.get("Name", "").lower()
                        state = s.get("State", "")
                        
                        if state == "running":
                            running_services.append(s)
                        elif state == "exited":
                            # Check if this is an expected completed container
                            is_expected_completed = any(keyword in service_name for keyword in expected_completed_containers)
                            if is_expected_completed:
                                expected_completed_services.append(s)
                            else:
                                unexpected_exited_services.append(s)
                
                services_exited = len(unexpected_exited_services)
                services_running = len(running_services)
                services_expected_completed = len(expected_completed_services)
                
                print(f"[DEBUG] Number of services deployed: {services_running} running, {services_exited} unexpectedly exited, {services_expected_completed} expected completed / {num_services_str} total")
                all_healthy = all((not isinstance(s, dict)) or (s.get("Health", "") in ("", "healthy")) for s in all_services)
                none_restarting = all(isinstance(s, dict) and s.get("State", "") != "restarting" for s in all_services)

                print(f"[DEBUG] all_healthy: {all_healthy}")
                print(f"[DEBUG] none_restarting: {none_restarting}")

                return {
                    "all_healthy": all_healthy,
                    "none_restarting": none_restarting,
                    "services_running": services_running,
                    "services_exited": services_exited,
                    "services_expected_completed": services_expected_completed,
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

            if (int(result["services_running"]) + int(result["services_exited"]) + int(result.get("services_expected_completed", 0))) == result["services_defined"]:
                # Only consider actually running services + expected completed services as "successful"
                expected_running_services = result["services_defined"] - result.get("services_expected_completed", 0)
                
                if result["all_healthy"] and result["services_running"] == expected_running_services and result["services_exited"] == 0:
                    await asyncio.sleep(5)
                    recheck_result = await run_in_threadpool(check_status)
                    if recheck_result["none_restarting"]:
                        total_successful = result["services_running"] + result.get("services_expected_completed", 0)
                        await websocket.send_json({"status": "Done", "success": f"All {total_successful} services completed successfully ({result['services_running']} running, {result.get('services_expected_completed', 0)} completed). Open http://localhost:8090 in your machine's browser to access the application."})
                    else:
                        restarting_services = [
                            s.get("Name", "unknown") for s in recheck_result["ps"]
                            if isinstance(s, dict) and s.get("State", "") == "restarting"
                        ]
                        await websocket.send_json({"status": "Error", "error": f"Services stuck in restarting status: [{', '.join(restarting_services)}]"})
                else:
                    # Only report unexpected exited services as errors
                    if result["services_exited"] > 0:
                        exited_services = [
                            s.get("Name", "unknown") for s in result["ps"]
                            if isinstance(s, dict) and s.get("State", "") == "exited" and not any(keyword in s.get("Name", "").lower() for keyword in ["model-downloader", "downloader", "init", "setup", "migrate", "seed"])
                        ]
                        if exited_services:
                            await websocket.send_json({"status": "Error", "error": f"Services in exited state: [{', '.join(exited_services)}]"})
                        else:
                            # All exited services are expected completed ones, continue monitoring
                            await websocket.send_json({"status": "In Progress", "ps": result["ps"], "nohup_out": result.get("nohup_out", [])})
                            await asyncio.sleep(2)
                            continue
                    else:
                        await websocket.send_json({"status": "In Progress", "ps": result["ps"], "nohup_out": result.get("nohup_out", [])})
                        await asyncio.sleep(2)
                        continue
                break
            # Send nohup_out in progress status
            await websocket.send_json({"status": "In Progress", "ps": result["ps"], "nohup_out": result.get("nohup_out", [])})
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print("Client disconnected from deploy-and-monitor WebSocket")
    except Exception as e:
        print(f"Error in deploy-and-monitor WebSocket: {e}")
        try:
            await websocket.send_json({"status": "Error", "error": f"Unexpected error: {str(e)}"})
        except:
            pass  # WebSocket might already be closed
    finally:
        # Clean up SSH connection if it exists
        if ssh_connection:
            try:
                ssh_connection.close()
                print("SSH connection cleaned up")
            except:
                pass
        # Ensure WebSocket is closed
        try:
            if not websocket.client_state.name == 'DISCONNECTED':
                await websocket.close()
        except:
            pass