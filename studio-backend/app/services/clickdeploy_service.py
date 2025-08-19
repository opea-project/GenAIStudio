import json
import os
import shutil
import logging
import paramiko
import tempfile
import json
import zipfile
import time
import concurrent.futures
import asyncio

from app.services.exporter_service import convert_proj_info_to_compose
from app.services.workflow_info_service import WorkflowInfo
from app.utils.exporter_utils import process_opea_services

async def async_click_deployment(remote_host, remote_user, pipeline_flow_dict, chatflow_id):
    """
    Async wrapper for the click deployment process that can be used with BackgroundTasks
    """
    try:
        print(f"[INFO] Starting async deployment process for chatflow {chatflow_id}")
        
        # Run the synchronous deployment function in a thread pool
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            response = await loop.run_in_executor(
                executor, 
                click_deploy_pipeline, 
                remote_host, 
                remote_user, 
                pipeline_flow_dict, 
                chatflow_id
            )
        
        print(f"[INFO] Async deployment process completed for chatflow {chatflow_id}: {response}")
        return response
        
    except Exception as e:
        print(f"[ERROR] Exception in async deployment process for chatflow {chatflow_id}: {e}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise e

def click_deploy_pipeline(hostname, username, pipeline_flow, chatflow_id):
    """
    Main deployment function that handles the entire deployment process.
    Detects existing deployment, stops it if necessary, uploads files, and starts services.
    """
    print(f"[INFO] Starting click deployment for chatflow {chatflow_id}")
    print(f"[DEBUG] Deployment parameters - hostname: {hostname}, username: {username}")
    print(f"[DEBUG] pipeline_flow type: {type(pipeline_flow)}")
    temp_dir = None
    remote_compose_dir = "genaistudio-compose"
    
    try:
        # Connect to remote server
        print("[INFO] Connecting to remote server...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(hostname, username=username)
        print("[INFO] Connected to remote server.")

        # Check for existing deployment and stop if necessary
        print("[INFO] Checking for existing deployment...")
        _, stdout, _ = ssh.exec_command(f"ls -d {remote_compose_dir}", get_pty=True)
        if stdout.channel.recv_exit_status() == 0:
            print("[INFO] Existing deployment found. Stopping services...")
            _, stdout, stderr = ssh.exec_command(f"cd {remote_compose_dir} && rm nohup.out", get_pty=True)
            _, stdout, _ = ssh.exec_command(f"ls -d {remote_compose_dir}", get_pty=True)
            stop_existing_deployment(ssh, remote_compose_dir)
            print("[INFO] Existing deployment stopped.")
        else:
            print("[INFO] No existing deployment found.")
        
        # Step 4: Upload and extract files
        print("[INFO] Creating deployment package...")
        zip_path, temp_dir = create_zip_locally(pipeline_flow, hostname)
        remote_zip_path = f"/home/{username}/docker-compose.zip"
        print("[INFO] Uploading deployment package...")
        sftp = ssh.open_sftp()
        sftp.put(zip_path, remote_zip_path)
        sftp.close()
        print("[INFO] Deployment package uploaded.")

        # Create directory and extract files
        print("[INFO] Extracting deployment files...")
        ssh.exec_command(f"mkdir -p {remote_compose_dir}")
        extract_cmd = f"python3 -c \"import zipfile; zipfile.ZipFile('{remote_zip_path}').extractall('{remote_compose_dir}')\""
        _, stdout, stderr = ssh.exec_command(extract_cmd, get_pty=True)
        
        if stdout.channel.recv_exit_status() != 0:
            error_msg = stderr.read().decode().strip()
            raise Exception(f"Failed to extract files: {error_msg}")
        
        print("[INFO] Files extracted successfully.")

        # Debug: List extracted files
        print("[DEBUG] Listing extracted files...")
        _, stdout_ls, _ = ssh.exec_command(f"ls -la {remote_compose_dir}", get_pty=True)
        file_list = stdout_ls.read().decode().strip()
        print(f"[DEBUG] Extracted files:\n{file_list}")
        
        # Debug: Check .env file contents
        print("[DEBUG] Checking .env file contents...")
        _, stdout_env, _ = ssh.exec_command(f"cat {remote_compose_dir}/.env", get_pty=True)
        env_contents = stdout_env.read().decode().strip()
        print(f"[DEBUG] .env file contents:\n{env_contents}")

        # Clean up the ZIP file
        ssh.exec_command(f"rm -f {remote_zip_path}")

        # Step 5: Start services
        print("[INFO] Starting deployment services...")
        start_cmd = f"cd {remote_compose_dir} && nohup docker compose up -d & sleep 0.1"
        _, stdout, stderr = ssh.exec_command(start_cmd, get_pty=True)
        
        # Read successfully the output
        stdout_output = stdout.read().decode().strip()
        stderr_output = stderr.read().decode().strip()
        start_exit_status = stdout.channel.recv_exit_status()
        
        print(f"[DEBUG] Docker compose stdout: {stdout_output}")
        print(f"[DEBUG] Docker compose stderr: {stderr_output}")
        print(f"[DEBUG] Docker compose exit status: {start_exit_status}")
        
        # Note: With nohup in background, exit status may not reflect actual docker compose status
        # The command should succeed if the nohup command itself launches properly
        print("[INFO] Docker compose command launched in background")
        
        # Give a moment for services to start
        time.sleep(2)
        
        # Check if containers are starting
        print("[DEBUG] Checking if containers are starting...")
        _, stdout_ps, _ = ssh.exec_command(f"cd {remote_compose_dir} && docker compose ps", get_pty=True)
        ps_output = stdout_ps.read().decode().strip()
        print(f"[DEBUG] Initial container status:\n{ps_output}")
        
        print("[INFO] Docker compose launched successfully")
        
        ssh.close()
        print("[INFO] Deployment initiated successfully.")

        return {
            "status": "In Progress",
            "message": "Deployment initiated successfully",
            "compose_dir": remote_compose_dir,
            "remote_zip_path": remote_zip_path,
            "logs": ["Deployment initiated successfully"]
        }
        
    except Exception as e:
        print(f"[ERROR] Deployment failed: {e}")
        return {
            "error": str(e),
            "logs": [f"Deployment failed: {str(e)}"]
        }
    finally:
        if temp_dir:
            clean_up_temp_dir(temp_dir)

def stop_existing_deployment(ssh, compose_dir):
    """Stop existing deployment services"""
    try:
        # Stop docker compose services - use synchronous approach to ensure completion
        print("[DEBUG] Stopping existing services...")
        _, stdout, stderr = ssh.exec_command(f"cd {compose_dir} && docker compose down --remove-orphans", get_pty=True)
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
            error_output = stderr.read().decode().strip()
            print(f"[WARNING] Error stopping services: {error_output}")
        else:
            print("[DEBUG] Docker compose down completed successfully")
        
        # Remove any dangling containers that might conflict
        print("[DEBUG] Removing dangling containers...")
        ssh.exec_command("docker container prune -f", get_pty=True)
        
        # Clean up old files after stopping services
        print("[DEBUG] Cleaning up old deployment files...")
        ssh.exec_command(f"cd {compose_dir} && rm -f .env app.nginx.conf.template compose.yaml workflow-info.json", get_pty=True)
        print("[INFO] Existing deployment stopped and cleaned up.")
        
    except Exception as e:
        print(f"[ERROR] Error stopping existing deployment: {e}")
        raise Exception(f"Failed to stop existing deployment: {str(e)}")

def create_zip_locally(request, hostname):
    temp_dir = tempfile.mkdtemp()
    env_file_path = os.path.join(temp_dir, ".env")
    compose_file_path = os.path.join(temp_dir, "compose.yaml")
    workflow_info_file_path = os.path.join(temp_dir, "workflow-info.json")
    nginx_conf_path = os.path.join(temp_dir, "app.nginx.conf.template")
    zip_path = os.path.join(temp_dir, "docker-compose.zip")

    # Only keep large objects in memory as long as needed
    workflow_info_raw = WorkflowInfo(request)
    workflow_info_json = workflow_info_raw.export_to_json()
    workflow_info = json.loads(workflow_info_json)
    services_info = process_opea_services(workflow_info)
    ports_info = services_info["services"]["app"]["ports_info"]
    additional_files_info = services_info.get("additional_files", [])

    try:
        with open(env_file_path, 'w') as f:
            f.write(f"public_host_ip={hostname}\n")
            # Add proxy environment variables with empty defaults to avoid Docker warnings
            f.write("http_proxy=\n")
            f.write("https_proxy=\n")
            f.write("no_proxy=\n")
            for key, value in ports_info.items():
                f.write(f"{key}={value}\n")

        compose_content = convert_proj_info_to_compose(workflow_info)
        with open(compose_file_path, 'w') as f:
            f.write(compose_content)

        with open(workflow_info_file_path, 'w') as f:
            f.write(json.dumps(workflow_info, indent=4))

        # Read app.nginx.conf.template template and copy to temp directory
        nginx_template_path = os.path.join(os.path.dirname(__file__), '..', 'templates', 'app', 'app.nginx.conf.template')
        if os.path.exists(nginx_template_path):
            with open(nginx_template_path, 'r') as template_file:
                nginx_conf_content = template_file.read()
            with open(nginx_conf_path, 'w') as f:
                f.write(nginx_conf_content)
        else:
            raise FileNotFoundError(f"app.nginx.conf.template template not found at {nginx_template_path}")

        # Free up memory from large objects as soon as possible
        del workflow_info_raw, workflow_info_json, workflow_info, services_info, ports_info

        # Use ZIP_DEFLATED for better disk usage (optional, can help with large files)
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(env_file_path, arcname=".env")
            zipf.write(compose_file_path, arcname="compose.yaml")
            zipf.write(workflow_info_file_path, arcname="workflow-info.json")
            zipf.write(nginx_conf_path, arcname="app.nginx.conf.template")

            for file_info in additional_files_info:
                source_path = file_info["source"]
                target_path = file_info["target"]
                if os.path.isdir(source_path):
                    # Walk directory and add files one by one to avoid memory spikes
                    for root, _, files in os.walk(source_path):
                        for file in files:
                            full_file_path = os.path.join(root, file)
                            relative_path = os.path.relpath(full_file_path, source_path)
                            arcname = os.path.join(target_path, relative_path)
                            zipf.write(full_file_path, arcname=arcname)
                else:
                    # Add file directly by path (no memory spike)
                    zipf.write(source_path, arcname=target_path)

        # Optionally, delete large file paths from temp_dir after zipping
        del additional_files_info

        return zip_path, temp_dir

    except Exception as e:
        print(f"An error occurred while creating the ZIP: {e}")
        clean_up_temp_dir(temp_dir)
        raise RuntimeError(f"Failed to generate ZIP: {e}")

def clean_up_temp_dir(dir_path: str):
    try:
        shutil.rmtree(dir_path)
    except Exception as e:
        logging.exception(f"An error occurred while deleting the temp directory {dir_path}.")

async def async_check_deployment_status(remote_host, remote_user, compose_dir="genaistudio-compose"):
    """
    Async wrapper for checking deployment status
    """
    try:
        # Run the synchronous status check function in a thread pool
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor, 
                check_deployment_status, 
                remote_host, 
                remote_user, 
                compose_dir
            )
        return result
    except Exception as e:
        return {
            "status": "Error",
            "message": f"Async status check failed: {str(e)}",
            "logs": []
        }

def check_deployment_status(remote_host, remote_user, compose_dir="genaistudio-compose"):
    """Check deployment status using docker ps commands"""
    ssh_check = None
    try:
        ssh_check = paramiko.SSHClient()
        ssh_check.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh_check.connect(remote_host, username=remote_user)

        # Check if deployment directory exists
        _, stdout, _ = ssh_check.exec_command(f"ls -d {compose_dir}")
        if stdout.channel.recv_exit_status() != 0:
            return {"status": "In Progress", "message": "Preparing deployment environment...", "logs": []}

        # Check if compose.yaml exists
        _, stdout_compose, _ = ssh_check.exec_command(f"ls {compose_dir}/compose.yaml")
        if stdout_compose.channel.recv_exit_status() != 0:
            return {"status": "In Progress", "message": "Uploading deployment files...", "logs": []}

        # Check if compose.yaml exists
        _, stdout_compose, _ = ssh_check.exec_command(f"ls {compose_dir}/nohup.out")
        if stdout_compose.channel.recv_exit_status() != 0:
            return {"status": "In Progress", "message": "Stopping existing servicess...", "logs": ['Stopping existing services...']}

        # Get the number of services defined in compose.yaml
        _, stdout_num, stderr_num = ssh_check.exec_command(f"cd {compose_dir} && docker compose config --services | wc -l")
        num_exit_status = stdout_num.channel.recv_exit_status()
        if num_exit_status != 0:
            error_msg = stderr_num.read().decode().strip()
            return {"status": "Error", "message": f"Failed to read compose configuration: {error_msg}", "logs": []}
        
        num_services_output = stdout_num.read().decode().strip().splitlines()
        num_services_lines = [line for line in num_services_output if not line.startswith('WARN') and line.strip()]
        num_services_str = num_services_lines[-1] if num_services_lines else '0'
        
        # Run docker compose ps to get service status
        _, stdout_ps, stderr_ps = ssh_check.exec_command(f"cd {compose_dir} && docker compose ps --all --format json")
        ps_exit_status = stdout_ps.channel.recv_exit_status()
        if ps_exit_status != 0:
            error_msg = stderr_ps.read().decode().strip()
            return {"status": "In Progress", "message": f"Starting deployment services... ({error_msg})", "logs": []}
        
        out = stdout_ps.read().decode()
        json_lines = [line for line in out.strip().splitlines() if line.strip() and not line.strip().startswith('WARN')]
        
        all_services = []
        for line in json_lines:
            try:
                ps_data = json.loads(line)
                if isinstance(ps_data, dict):
                    all_services.append(ps_data)
            except Exception as e:
                print(f"[ERROR] Failed to parse docker compose ps output: {line}")
                continue

        # Read deployment logs if available
        _, stdout_logs, _ = ssh_check.exec_command(f"cd {compose_dir} && tail -n 10 nohup.out 2>/dev/null || echo 'No logs yet'")
        log_lines = stdout_logs.read().decode().splitlines()
        
        # Check for error patterns in logs
        error_patterns = [
            "Error response from daemon",
            "dependency failed to start", 
            "Container.*Error",
            "failed to start",
            "Cannot start service"
        ]
        
        log_text = '\n'.join(log_lines)
        for pattern in error_patterns:
            import re
            if re.search(pattern, log_text, re.IGNORECASE):
                return {
                    "status": "Error",
                    "message": log_text,
                    "logs": log_lines,
                    "services": all_services
                }

        # Analyze service statuses
        services_running = 0
        services_exited = 0
        services_unhealthy = 0
        expected_completed_containers = [
            "model-downloader", "downloader", "init", "setup", "migrate", "seed"
        ]

        for service in all_services:
            state = service.get("State", "")
            name = service.get("Name", "").lower()
            health = service.get("Health", "")
            
            if state == "running":
                if health == "unhealthy":
                    services_unhealthy += 1
                else:
                    services_running += 1
            elif state == "exited":
                # Check if this is an expected completed container
                is_expected_completed = any(keyword in name for keyword in expected_completed_containers)
                if not is_expected_completed:
                    services_exited += 1

        total_defined = int(num_services_str)
        services_expected_completed = len([s for s in all_services if s.get("State") == "exited" 
                                         and any(keyword in s.get("Name", "").lower() 
                                                for keyword in expected_completed_containers)])

        # Determine overall status
        if services_unhealthy > 0:
            # Get detailed error info for unhealthy services
            unhealthy_services = [s for s in all_services if s.get("Health") == "unhealthy"]
            error_details = []
            for service in unhealthy_services:
                service_name = service.get("Name", "unknown")
                error_details.append(f"Service {service_name} is unhealthy")
            
            return {
                "status": "Error",
                "message": f"{services_unhealthy} services are unhealthy: {', '.join(error_details)}",
                "logs": log_lines,
                "services": all_services
            }
        elif services_exited > 0:
            # Get detailed error info for exited services
            exited_services = [s for s in all_services if s.get("State") == "exited" 
                             and not any(keyword in s.get("Name", "").lower() 
                                       for keyword in expected_completed_containers)]
            error_details = []
            for service in exited_services:
                service_name = service.get("Name", "unknown")
                exit_code = service.get("ExitCode", "unknown")
                error_details.append(f"{service_name}(exit:{exit_code})")
            
            return {
                "status": "Error", 
                "message": f"{services_exited} services failed: {', '.join(error_details)}",
                "logs": log_lines,
                "services": all_services
            }
        elif (services_running + services_expected_completed) == total_defined and services_running > 0:
            return {
                "status": "Success",
                "message": f"All {total_defined} services are running successfully. Application accessible at http://{remote_host}:8090",
                "logs": log_lines,
                "services": all_services
            }
        elif len(all_services) < total_defined:
            return {
                "status": "In Progress",
                "message": f"Starting services... ({len(all_services)}/{total_defined} services created)",
                "logs": log_lines,
                "services": all_services
            }
        else:
            return {
                "status": "In Progress",
                "message": f"Services starting... ({services_running} running, {services_expected_completed} completed)",
                "logs": log_lines,
                "services": all_services
            }
            
    except Exception as e:
        return {
            "status": "Error",
            "message": f"Status check failed: {str(e)}",
            "logs": []
        }
    finally:
        if ssh_check:
            try:
                ssh_check.close()
            except:
                pass